import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StationAuthRecord {
  id: string;
  delegation_id: string;
  name: string;
  printer_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  agent_version: string | null;
}

/**
 * Genera un token criptográfico seguro de alta entropía para una estación de impresión.
 * El secreto crudo se muestra UNA SOLA VEZ al administrador en la interfaz.
 * En la base de datos se guarda únicamente el hash SHA-256.
 */
export function generateStationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashStationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Normaliza un código de vinculación de 6 dígitos removiendo espacios y guiones.
 */
export function normalizeEnrollmentCode(code: string): string {
  return code.replace(/[\s-]+/g, "").trim();
}

/**
 * Calcula el hash SHA-256 de un código de vinculación normalizado de 6 dígitos.
 */
export function hashEnrollmentCode(code: string): string {
  const normalized = normalizeEnrollmentCode(code);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Genera un código de vinculación corto de 6 dígitos numéricos aleatorios (ej. 482 731).
 * Válido por 10 minutos para emparejar la PC sin copiar tokens largos.
 */
export function generateEnrollmentCode(): {
  rawCode: string;
  formattedCode: string;
  codeHash: string;
} {
  const num = crypto.randomInt(100000, 1000000);
  const rawCode = num.toString();
  const formattedCode = `${rawCode.slice(0, 3)} ${rawCode.slice(3, 6)}`;
  const codeHash = hashEnrollmentCode(rawCode);
  return { rawCode, formattedCode, codeHash };
}

/**
 * Calcula el hash SHA-256 en formato hexadecimal de un token.
 */
export function hashStationToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Valida un token contra el hash esperado en tiempo constante (timing attack safe).
 */
export function timingSafeTokenMatch(providedToken: string, storedHash: string): boolean {
  if (!providedToken || !storedHash) return false;
  const providedHash = hashStationToken(providedToken);
  const bufA = Buffer.from(providedHash, "hex");
  const bufB = Buffer.from(storedHash, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extrae y valida el token de la estación a partir de los headers HTTP:
 * Soporta `x-station-token: <secret>` o `Authorization: Bearer <secret>`.
 */
export async function authenticatePrintStation(
  req: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<{ station: StationAuthRecord | null; errorResponse: NextResponse | null }> {
  let token = req.headers.get("x-station-token");

  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token || token.trim().length < 16) {
    return {
      station: null,
      errorResponse: NextResponse.json(
        { error: "Token de estación de impresión no proporcionado o inválido.", code: "STATION_UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  const hash = hashStationToken(token);

  const { data: station, error } = await supabase
    .from("union_print_stations")
    .select("id, delegation_id, name, printer_name, is_active, last_seen_at, agent_version")
    .eq("device_token_hash", hash)
    .single();

  if (error || !station) {
    return {
      station: null,
      errorResponse: NextResponse.json(
        { error: "Estación de impresión no autorizada o no encontrada.", code: "STATION_NOT_FOUND" },
        { status: 401 },
      ),
    };
  }

  if (!station.is_active) {
    return {
      station: null,
      errorResponse: NextResponse.json(
        { error: "La estación de impresión está desactivada.", code: "STATION_DISABLED" },
        { status: 403 },
      ),
    };
  }

  return {
    station: station as StationAuthRecord,
    errorResponse: null,
  };
}
