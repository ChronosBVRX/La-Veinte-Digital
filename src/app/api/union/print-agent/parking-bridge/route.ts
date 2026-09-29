import { NextResponse } from "next/server";
import {
  authenticatePrintStation,
  createPrintAgentClient,
} from "@/features/representacion/services/print-token";
import {
  getCavConfig,
  upsertCavRowsToSupabase,
} from "@/features/representacion/services/parking/cav-hgr1-client";
import type { CavSearchRow } from "@/features/representacion/services/parking/cav-hgr1-parser";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const supabase = await createPrintAgentClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const agentVersionHeader = req.headers.get("x-agent-version")?.trim();
    if (agentVersionHeader && agentVersionHeader !== station.agent_version) {
      await supabase
        .from("union_print_stations")
        .update({
          agent_version: agentVersionHeader,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", station.id);
    }

    const url = new URL(req.url);
    const checkInitial = url.searchParams.get("check_initial") === "1";

    const [{ data: pendingRows }, countRes] = await Promise.all([
      supabase
        .from("union_parking_bridge_requests")
        .select("id, action, payload, created_at")
        .eq("delegation_id", station.delegation_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5),
      checkInitial
        ? supabase
            .from("union_parking_records")
            .select("id", { count: "exact", head: true })
            .eq("delegation_id", station.delegation_id)
        : Promise.resolve({ count: 9999 }),
    ]);
    const existingRecordsCount = countRes.count;

    const claimedCommands: Array<{
      id: string;
      action: string;
      payload: Record<string, unknown>;
      created_at: string;
    }> = [];

    for (const row of pendingRows ?? []) {
      const { data: claimed } = await supabase
        .from("union_parking_bridge_requests")
        .update({
          status: "processing",
          station_id: station.id,
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id, action, payload, created_at")
        .maybeSingle();

      if (claimed) {
        claimedCommands.push({
          id: claimed.id,
          action: claimed.action,
          payload: (claimed.payload ?? {}) as Record<string, unknown>,
          created_at: claimed.created_at,
        });
      }
    }

    const cavCfg = getCavConfig();
    return NextResponse.json({
      success: true,
      station_id: station.id,
      delegation_id: station.delegation_id,
      needs_initial_sync: (existingRecordsCount ?? 0) < 100,
      cav_config: {
        base_url: cavCfg.baseUrl,
        username: cavCfg.username,
        password: cavCfg.password,
      },
      commands: claimedCommands,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error en el puente de estacionamiento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createPrintAgentClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const body = (await req.json()) as {
      type?: "sync_rows" | "command_result";
      rows?: CavSearchRow[];
      request_id?: string;
      ok?: boolean;
      result?: Record<string, unknown>;
      error_message?: string | null;
    };

    if (body.type === "sync_rows") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const syncStats = await upsertCavRowsToSupabase(supabase, station.delegation_id, rows);
      return NextResponse.json({
        success: true,
        ...syncStats,
      });
    }

    if (body.type === "command_result" && body.request_id) {
      let syncStats = null;
      if (Array.isArray(body.rows) && body.rows.length > 0) {
        syncStats = await upsertCavRowsToSupabase(supabase, station.delegation_id, body.rows);
      }

      const isOk = Boolean(body.ok);
      const mergedResult = {
        ...(body.result ?? {}),
        ...(syncStats ? { sync_stats: syncStats } : {}),
      };

      const { error: updateErr } = await supabase
        .from("union_parking_bridge_requests")
        .update({
          status: isOk ? "completed" : "failed",
          result: mergedResult as unknown as Json,
          error_message: isOk ? null : (body.error_message || "Error al ejecutar comando en CAV HGR 1"),
          completed_at: new Date().toISOString(),
        })
        .eq("id", body.request_id)
        .eq("delegation_id", station.delegation_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        request_id: body.request_id,
        status: isOk ? "completed" : "failed",
      });
    }

    return NextResponse.json({ error: "Tipo de mensaje no soportado en parking-bridge." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar respuesta del puente.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
