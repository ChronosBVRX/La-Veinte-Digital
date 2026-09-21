// Servicio canónico para cálculo de métricas de casilleros independiente de límites PostgREST
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CanonicalLockerSummary {
  total: number;
  active_inventory?: number;
  archived?: number;
  assigned: number;
  available: number;
  maintenance: number;
  blocked: number;
  reserved: number;
  unlocated: number;
  pendingReview: number;
  affectedLockers: number;
  issueCount: number;
  waitlist: number;
}

export async function getCanonicalLockerSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  delegationId: string,
): Promise<CanonicalLockerSummary> {
  // 1. Intentar RPC PostgreSQL agregada en servidor (óptima, inmune a PostgREST max-rows)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("union_get_locker_summary", {
      p_delegation_id: delegationId,
    });

    if (!error && data && typeof data === "object") {
      return {
        total: Number(data.total ?? 0),
        active_inventory: Number(data.active_inventory ?? data.total ?? 0),
        archived: Number(data.archived ?? 0),
        assigned: Number(data.assigned ?? 0),
        available: Number(data.available ?? 0),
        maintenance: Number(data.maintenance ?? 0),
        blocked: Number(data.blocked ?? 0),
        reserved: Number(data.reserved ?? 0),
        unlocated: Number(data.unlocated ?? 0),
        pendingReview: Number(data.pending_review ?? data.pendingReview ?? 0),
        affectedLockers: Number(data.affected_lockers ?? data.affectedLockers ?? 0),
        issueCount: Number(data.issue_count ?? data.issueCount ?? 0),
        waitlist: Number(data.waitlist ?? data.waitlistCount ?? 0),
      };
    }
  } catch {
    // Si la RPC falla (ej. mock local incompleto en tests unitarios), caer en fallback exacto
  }

  // 2. Fallback resiliente usando consultas HEAD con conteos exactos
  const [
    totalRes,
    assignedRes,
    availableRes,
    maintenanceRes,
    blockedRes,
    reservedRes,
    unlocatedRes,
    pendingRes,
    waitlistRes,
  ] = await Promise.all([
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "assigned"),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "available"),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "maintenance"),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "blocked"),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "reserved"),
    supabase.from("union_lockers").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).is("zone_id", null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("union_locker_review_items").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "pending"),
    supabase.from("union_locker_waitlist").select("id", { count: "exact", head: true }).eq("delegation_id", delegationId).eq("status", "waiting"),
  ]);

  const total = totalRes.count ?? 0;
  const assigned = assignedRes.count ?? 0;
  const available = availableRes.count ?? (total - assigned);
  const maintenance = maintenanceRes.count ?? 0;
  const blocked = blockedRes.count ?? 0;
  const reserved = reservedRes.count ?? 0;
  const unlocated = unlocatedRes.count ?? 0;
  const pendingReview = pendingRes.count ?? 0;
  const waitlist = waitlistRes.count ?? 0;
  const issueCount = pendingReview + maintenance + blocked;

  return {
    total,
    assigned,
    available,
    maintenance,
    blocked,
    reserved,
    unlocated,
    pendingReview,
    affectedLockers: pendingReview,
    issueCount,
    waitlist,
  };
}
