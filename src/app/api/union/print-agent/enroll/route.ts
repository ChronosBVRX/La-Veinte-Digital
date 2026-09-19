import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hashEnrollmentCode,
  normalizeEnrollmentCode,
  generateStationToken,
} from "@/features/representacion/services/print-token";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const enrollSchema = z.object({
  code: z.string().min(6).max(10),
  hostname: z.string().max(100).optional(),
  printer_name: z.string().max(100).optional(),
  agent_version: z.string().max(30).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body: unknown = await req.json().catch(() => ({}));
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Por favor introduce un código de 6 dígitos válido.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const rawInput = parsed.data.code;
    const normalized = normalizeEnrollmentCode(rawInput);

    if (!/^\d{6}$/.test(normalized)) {
      return NextResponse.json(
        { error: "El código debe contener exactamente 6 números (ej. 482 731).", code: "INVALID_FORMAT" },
        { status: 400 },
      );
    }

    const hash = hashEnrollmentCode(normalized);
    const nowIso = new Date().toISOString();

    const supabase = await createClient();

    // 1. Buscar código activo, no usado y no expirado
    const { data: enrollment, error: findError } = await supabase
      .from("union_print_enrollment_codes")
      .select("id, delegation_id, station_name, printer_name, expires_at, used_at")
      .eq("code_hash", hash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !enrollment) {
      return NextResponse.json(
        {
          error: "Código de vinculación inválido, expirado o ya utilizado. Genera uno nuevo en el portal web.",
          code: "ENROLLMENT_EXPIRED_OR_INVALID",
        },
        { status: 400 },
      );
    }

    // 2. Marcar atómicamente el código como utilizado para prevenir reutilización
    const { error: markError } = await supabase
      .from("union_print_enrollment_codes")
      .update({ used_at: nowIso })
      .eq("id", enrollment.id)
      .is("used_at", null);

    if (markError) {
      return NextResponse.json(
        { error: "No se pudo procesar la vinculación. Intenta de nuevo.", code: "ENROLLMENT_RACE" },
        { status: 409 },
      );
    }

    // 3. Generar nuevo token seguro de alta entropía (64 caracteres)
    const { rawToken, tokenHash } = generateStationToken();
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const preferredPrinter = (parsed.data.printer_name || enrollment.printer_name || "").trim();
    const stationName = (enrollment.station_name || "Oficina Sindical").trim();
    const agentVersion = (parsed.data.agent_version || "1.0.0").trim();

    // 4. Buscar estación existente en la delegación o crear una nueva
    const { data: existingStations } = await supabase
      .from("union_print_stations")
      .select("id, name, printer_name")
      .eq("delegation_id", enrollment.delegation_id)
      .order("created_at", { ascending: true })
      .limit(1);

    let stationId: string;
    let finalStationName = stationName;

    if (existingStations && existingStations.length > 0) {
      const existing = existingStations[0];
      stationId = existing.id;
      finalStationName = existing.name || stationName;

      await supabase
        .from("union_print_stations")
        .update({
          device_token_hash: tokenHash,
          printer_name: preferredPrinter || existing.printer_name,
          agent_version: agentVersion,
          last_seen_at: nowIso,
          ip_address: clientIp,
          is_active: true,
          updated_at: nowIso,
        })
        .eq("id", stationId);
    } else {
      const { data: newStation, error: createError } = await supabase
        .from("union_print_stations")
        .insert({
          delegation_id: enrollment.delegation_id,
          name: stationName,
          printer_name: preferredPrinter,
          device_token_hash: tokenHash,
          agent_version: agentVersion,
          last_seen_at: nowIso,
          ip_address: clientIp,
          is_active: true,
        })
        .select("id, name")
        .single();

      if (createError || !newStation) {
        return NextResponse.json(
          { error: `Error al registrar estación: ${createError?.message}` },
          { status: 500 },
        );
      }

      stationId = newStation.id;
      finalStationName = newStation.name;
    }

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || (hostHeader.includes("localhost") ? "http" : "https");
    const serverUrl = hostHeader ? `${proto}://${hostHeader}` : (process.env.NEXT_PUBLIC_APP_URL || "https://la20.com.mx");

    return NextResponse.json({
      success: true,
      station_id: stationId,
      station_name: finalStationName,
      delegation_id: enrollment.delegation_id,
      token: rawToken,
      printer_name: preferredPrinter,
      server_url: serverUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado al vincular la estación.";
    return NextResponse.json({ error: message, code: "SERVER_ERROR" }, { status: 500 });
  }
}
