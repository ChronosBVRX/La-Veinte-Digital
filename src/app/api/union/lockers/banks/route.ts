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

const bankCreateSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  zone_id: z.string().uuid("Debe seleccionar una zona válida"),
  name: z.string().trim().min(1, "El nombre del bloque es obligatorio").max(100),
  description: z.string().max(500).default(""),
  rows: z.number().int().min(1, "Debe tener al menos 1 fila").max(30),
  columns: z.number().int().min(1, "Debe tener al menos 1 columna").max(30),
  sort_order: z.number().int().default(0),
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  // Opcional: Asignar lockers por rango
  range_assignment: z
    .object({
      start_number: z.number().int(),
      end_number: z.number().int(),
      order_direction: z.enum(["ltr_ttb", "ttb_ltr"]).default("ltr_ttb"), // left-to-right top-to-bottom vs top-to-bottom left-to-right
    })
    .optional(),
});

const bankUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  rows: z.number().int().min(1).max(30).optional(),
  columns: z.number().int().min(1).max(30).optional(),
  sort_order: z.number().int().optional(),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
  active: z.boolean().optional(),
  // Asignar o mover lockers dentro del bloque
  positions: z
    .array(
      z.object({
        locker_id: z.string().uuid(),
        row_position: z.number().int().min(1),
        column_position: z.number().int().min(1),
      })
    )
    .optional(),
  // Desvincular casilleros del bloque
  unassign_locker_ids: z.array(z.string().uuid()).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const delegationId = url.searchParams.get("delegation_id");
  const zoneId = url.searchParams.get("zone_id");

  const memberships = await requireUnionMembership(delegationId ?? undefined);
  const depId = delegationId ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("union_locker_banks")
    .select("*")
    .eq("delegation_id", depId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (zoneId) {
    query = query.eq("zone_id", zoneId);
  }

  const { data: banks, error } = await query;
  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));

  return noStore(NextResponse.json({ banks: banks ?? [] }));
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bankCreateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const memberships = await requireUnionMembership(parsed.data.delegation_id);
  const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  await requireUnionAdmin(depId);
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bank, error } = await (supabase as any)
    .from("union_locker_banks")
    .insert({
      delegation_id: depId,
      zone_id: parsed.data.zone_id,
      name: parsed.data.name,
      description: parsed.data.description,
      rows: parsed.data.rows,
      columns: parsed.data.columns,
      sort_order: parsed.data.sort_order,
      orientation: parsed.data.orientation,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));

  // Si se envió asignación por rango
  if (parsed.data.range_assignment && bank) {
    const { start_number, end_number, order_direction } = parsed.data.range_assignment;
    const count = end_number - start_number + 1;
    const maxPositions = parsed.data.rows * parsed.data.columns;

    if (count > 0) {
      // Buscar los casilleros que coincidan con esos números en la delegación
      const targetNumbers: string[] = [];
      for (let n = start_number; n <= end_number; n++) {
        targetNumbers.push(String(n));
      }

      const { data: matchedLockers } = await supabase
        .from("union_lockers")
        .select("id, locker_number")
        .eq("delegation_id", depId)
        .in("locker_number", targetNumbers);

      const lockersByNum = new Map((matchedLockers ?? []).map((l) => [l.locker_number, l.id]));

      let index = 0;
      if (order_direction === "ltr_ttb") {
        for (let r = 1; r <= parsed.data.rows; r++) {
          for (let c = 1; c <= parsed.data.columns; c++) {
            const num = start_number + index;
            if (num > end_number || index >= maxPositions) break;
            const lockerId = lockersByNum.get(String(num));
            if (lockerId) {
              await supabase
                .from("union_lockers")
                .update({
                  zone_id: parsed.data.zone_id,
                  bank_id: bank.id,
                  row_position: r,
                  column_position: c,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", lockerId);
            }
            index++;
          }
        }
      } else {
        // top-to-bottom, left-to-right
        for (let c = 1; c <= parsed.data.columns; c++) {
          for (let r = 1; r <= parsed.data.rows; r++) {
            const num = start_number + index;
            if (num > end_number || index >= maxPositions) break;
            const lockerId = lockersByNum.get(String(num));
            if (lockerId) {
              await supabase
                .from("union_lockers")
                .update({
                  zone_id: parsed.data.zone_id,
                  bank_id: bank.id,
                  row_position: r,
                  column_position: c,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", lockerId);
            }
            index++;
          }
        }
      }
    }
  }

  return noStore(NextResponse.json({ bank }));
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bankUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("union_locker_banks")
    .select("delegation_id, zone_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) return noStore(NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 }));
  await requireUnionAdmin(existing.delegation_id);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.rows !== undefined) updates.rows = parsed.data.rows;
  if (parsed.data.columns !== undefined) updates.columns = parsed.data.columns;
  if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order;
  if (parsed.data.orientation !== undefined) updates.orientation = parsed.data.orientation;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bank, error } = await (supabase as any)
    .from("union_locker_banks")
    .update(updates)
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));

  // Actualizar posiciones de casilleros si se enviaron
  if (parsed.data.positions && parsed.data.positions.length > 0) {
    for (const pos of parsed.data.positions) {
      await supabase
        .from("union_lockers")
        .update({
          zone_id: existing.zone_id,
          bank_id: parsed.data.id,
          row_position: pos.row_position,
          column_position: pos.column_position,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pos.locker_id);
    }
  }

  // Desvincular casilleros si se enviaron
  if (parsed.data.unassign_locker_ids && parsed.data.unassign_locker_ids.length > 0) {
    await supabase
      .from("union_lockers")
      .update({
        bank_id: null,
        row_position: null,
        column_position: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", parsed.data.unassign_locker_ids);
  }

  return noStore(NextResponse.json({ bank }));
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
    .from("union_locker_banks")
    .select("delegation_id")
    .eq("id", id)
    .single();

  if (!existing) return noStore(NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 }));
  await requireUnionAdmin(existing.delegation_id);

  // Desvincular lockers antes de borrar el bloque
  await supabase
    .from("union_lockers")
    .update({ bank_id: null, row_position: null, column_position: null, updated_at: new Date().toISOString() })
    .eq("bank_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("union_locker_banks").delete().eq("id", id);
  if (error) return noStore(NextResponse.json({ error: error.message }, { status: 500 }));

  return noStore(NextResponse.json({ success: true }));
}
