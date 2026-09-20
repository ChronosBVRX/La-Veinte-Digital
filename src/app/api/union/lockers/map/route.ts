import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { fetchAllSupabaseRows, chunkArray } from "@/shared/lib/supabase-pagination";
import { getCanonicalLockerSummary } from "@/features/representacion/services/lockers-summary";
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

    // 3. Resumen canónico de métricas globales (PostgreSQL RPC agregada o exact counts)
    const canonicalSummary = await getCanonicalLockerSummary(supabase, depId);

    // 4. Cargar todos los casilleros de la delegación paginados con fetchAllSupabaseRows
    const allLockers = await fetchAllSupabaseRows<{
      id: string;
      locker_number: string;
      location?: string | null;
      section?: string | null;
      status: string;
      condition: string;
      zone_id: string | null;
      bank_id: string | null;
      row_position: number | null;
      column_position: number | null;
      position_label: string | null;
      sort_order: number | null;
      physical_code: string | null;
      notes: string | null;
      maintenance_reason: string | null;
      maintenance_notes: string | null;
    }>(
      ({ from, to }) =>
        supabase
          .from("union_lockers")
          .select(
            "id, locker_number, location, section, status, condition, zone_id, bank_id, row_position, column_position, position_label, sort_order, physical_code, notes, maintenance_reason, maintenance_notes",
          )
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 500 },
    );

    // 5. Asignaciones activas acotadas a la delegación desde SQL y paginadas
    const allLockerIds = new Set(allLockers.map((l) => l.id));
    const lockerNumberToId = new Map<string, string>();
    for (const l of allLockers) {
      lockerNumberToId.set(l.locker_number, l.id);
    }

    const assignments = await fetchAllSupabaseRows<{
      id: string;
      locker_id: string;
      worker_id: string;
      assigned_at: string;
      status: string;
    }>(
      ({ from, to }) =>
        supabase
          .from("union_locker_assignments")
          .select("id, locker_id, worker_id, assigned_at, status, union_lockers!inner(delegation_id)")
          .eq("status", "active")
          .eq("union_lockers.delegation_id", depId)
          .range(from, to),
      { pageSize: 500 },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asgByLockerId = new Map<string, any>();
    const workerIds = new Set<string>();

    for (const a of assignments) {
      asgByLockerId.set(a.locker_id, a);
      if (a.worker_id) workerIds.add(a.worker_id);
    }

    // 6. Cargar trabajadores asociados en lotes seguros (chunking) para evitar URLs excesivas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workersMap = new Map<string, any>();
    if (workerIds.size > 0) {
      const workerIdChunks = chunkArray(Array.from(workerIds), 200);
      for (const chunk of workerIdChunks) {
        const { data: rawWorkers } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn")
          .in("id", chunk);

        if (rawWorkers) {
          for (const w of rawWorkers) {
            workersMap.set(w.id, w);
          }
        }
      }
    }

    // 7. Pendientes de revisión (incidencias de conciliación/importación) paginados
    const pendingItems = await fetchAllSupabaseRows<{
      id: string;
      locker_id: string | null;
      locker_number: string;
      reason: string;
      source_employee_number: string | null;
      source_worker_name: string | null;
    }>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_review_items")
          .select("id, locker_id, locker_number, reason, source_employee_number, source_worker_name")
          .eq("delegation_id", depId)
          .eq("status", "pending")
          .range(from, to),
      { pageSize: 500 },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingByLockerNumber = new Map<string, any>();
    const affectedLockerIds = new Set<string>();
    let issueCount = 0;

    for (const p of pendingItems) {
      issueCount++;
      if (p.locker_id && allLockerIds.has(p.locker_id)) {
        affectedLockerIds.add(p.locker_id);
      } else if (p.locker_number && lockerNumberToId.has(p.locker_number)) {
        affectedLockerIds.add(lockerNumberToId.get(p.locker_number)!);
      }
      if (p.locker_number && !pendingByLockerNumber.has(p.locker_number)) {
        pendingByLockerNumber.set(p.locker_number, p);
      }
    }

    // 7. Calcular métricas por zona y mapa
    const zoneCounts = new Map<string, { total: number; assigned: number; available: number; attention: number }>();
    for (const z of zones) {
      zoneCounts.set(z.id, { total: 0, assigned: 0, available: 0, attention: 0 });
    }

    const mapItems: LockerMapItem[] = [];
    const normalize = (str: string): string => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanQ = q.replace(/^#/, "").trim();
    const normQ = normalize(cleanQ);

    for (const l of allLockers) {
      const asg = asgByLockerId.get(l.id) || null;
      const worker = asg ? workersMap.get(asg.worker_id) : null;
      const pending = pendingByLockerNumber.get(l.locker_number) || null;
      const effectiveState = getLockerEffectiveState(l, asg, pending);

      if (effectiveState.kind === "maintenance" || l.condition === "maintenance" || l.condition === "damaged") {
        affectedLockerIds.add(l.id);
        issueCount++;
      }
      if (effectiveState.kind === "blocked" || l.condition === "blocked") {
        affectedLockerIds.add(l.id);
        issueCount++;
      }
      if (effectiveState.kind === "inconsistent") {
        affectedLockerIds.add(l.id);
        issueCount++;
      }

      const isAffected = affectedLockerIds.has(l.id);

      if (l.zone_id && zoneCounts.has(l.zone_id)) {
        const zc = zoneCounts.get(l.zone_id)!;
        zc.total++;
        if (effectiveState.isAvailable) zc.available++;
        if (effectiveState.isAssigned || effectiveState.kind === "assigned") zc.assigned++;
        if (isAffected) zc.attention++;
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
        includeInMap = isAffected || effectiveState.hasAttention || effectiveState.hasDiscrepancy;
      }

      if (q && includeInMap) {
        const numMatch = normalize(l.locker_number).includes(normQ);
        const codeMatch = normalize(l.physical_code || "").includes(normQ);
        const empMatch = worker ? normalize(worker.employee_number || "").includes(normQ) : false;
        const nameMatch = worker
          ? normalize(`${worker.first_name || ""} ${worker.paternal_surname || ""} ${worker.maternal_surname || ""}`).includes(normQ)
          : false;
        const pendingNameMatch = pending
          ? normalize(pending.source_worker_name || "").includes(normQ) ||
            normalize(pending.source_employee_number || "").includes(normQ)
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

    const affectedLockers = Math.max(canonicalSummary.affectedLockers, affectedLockerIds.size);
    const finalIssueCount = Math.max(canonicalSummary.issueCount, issueCount);

    const summary: LockerMapSummary = {
      total: canonicalSummary.total,
      assigned: canonicalSummary.assigned,
      available: canonicalSummary.available,
      attention: affectedLockers,
      maintenance: canonicalSummary.maintenance,
      unlocated: canonicalSummary.unlocated,
      pendingReview: canonicalSummary.pendingReview,
      waitlist: canonicalSummary.waitlist,
      affectedLockers,
      issueCount: finalIssueCount,
      integrityIssues: affectedLockers,
      // Aliases para compatibilidad hacia atrás
      waitlistCount: canonicalSummary.waitlist,
      pending_review: canonicalSummary.pendingReview,
      integrity_issues_count: affectedLockers,
    };

    const counts = {
      total: canonicalSummary.total,
      assigned: canonicalSummary.assigned,
      available: canonicalSummary.available,
      maintenance: canonicalSummary.maintenance,
      unlocated: canonicalSummary.unlocated,
      pending_review: canonicalSummary.pendingReview,
    };

    const payload: LockerMapResponse = {
      zones: enrichedZones,
      banks,
      lockers: mapItems,
      summary,
      counts,
      integrity_issues_count: affectedLockers,
    };

    return noStore(NextResponse.json(payload));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al cargar mapa de casilleros";
    return noStore(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
