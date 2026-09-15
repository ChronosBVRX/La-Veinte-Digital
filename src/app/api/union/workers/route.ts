import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { workerSchema } from "@/features/representacion/lib/validation";
import { writeAuditLog } from "@/features/representacion/services/audit";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const delegationId = url.searchParams.get("delegation_id");
  try {
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();
    let query = supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, assignment, turn, schedule, rest_days, active, created_at")
      .eq("delegation_id", depId)
      .neq("source_import_state", "rolled_back")
      .order("paternal_surname", { ascending: true })
      .limit(50);
    if (q) {
      const like = `%${q}%`;
      query = query.or(`employee_number.ilike.${like},first_name.ilike.${like},paternal_surname.ilike.${like},maternal_surname.ilike.${like},siap_full_name.ilike.${like}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return noStore(NextResponse.json({ workers: data ?? [] }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    const status = message.includes("Sin acceso") || message.includes("autenticado") ? 403 : 500;
    return noStore(NextResponse.json({ error: "No se pudo consultar el padrón" }, { status }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = workerSchema.safeParse((body as Record<string, unknown>)?.worker ?? body);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
    }
    const delegationId = (body as { delegation_id?: string })?.delegation_id;
    const memberships = await requireUnionMembership(delegationId);
    const depId = typeof delegationId === "string" && delegationId ? delegationId : memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();
    const matricula = parsed.data.employee_number.trim().toUpperCase().replace(/\s+/g, "");
    const { data, error } = await supabase
      .from("union_workers")
      .insert({
        delegation_id: depId,
        employee_number: matricula,
        first_name: parsed.data.first_name.trim(),
        paternal_surname: parsed.data.paternal_surname.trim(),
        maternal_surname: (parsed.data.maternal_surname ?? "").trim(),
        category: parsed.data.category.trim(),
        assignment: parsed.data.assignment.trim(),
        turn: parsed.data.turn.trim().toUpperCase(),
        schedule: (parsed.data.schedule ?? "").trim(),
        rest_days: (parsed.data.rest_days ?? "").trim(),
        phone: (parsed.data.phone ?? "").trim() || null,
        notes: (parsed.data.notes ?? "").trim(),
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("No se pudo registrar al trabajador.");
    await writeAuditLog({
      delegation_id: depId,
      entity_type: "union_worker",
      entity_id: String((data as { id: string }).id),
      action: "worker.created",
      metadata: { employee_suffix: matricula.slice(-4) },
    });
    return noStore(NextResponse.json({ id: (data as { id: string }).id }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    const status = message.includes("Sin acceso") || message.includes("autenticado") ? 403 : 500;
    return noStore(NextResponse.json({ error: "No se pudo registrar al trabajador" }, { status }));
  }
}
