import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { generateEnrollmentCode } from "@/features/representacion/services/print-token";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const generateSchema = z.object({
  delegation_id: z.string().uuid(),
  station_name: z.string().min(2).max(100).optional().default("Oficina Sindical"),
  printer_name: z.string().max(100).optional().default(""),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de vinculación inválidos." }, { status: 400 });
    }

    const { delegation_id, station_name, printer_name } = parsed.data;

    // Verificar pertenencia activa a la delegación sindical
    await requireUnionMembership(delegation_id);

    const { rawCode, formattedCode, codeHash } = generateEnrollmentCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const supabase = await createClient();

    const { data: enrollment, error } = await supabase
      .from("union_print_enrollment_codes")
      .insert({
        delegation_id,
        code_hash: codeHash,
        station_name: station_name.trim(),
        printer_name: printer_name.trim(),
        expires_at: expiresAt,
        created_by: auth.user.id,
      })
      .select("id, delegation_id, expires_at, created_at")
      .single();

    if (error || !enrollment) {
      return NextResponse.json(
        { error: `Error al generar código de vinculación: ${error?.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      code: rawCode,
      formatted: formattedCode,
      expires_at: expiresAt,
      delegation_id,
      station_name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al generar código de vinculación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
