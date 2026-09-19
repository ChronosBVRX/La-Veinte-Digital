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

const auditCreateSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional().nullable(),
  bank_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).default(""),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const delegationId = url.searchParams.get("delegation_id");
  const memberships = await requireUnionMembership(delegationId ?? undefined);
  const depId = delegationId ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audits, error } = await (supabase as any)
    .from("union_locker_audits")
    .select("*")
    .eq("delegation_id", depId)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ audits: audits ?? [] }));
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = auditCreateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const memberships = await requireUnionMembership(parsed.data.delegation_id);
  const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: audit, error } = await (supabase as any)
    .from("union_locker_audits")
    .insert({
      delegation_id: depId,
      zone_id: parsed.data.zone_id || null,
      bank_id: parsed.data.bank_id || null,
      started_by: auth.user.id,
      status: "in_progress",
      notes: parsed.data.notes,
    })
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ audit }));
}
