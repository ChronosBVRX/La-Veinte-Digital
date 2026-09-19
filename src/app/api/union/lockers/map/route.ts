import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import {
  getLockerEffectiveState,
  naturalCompare,
  type LockerMapItem,
  type LockerZone,
  type LockerBank,
  type LockerStatus,
  type LockerCondition,
  type LockerMapResponse,
  type LockerMapSummary,
} from "@/features/representacion/lib/lockers";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  try {
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

    const selectedZoneId = url.searchParams.get("zone_id") || "all";
    const selectedBankId = url.searchParams.get("bank_id");
    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const onlyIssues = url.searchParams.get("only_issues") === "true";

    const supabase = await createClient();

    // 1. Cargar Zonas de la delegación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawZones } = await (supabase as any)
      .from("union_locker_zones")
      .select("id, delegation_id, name, description, building, floor, sort_order, active")
      .eq("delegation_id", depId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const zones = (rawZones ?? []) as LockerZone[];

    // 2. Cargar Bloques / Muebles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let banksQuery = (supabase as any)
      .from("union_locker_banks")
      .select("id, delegation_id, zone_id, name, description, rows, columns, sort_order, orientation, active")
      .eq("delegation_id", depId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (selectedZoneId !== "all" && selectedZoneId !== "unlocated") {
      banksQuery = banksQuery.eq("zone_id", selectedZoneId);
    }
    const { data: rawBanks } = await banksQuery;
    const banks = (rawBanks ?? []) as LockerBank[];

    // 3. Cargar todos los casilleros de la delegación para estadísticas globales
    const { data: rawAllLockers } = await supabase
      .from("union_lockers")
      .select("id, locker_number, status, condition, zone_id, bank_id, row_position, column_position, position_label, sort_order, physical_code, notes, maintenance_reason, maintenance_notes")
      .eq("delegation_id", depId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLockers = (rawAllLockers ?? []) as any[];

    // 4. Asignaciones activas
    const { data: rawAssignments } = await supabase
      .from("union_locker_assignments")
      .select("id, locker_id, worker_id, assigned_at, status")
      .eq("status", "active");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments = (rawAssignments ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asgByLockerId = new Map<string, any>();
    const workerIds = new Set<string>();

    for (const a of assignments) {
      asgByLockerId.set(a.locker_id, a);
      if (a.worker_id) workerIds.add(a.worker_id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workersMap = new Map<string, any>();
    if (workerIds.size > 0) {
      const { data: rawWorkers } = await supabase
        .from("union_workers")
        .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn")
        .in("id", Array.from(workerIds));

      if (rawWorkers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        workersMap = new Map(rawWorkers.map((w: any) => [w.id, w]));
      }
    }

    // 5. Pendientes de revisión (incidencias)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawPending } = await (supabase as any)
      .from("union_locker_review_items")
      .select("id, locker_id, locker_number, reason, source_employee_number, source_worker_name")
      .eq("delegation_id", depId)
      .eq("status", "pending");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingItems = (rawPending ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingByLockerNumber = new Map<string, any>();
    for (const p of pendingItems) {
      pendingByLockerNumber.set(p.locker_number, p);
    }

    // 6. Lista de espera activa
    const { count: waitlistCount } = await supabase
      .from("union_locker_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", depId)
      .eq("status", "waiting");

    // 7. Calcular métricas por zona y globales
    const zoneCounts = new Map<string, { total: number; assigned: number; available: number; attention: number }>();
    for (const z of zones) {
      zoneCounts.set(z.id, { total: 0, assigned: 0, available: 0, attention: 0 });
    }

    let globalAssigned = 0;
    let globalAvailable = 0;
    let globalAttention = 0;
    let globalMaintenance = 0;
    let globalUnlocated = 0;

    const mapItems: LockerMapItem[] = [];

    for (const l of allLockers) {
      const asg = asgByLockerId.get(l.id) || null;
      const worker = asg ? workersMap.get(asg.worker_id) : null;
      const pending = pendingByLockerNumber.get(l.locker_number) || null;
      const effectiveState = getLockerEffectiveState(l, asg, pending);

      if (effectiveState.isAvailable) globalAvailable++;
      else if (effectiveState.kind === "assigned") globalAssigned++;

      if (effectiveState.hasAttention) globalAttention++;
      if (effectiveState.kind === "maintenance") globalMaintenance++;
      if (!l.zone_id || !l.bank_id) globalUnlocated++;

      if (l.zone_id && zoneCounts.has(l.zone_id)) {
        const zc = zoneCounts.get(l.zone_id)!;
        zc.total++;
        if (effectiveState.isAvailable) zc.available++;
        if (effectiveState.kind === "assigned") zc.assigned++;
        if (effectiveState.hasAttention) zc.attention++;
      }

      // Filtrar para el payload visual del mapa
      let includeInMap = true;

      if (selectedZoneId === "unlocated") {
        includeInMap = !l.zone_id || !l.bank_id;
      } else if (selectedZoneId !== "all") {
        includeInMap = l.zone_id === selectedZoneId;
      }

      if (selectedBankId && includeInMap) {
        includeInMap = l.bank_id === selectedBankId;
      }

      if (onlyIssues && includeInMap) {
        includeInMap = effectiveState.hasAttention || effectiveState.hasDiscrepancy || !l.zone_id || !l.bank_id;
      }

      if (q && includeInMap) {
        const numMatch = l.locker_number.toLowerCase().includes(q);
        const codeMatch = (l.physical_code || "").toLowerCase().includes(q);
        const empMatch = worker ? (worker.employee_number || "").toLowerCase().includes(q) : false;
        const nameMatch = worker
          ? `${worker.first_name || ""} ${worker.paternal_surname || ""} ${worker.maternal_surname || ""}`
              .toLowerCase()
              .includes(q)
          : false;
        const pendingNameMatch = pending
          ? (pending.source_worker_name || "").toLowerCase().includes(q) ||
            (pending.source_employee_number || "").toLowerCase().includes(q)
          : false;

        includeInMap = numMatch || codeMatch || empMatch || nameMatch || pendingNameMatch;
      }

      if (includeInMap) {
        mapItems.push({
          id: l.id,
          delegation_id: depId,
          locker_number: l.locker_number,
          location: l.location,
          section: l.section,
          status: (l.status || "available") as LockerStatus,
          condition: (l.condition || "ok") as LockerCondition,
          zone_id: l.zone_id,
          bank_id: l.bank_id,
          row_position: l.row_position,
          column_position: l.column_position,
          position_label: l.position_label,
          sort_order: l.sort_order,
          physical_code: l.physical_code,
          notes: l.notes,
          maintenance_reason: l.maintenance_reason,
          maintenance_notes: l.maintenance_notes,
          active_assignment: asg && worker
            ? {
                id: asg.id,
                worker_id: asg.worker_id,
                assigned_at: asg.assigned_at,
                worker_name: `${worker.first_name || ""} ${worker.paternal_surname || ""}`.trim(),
                employee_number: worker.employee_number,
                category: worker.category,
                assignment: worker.assignment,
                turn: worker.turn,
              }
            : null,
          pending_review: pending
            ? {
                id: pending.id,
                reason: pending.reason,
                source_employee_number: pending.source_employee_number,
                source_worker_name: pending.source_worker_name,
              }
            : null,
          effective_state: effectiveState,
        });
      }
    }

    // Ordenar mapa por número de casillero o posición
    mapItems.sort((a, b) => {
      if (a.bank_id === b.bank_id && a.row_position && b.row_position && a.column_position && b.column_position) {
        if (a.row_position !== b.row_position) return a.row_position - b.row_position;
        return a.column_position - b.column_position;
      }
      return naturalCompare(a.locker_number, b.locker_number);
    });

    const enrichedZones = zones.map((z) => ({
      ...z,
      total_lockers: zoneCounts.get(z.id)?.total ?? 0,
      assigned_lockers: zoneCounts.get(z.id)?.assigned ?? 0,
      available_lockers: zoneCounts.get(z.id)?.available ?? 0,
      attention_lockers: zoneCounts.get(z.id)?.attention ?? 0,
    }));

    const summary: LockerMapSummary = {
      total: allLockers.length,
      assigned: globalAssigned,
      available: globalAvailable,
      attention: globalAttention,
      maintenance: globalMaintenance,
      unlocated: globalUnlocated,
      pendingReview: pendingItems.length,
      waitlist: waitlistCount ?? 0,
      integrityIssues: globalAttention,
      // Aliases para compatibilidad hacia atrás
      waitlistCount: waitlistCount ?? 0,
      pending_review: pendingItems.length,
      integrity_issues_count: globalAttention,
    };

    const counts = {
      total: allLockers.length,
      assigned: globalAssigned,
      available: globalAvailable,
      maintenance: globalMaintenance,
      unlocated: globalUnlocated,
      pending_review: pendingItems.length,
    };

    const payload: LockerMapResponse = {
      zones: enrichedZones,
      banks,
      lockers: mapItems,
      summary,
      counts,
      integrity_issues_count: globalAttention,
    };

    return noStore(NextResponse.json(payload));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al cargar mapa de casilleros";
    return noStore(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
