import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { fetchAllSupabaseRows, chunkArray } from "@/shared/lib/supabase-pagination";
import {
  dispatchCavBridgeCommand,
  fetchCavAllRecords,
  linkParkingRowsWithWorkers,
} from "@/features/representacion/services/parking/cav-hgr1-client";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { delegation_id?: string };
    const memberships = await requireUnionMembership(body.delegation_id);
    const depId = body.delegation_id ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

    const supabase = await createClient();

    // 1. Intentar descarga directa en LAN desde CAV HGR 1 (11.1.17.44:8080);
    //    si estamos fuera de la oficina, usar el Puente en Vivo de La Veinte Print Agent.
    let cavRows;
    try {
      cavRows = await fetchCavAllRecords(["1", "2", "3"]);
    } catch {
      const bridgeRes = await dispatchCavBridgeCommand<{
        sync_stats?: {
          total_cav_rows: number;
          linked_workers_count: number;
          unlinked_count: number;
          synced_at: string;
        };
      }>(supabase, {
        delegationId: depId,
        action: "sync_all",
        payload: {},
        userId: auth.user.id,
        timeoutMs: 15_000,
        leaveQueuedOnTimeout: true,
      });

      if (bridgeRes.executedLive && bridgeRes.result?.sync_stats) {
        const stats = bridgeRes.result.sync_stats;
        await writeAuditLog({
          delegation_id: depId,
          entity_type: "union_parking",
          entity_id: depId,
          action: "parking.synced",
          metadata: {
            mode: "live_bridge",
            total_synced: stats.total_cav_rows,
            linked_to_padron: stats.linked_workers_count,
          },
        });

        return noStore(
          NextResponse.json({
            ok: true,
            lanReachable: true,
            mode: "live_bridge",
            totalSynced: stats.total_cav_rows,
            linkedCount: stats.linked_workers_count,
            unlinkedCount: stats.unlinked_count,
            syncedAt: stats.synced_at,
          }),
        );
      }

      const st = bridgeRes.stationStatus;
      const reason = st.stationOnline && !st.bridgeCapable
        ? `La estación "${st.stationName || "Oficina Sindical"}" está en línea pero tiene la versión ${st.agentVersion || "1.0.0"}. Actualice La Veinte Print a v1.1.0 en la PC de la oficina para activar el Puente en Vivo.`
        : "La solicitud de sincronización quedó en cola en el Puente en Vivo y se ejecutará automáticamente en cuanto el agente de la oficina responda.";

      return noStore(
        NextResponse.json({
          ok: true,
          queued_bridge: true,
          lanReachable: false,
          message: reason,
          stationStatus: st,
        }),
      );
    }

    // 2. Cargar todos los trabajadores del Padrón Sindical para enlazar por matrícula
    const workers = await fetchAllSupabaseRows<{ id: string; employee_number: string }>(
      ({ from, to }) =>
        supabase
          .from("union_workers")
          .select("id, employee_number")
          .eq("delegation_id", depId)
          .neq("source_import_state", "rolled_back")
          .range(from, to),
      { pageSize: 1000 },
    );

    // 3. Cargar estado interno previo (para conservar marca de 'baja' cuando el switch en CAV sigue en 'X')
    const existingRows = await fetchAllSupabaseRows<{
      external_id_reg: number;
      internal_status: string;
      worker_id: string | null;
    }>(
      ({ from, to }) =>
        supabase
          .from("union_parking_records")
          .select("external_id_reg, internal_status, worker_id")
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 1000 },
    );

    const existingByExternalId = new Map(existingRows.map((r) => [r.external_id_reg, r]));
    const nowIso = new Date().toISOString();

    const linkedPayloads = linkParkingRowsWithWorkers(
      depId,
      cavRows,
      workers,
      existingByExternalId,
      nowIso,
    );

    // 4. Upsert por bloques en union_parking_records
    for (const chunk of chunkArray(linkedPayloads, 300)) {
      const { error: upsertErr } = await supabase
        .from("union_parking_records")
        .upsert(
          chunk.map((item) => ({
            ...item,
            updated_by: auth.user.id,
            updated_at: nowIso,
          })),
          { onConflict: "delegation_id,external_id_reg" },
        );
      if (upsertErr) throw upsertErr;
    }

    const linkedCount = linkedPayloads.filter((r) => Boolean(r.worker_id)).length;
    const activeCount = linkedPayloads.filter((r) => r.status === "A").length;
    const suspendedCount = linkedPayloads.filter((r) => r.status === "X").length;

    await writeAuditLog({
      delegation_id: depId,
      entity_type: "union_parking",
      entity_id: depId,
      action: "parking.synced",
      metadata: {
        total_synced: linkedPayloads.length,
        linked_to_padron: linkedCount,
        active_count: activeCount,
        suspended_count: suspendedCount,
      },
    });

    return noStore(
      NextResponse.json({
        ok: true,
        lanReachable: true,
        totalSynced: linkedPayloads.length,
        linkedCount,
        unlinkedCount: linkedPayloads.length - linkedCount,
        activeCount,
        suspendedCount,
        syncedAt: nowIso,
      }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStore(
      NextResponse.json({ error: message || "Error al sincronizar estacionamiento" }, { status: 500 }),
    );
  }
}
