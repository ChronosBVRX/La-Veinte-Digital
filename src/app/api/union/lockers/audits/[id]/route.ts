import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const auditItemSchema = z.object({
  locker_id: z.string().uuid(),
  expected_assignment_id: z.string().uuid().optional().nullable(),
  result: z.enum(["matches", "physically_empty", "different_person", "damaged", "unverified"]),
  observed_worker_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).default(""),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audit, error } = await (supabase as any)
    .from("union_locker_audits")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !audit) return noStore(NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 }));
  await requireUnionMembership(audit.delegation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("union_locker_audit_items")
    .select("*, locker:union_lockers(locker_number)")
    .eq("audit_id", id)
    .order("verified_at", { ascending: true });

  return noStore(NextResponse.json({ audit, items: items ?? [] }));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = auditItemSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audit } = await (supabase as any)
    .from("union_locker_audits")
    .select("delegation_id, status")
    .eq("id", id)
    .single();

  if (!audit) return noStore(NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 }));
  await requireUnionMembership(audit.delegation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase as any)
    .from("union_locker_audit_items")
    .insert({
      audit_id: id,
      locker_id: parsed.data.locker_id,
      expected_assignment_id: parsed.data.expected_assignment_id || null,
      result: parsed.data.result,
      observed_worker_id: parsed.data.observed_worker_id || null,
      notes: parsed.data.notes,
      verified_by: auth.user.id,
      verified_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ item }));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audit } = await (supabase as any)
    .from("union_locker_audits")
    .select("delegation_id")
    .eq("id", id)
    .single();

  if (!audit) return noStore(NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 }));
  await requireUnionMembership(audit.delegation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("union_locker_audit_items")
    .select("result")
    .eq("audit_id", id);

  const total = (items ?? []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (items ?? []).filter((i: any) => i.result === "matches").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const empty = (items ?? []).filter((i: any) => i.result === "physically_empty").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diff = (items ?? []).filter((i: any) => i.result === "different_person").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const damaged = (items ?? []).filter((i: any) => i.result === "damaged").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unverified = (items ?? []).filter((i: any) => i.result === "unverified").length;

  const summary = { total, matches, empty, diff, damaged, unverified };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from("union_locker_audits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ audit: updated, summary }));
}
