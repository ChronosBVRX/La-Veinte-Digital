import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { generateStationToken } from "@/features/representacion/services/print-token";
import { isStationOnline } from "@/features/representacion/services/print-jobs";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createStationSchema = z.object({
  delegation_id: z.string().uuid(),
  name: z.string().min(3).max(100),
  printer_name: z.string().max(100).optional().default(""),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get("delegation_id");

    const memberships = await requireUnionMembership(delegationId || undefined);
    const targetDelegationId = delegationId || memberships[0]?.delegation_id;

    if (!targetDelegationId) {
      return NextResponse.json({ error: "Delegación no especificada." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: stations, error } = await supabase
      .from("union_print_stations")
      .select("id, delegation_id, name, printer_name, is_active, last_seen_at, agent_version, created_at, updated_at")
      .eq("delegation_id", targetDelegationId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (stations || []).map((s) => ({
      ...s,
      is_online: isStationOnline(s.last_seen_at),
    }));

    return NextResponse.json({ success: true, stations: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al consultar estaciones de impresión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body: unknown = await req.json();
    const parsed = createStationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de estación inválidos." }, { status: 400 });
    }

    await requireUnionAdmin(parsed.data.delegation_id);

    const { rawToken, tokenHash } = generateStationToken();
    const supabase = await createClient();

    const { data: station, error } = await supabase
      .from("union_print_stations")
      .insert({
        delegation_id: parsed.data.delegation_id,
        name: parsed.data.name.trim(),
        printer_name: parsed.data.printer_name.trim(),
        device_token_hash: tokenHash,
        is_active: true,
      })
      .select("id, delegation_id, name, printer_name, is_active, created_at")
      .single();

    if (error || !station) {
      return NextResponse.json({ error: `Error al registrar la estación: ${error?.message}` }, { status: 500 });
    }

    // El token en texto plano SOLO se retorna una vez al crear la estación
    return NextResponse.json({
      success: true,
      station,
      raw_token: rawToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear la estación.";
    const status = message.includes("permisos") || message.includes("administrador") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
