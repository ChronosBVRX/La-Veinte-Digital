import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin } from "@/features/representacion/services/permissions";
import { generateStationToken } from "@/features/representacion/services/print-token";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateStationSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  printer_name: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
  regenerate_token: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await props.params;
    const body: unknown = await req.json();
    const parsed = updateStationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de actualización inválidos." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: station } = await supabase
      .from("union_print_stations")
      .select("id, delegation_id")
      .eq("id", id)
      .single();

    if (!station) {
      return NextResponse.json({ error: "Estación no encontrada." }, { status: 404 });
    }

    await requireUnionAdmin(station.delegation_id);

    const updatePayload: {
      updated_at: string;
      name?: string;
      printer_name?: string;
      is_active?: boolean;
      device_token_hash?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name.trim();
    if (parsed.data.printer_name !== undefined) updatePayload.printer_name = parsed.data.printer_name.trim();
    if (parsed.data.is_active !== undefined) updatePayload.is_active = parsed.data.is_active;

    let newRawToken: string | undefined;
    if (parsed.data.regenerate_token) {
      const generated = generateStationToken();
      updatePayload.device_token_hash = generated.tokenHash;
      newRawToken = generated.rawToken;
    }

    const { data: updated, error } = await supabase
      .from("union_print_stations")
      .update(updatePayload)
      .eq("id", id)
      .select("id, delegation_id, name, printer_name, is_active, last_seen_at, agent_version, updated_at")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || "No se pudo actualizar." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      station: updated,
      ...(newRawToken ? { raw_token: newRawToken } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar la estación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: station } = await supabase
      .from("union_print_stations")
      .select("id, delegation_id")
      .eq("id", id)
      .single();

    if (!station) {
      return NextResponse.json({ error: "Estación no encontrada." }, { status: 404 });
    }

    await requireUnionAdmin(station.delegation_id);

    const { error } = await supabase.from("union_print_stations").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar estación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
