import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const createSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  worker_id: z.string().uuid(),
  notes: z.string().max(500).default(""),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["waiting", "assigned", "cancelled"]),
  priority_override: z.number().int().min(0).max(9999).nullable().optional(),
});

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
    const { data, error } = await supabase
      .from("union_locker_waitlist")
      .select("id, worker_id, requested_at, priority_override, status, notes")
      .eq("delegation_id", depId)
      .eq("status", "waiting")
      .order("requested_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const waitRows = ((data ?? []) as unknown) as Array<{ id: string; worker_id: string } & Record<string, unknown>>;
    const workerIds = [...new Set(waitRows.map((r) => r.worker_id))];
    let workerById = new Map<string, Record<string, unknown>>();
    if (workerIds.length > 0) {
      const { data: workers } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, maternal_surname, employee_number, turn")
        .in("id", workerIds);
      workerById = new Map((((workers ?? []) as unknown) as Array<{ id: string } & Record<string, unknown>>).map((w) => [w.id, w]));
    }
    return noStore(
      NextResponse.json({ waitlist: waitRows.map((r) => ({ ...r, union_workers: workerById.get(r.worker_id) ?? null })) }),
    );
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar lista de espera" }, { status: 500 }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    const memberships = await requireUnionMembership(parsed.data.delegation_id);
    const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("union_locker_waitlist")
      .insert({ delegation_id: depId, worker_id: parsed.data.worker_id, notes: parsed.data.notes ?? "", created_by: auth.user.id })
      .select("id")
      .single();
    if (error) throw error;
    await writeAuditLog({ delegation_id: depId, entity_type: "union_waitlist", entity_id: String((data as { id: string }).id), action: "waitlist.added", metadata: {} });
    return noStore(NextResponse.json({ id: (data as { id: string }).id }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo agregar a lista de espera" }, { status: 500 }));
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    const supabase = await createClient();
    const { data: existing } = await supabase.from("union_locker_waitlist").select("id, delegation_id").eq("id", parsed.data.id).single();
    if (!existing) return noStore(NextResponse.json({ error: "No encontrado" }, { status: 404 }));
    await requireUnionMembership((existing as { delegation_id: string }).delegation_id);
    const patch: { status: "waiting" | "assigned" | "cancelled"; updated_at: string; priority_override?: number | null } = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.priority_override !== undefined) patch.priority_override = parsed.data.priority_override;
    await supabase.from("union_locker_waitlist").update(patch).eq("id", parsed.data.id);
    await writeAuditLog({
      delegation_id: (existing as { delegation_id: string }).delegation_id,
      entity_type: "union_waitlist",
      entity_id: parsed.data.id,
      action: "waitlist.updated",
      metadata: { status: parsed.data.status, priority_override: parsed.data.priority_override ?? null },
    });
    return noStore(NextResponse.json({ ok: true }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 }));
  }
}
