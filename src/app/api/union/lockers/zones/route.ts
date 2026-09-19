import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const zoneCreateSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre de la zona es obligatorio").max(100),
  description: z.string().max(500).default(""),
  building: z.string().max(100).default(""),
  floor: z.string().max(100).default(""),
  sort_order: z.number().int().default(0),
});

const zoneUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  building: z.string().max(100).optional(),
  floor: z.string().max(100).optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
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
  const { data: zones, error } = await (supabase as any)
    .from("union_locker_zones")
    .select("*")
    .eq("delegation_id", depId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ zones: zones ?? [] }));
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = zoneCreateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const memberships = await requireUnionMembership(parsed.data.delegation_id);
  const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  await requireUnionAdmin(depId);
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: zone, error } = await (supabase as any)
    .from("union_locker_zones")
    .insert({
      delegation_id: depId,
      name: parsed.data.name,
      description: parsed.data.description,
      building: parsed.data.building,
      floor: parsed.data.floor,
      sort_order: parsed.data.sort_order,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ zone }));
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = zoneUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("union_locker_zones")
    .select("delegation_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return noStore(NextResponse.json({ error: "Zona no encontrada" }, { status: 404 }));
  await requireUnionAdmin(existing.delegation_id);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.building !== undefined) updates.building = parsed.data.building;
  if (parsed.data.floor !== undefined) updates.floor = parsed.data.floor;
  if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: zone, error } = await (supabase as any)
    .from("union_locker_zones")
    .update(updates)
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));
  return noStore(NextResponse.json({ zone }));
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return noStore(NextResponse.json({ error: "ID requerido" }, { status: 400 }));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("union_locker_zones")
    .select("delegation_id")
    .eq("id", id)
    .single();

  if (!existing) return noStore(NextResponse.json({ error: "Zona no encontrada" }, { status: 404 }));
  await requireUnionAdmin(existing.delegation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("union_locker_zones").delete().eq("id", id);
  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));

  return noStore(NextResponse.json({ success: true }));
}
