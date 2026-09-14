import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";

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
    const supabase = await createClient();
    const [
      { count: pendingCases },
      { data: byStatus },
      { data: lockers },
      { count: waitlist },
      { data: recentRaw },
    ] = await Promise.all([
      supabase.from("union_cases").select("id", { count: "exact", head: true }).eq("delegation_id", depId).in("status", ["draft", "ready", "submitted", "under_review"]),
      supabase.from("union_cases").select("case_type, status").eq("delegation_id", depId),
      supabase.from("union_lockers").select("status").eq("delegation_id", depId),
      supabase.from("union_locker_waitlist").select("id", { count: "exact", head: true }).eq("delegation_id", depId).eq("status", "waiting"),
      supabase
        .from("union_cases")
        .select("id, folio, case_type, status, opened_at, worker_id")
        .eq("delegation_id", depId)
        .order("opened_at", { ascending: false })
        .limit(8),
    ]);
    const recentWorkerIds = [...new Set((((recentRaw ?? []) as unknown) as Array<{ worker_id: string }>).map((r) => r.worker_id))];
    let recentWorkerById = new Map<string, Record<string, unknown>>();
    if (recentWorkerIds.length > 0) {
      const { data: rw } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, employee_number")
        .in("id", recentWorkerIds);
      recentWorkerById = new Map((((rw ?? []) as unknown) as Array<{ id: string } & Record<string, unknown>>).map((w) => [w.id, w]));
    }
    const recent = (((recentRaw ?? []) as unknown) as Array<{ worker_id: string } & Record<string, unknown>>).map((r) => ({
      ...r,
      union_workers: recentWorkerById.get(r.worker_id) ?? null,
    }));
    const rows = (byStatus ?? []) as Array<{ case_type: string; status: string }>;
    const active = (t: string) => rows.filter((r) => r.case_type === t && !["cancelled", "archived", "completed"].includes(r.status)).length;
    const lockerRows = (lockers ?? []) as Array<{ status: string }>;
    return noStore(
      NextResponse.json({
        pending: pendingCases ?? 0,
        maternityActive: active("maternity"),
        lactationActive: active("lactation"),
        licensePending: rows.filter((r) => r.case_type === "license" && ["draft", "ready", "submitted", "under_review"].includes(r.status)).length,
        passagePending: rows.filter((r) => (r.case_type === "passage_026" || r.case_type === "passage_027") && ["draft", "ready", "submitted", "under_review"].includes(r.status)).length,
        lockersAvailable: lockerRows.filter((l) => l.status === "available").length,
        lockersAssigned: lockerRows.filter((l) => l.status === "assigned").length,
        lockersTotal: lockerRows.length,
        waitlist: waitlist ?? 0,
        recent: recent ?? [],
      }),
    );
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo cargar el tablero" }, { status: 500 }));
  }
}
