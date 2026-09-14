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
  const caseId = url.searchParams.get("case_id");
  if (!caseId) return noStore(NextResponse.json({ error: "case_id requerido" }, { status: 400 }));
  try {
    const supabase = await createClient();
    const { data: c } = await supabase.from("union_cases").select("id, delegation_id").eq("id", caseId).single();
    if (!c) return noStore(NextResponse.json({ error: "No encontrado" }, { status: 404 }));
    await requireUnionMembership((c as { delegation_id: string }).delegation_id);
    const { data: detail } = await supabase.from("union_license_cases").select("*").eq("case_id", caseId).single();
    const { data: header } = await supabase
      .from("union_cases")
      .select("folio, status, worker_snapshot, worker_id")
      .eq("id", caseId)
      .single();
    let unionWorker: Record<string, unknown> | null = null;
    const workerId = (header as unknown as { worker_id?: string } | null)?.worker_id;
    if (workerId) {
      const { data: wData } = await supabase
        .from("union_workers")
        .select("first_name, paternal_surname, maternal_surname, employee_number, category, assignment, turn, schedule, rest_days")
        .eq("id", workerId)
        .single();
      unionWorker = ((wData ?? null) as unknown) as Record<string, unknown> | null;
    }
    const { data: events } = await supabase.from("union_case_events").select("id, event_type, title, detail, created_at").eq("case_id", caseId).order("created_at", { ascending: true });
    return noStore(NextResponse.json({ detail, case: { ...(header as object), union_workers: unionWorker }, events: events ?? [] }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar" }, { status: 500 }));
  }
}
