// Cliente HTTP server-side y sincronizador para el sistema CAV v1.0 (HGR No. 1 - 11.1.17.44:8080)
// Conecta la base de datos de estacionamiento del hospital con el Padrón Sindical (union_workers).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { fetchAllSupabaseRows } from "@/shared/lib/supabase-pagination";
import {
  getCavAreaLabel,
  getCavParkingLotCode,
  getCavVehicleModelLabel,
  CAV_HGR1_UNIT_CODE,
} from "./catalogs";
import {
  normalizeMatricula,
  parseBuscarRegistroRows,
  parseConfigUsuarioDetail,
  parseLoginSessionId,
  parseWorkerLookupResponse,
  type CavRecordDetail,
  type CavSearchRow,
  type CavWorkerLookup,
} from "./cav-hgr1-parser";

export interface CavConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

export function getCavConfig(timeoutMs = 8000): CavConfig {
  return {
    baseUrl: (process.env.CAV_HGR1_BASE_URL ?? "http://11.1.17.44:8080/acceso-hgr1").replace(/\/+$/, ""),
    username: process.env.CAV_HGR1_USERNAME ?? "",
    password: process.env.CAV_HGR1_PASSWORD ?? "",
    timeoutMs,
  };
}

export interface CavSession {
  cookie: string;
  userSess: string;
  baseUrl: string;
}

export interface CavCreateInput {
  matricula: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  cargo: string;
  area_code: string;
  placas: string;
  vehicle_model_id: number;
  parking_lot: "1" | "2" | "3";
  cajon_number: string;
  shift: "M" | "V" | "N" | "A";
  email?: string;
}

export interface CavUpdateInput {
  external_id_reg: number;
  matricula: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  cargo: string;
  area_code: string;
  placas: string;
  vehicle_model_id: number;
  parking_lot: "1" | "2" | "3";
  shift: "M" | "V" | "N" | "A";
  email?: string;
}

export interface UnionWorkerMatchCandidate {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  category: string;
  assignment: string;
  turn: string;
  active: boolean;
}

export interface LinkedParkingRecordPayload {
  delegation_id: string;
  external_id_reg: number;
  worker_id: string | null;
  matricula: string;
  full_name: string;
  area_code: string;
  area_label: string;
  placas: string;
  parking_lot: string;
  cajon_number: string;
  status: "A" | "X";
  internal_status: "activo" | "suspendido" | "baja";
  last_synced_at: string;
}

/**
 * Cruza registros extraídos de CAV HGR 1 con los trabajadores del Padrón Sindical
 * por matrícula normalizada (`employee_number`).
 */
export function linkParkingRowsWithWorkers(
  delegationId: string,
  cavRows: CavSearchRow[],
  workers: Array<{ id: string; employee_number: string }>,
  existingByExternalId?: Map<number, { internal_status: string; worker_id: string | null }>,
  nowIso = new Date().toISOString(),
): LinkedParkingRecordPayload[] {
  const workerIdByMatricula = new Map<string, string>();
  for (const w of workers) {
    const norm = normalizeMatricula(w.employee_number);
    if (norm && !workerIdByMatricula.has(norm)) {
      workerIdByMatricula.set(norm, w.id);
    }
  }

  return cavRows.map((row) => {
    const normMat = normalizeMatricula(row.matricula);
    const matchedWorkerId = normMat ? (workerIdByMatricula.get(normMat) ?? null) : null;
    const existing = existingByExternalId?.get(row.external_id_reg);
    const workerId = matchedWorkerId ?? existing?.worker_id ?? null;

    let internalStatus: "activo" | "suspendido" | "baja" = row.status === "A" ? "activo" : "suspendido";
    if (row.status === "X" && existing?.internal_status === "baja") {
      internalStatus = "baja";
    }

    return {
      delegation_id: delegationId,
      external_id_reg: row.external_id_reg,
      worker_id: workerId,
      matricula: normMat || row.matricula,
      full_name: row.full_name,
      area_code: row.area_code,
      area_label: row.area_label || getCavAreaLabel(row.area_code),
      placas: row.placas.toUpperCase(),
      parking_lot: getCavParkingLotCode(row.parking_lot),
      cajon_number: row.cajon_number,
      status: row.status,
      internal_status: internalStatus,
      last_synced_at: nowIso,
    };
  });
}

function encodeFormBody(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, v);
  }
  return sp.toString();
}

async function fetchLatin1Html(url: string, init: RequestInit, timeoutMs: number): Promise<{ html: string; setCookie: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al conectar con CAV HGR 1 (${url})`);
    }
    const setCookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const buf = Buffer.from(await res.arrayBuffer());
    const html = buf.toString("latin1");
    return { html, setCookie };
  } finally {
    clearTimeout(timer);
  }
}

export async function loginToCavHgr1(customTimeoutMs?: number): Promise<CavSession> {
  const cfg = getCavConfig(customTimeoutMs);
  if (!cfg.username || !cfg.password) {
    throw new Error("CAV_CREDENTIALS_NOT_CONFIGURED: CAV_HGR1_USERNAME y CAV_HGR1_PASSWORD son requeridos.");
  }
  const { html, setCookie } = await fetchLatin1Html(
    `${cfg.baseUrl}/validar.php`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeFormBody({
        SD0: cfg.username,
        SD1: cfg.password,
      }),
    },
    cfg.timeoutMs,
  );

  const userSess = parseLoginSessionId(html) ?? "16";
  return {
    cookie: setCookie,
    userSess,
    baseUrl: cfg.baseUrl,
  };
}

export async function checkCavConnection(): Promise<{
  reachable: boolean;
  baseUrl: string;
  userSess?: string;
  error?: string;
}> {
  const cfg = getCavConfig(4500);
  try {
    const session = await loginToCavHgr1(4500);
    return {
      reachable: true,
      baseUrl: cfg.baseUrl,
      userSess: session.userSess,
    };
  } catch (err: unknown) {
    return {
      reachable: false,
      baseUrl: cfg.baseUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchCavAllRecords(
  lots: ReadonlyArray<"1" | "2" | "3"> = ["1", "2", "3"],
): Promise<CavSearchRow[]> {
  const session = await loginToCavHgr1(10000);
  const byId = new Map<number, CavSearchRow>();

  for (const lot of lots) {
    const { html } = await fetchLatin1Html(
      `${session.baseUrl}/dashboard/plataforma/buscar_registro.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          UserSess: session.userSess,
          SD0: session.userSess,
          SD1: "",
          SD2: "",
          dt1: "*",
          dt2: lot,
          dt3: CAV_HGR1_UNIT_CODE,
        }),
      },
      12000,
    );
    const rows = parseBuscarRegistroRows(html);
    for (const r of rows) {
      byId.set(r.external_id_reg, r);
    }
  }

  return [...byId.values()];
}

export async function fetchCavRecordDetail(externalIdReg: number): Promise<CavRecordDetail | null> {
  const session = await loginToCavHgr1(8000);
  const { html } = await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/config_usuarios.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        UserSess: session.userSess,
        SD0: session.userSess,
        SD1: "",
        SD2: String(externalIdReg),
      }),
    },
    8000,
  );
  return parseConfigUsuarioDetail(html);
}

export async function lookupWorkerInCav(matricula: string): Promise<CavWorkerLookup | null> {
  const session = await loginToCavHgr1(6000);
  const { html } = await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/consultas/list_trab.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        Data_M: normalizeMatricula(matricula),
      }),
    },
    6000,
  );
  return parseWorkerLookupResponse(html);
}

export async function createCavRecord(input: CavCreateInput): Promise<{
  external_id_reg: number | null;
  detail: CavSearchRow | null;
}> {
  const session = await loginToCavHgr1(8000);
  const normMatricula = normalizeMatricula(input.matricula);
  const normPlacas = input.placas.trim().toUpperCase();

  await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/mysql/insert_cajon_estacionamiento.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        dt1: normPlacas,
        dt2: input.nombre.trim().toUpperCase(),
        dt3: (input.email ?? "").trim(),
        dt4: input.cargo.trim().toUpperCase(),
        dt5: input.area_code.trim(),
        dt6: String(input.vehicle_model_id || 376),
        dt7: CAV_HGR1_UNIT_CODE,
        dt8: input.apellido_paterno.trim().toUpperCase(),
        dt9: input.apellido_materno.trim().toUpperCase(),
        dt10: "",
        dt11: input.parking_lot,
        dt12: normMatricula,
        dt13: (input.cajon_number || "0").trim(),
        dt14: input.shift,
        dt15: "",
      }),
    },
    8000,
  );

  // Consultar buscar_registro.php en ese estacionamiento para recuperar el nuevo IDReg
  const { html } = await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/buscar_registro.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        UserSess: session.userSess,
        SD0: session.userSess,
        SD1: "",
        SD2: "",
        dt1: "*",
        dt2: input.parking_lot,
        dt3: CAV_HGR1_UNIT_CODE,
      }),
    },
    10000,
  );

  const rows = parseBuscarRegistroRows(html);
  const matching = rows
    .filter(
      (r) =>
        (normMatricula && r.matricula === normMatricula) ||
        (normPlacas && r.placas.toUpperCase() === normPlacas),
    )
    .sort((a, b) => b.external_id_reg - a.external_id_reg);

  const created = matching[0] ?? null;
  return {
    external_id_reg: created?.external_id_reg ?? null,
    detail: created,
  };
}

export async function updateCavRecord(input: CavUpdateInput): Promise<void> {
  const session = await loginToCavHgr1(8000);
  await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/mysql/update_cajon_estacionamiento.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        dt1: input.placas.trim().toUpperCase(),
        dt2: input.nombre.trim().toUpperCase(),
        dt3: (input.email ?? "").trim(),
        dt4: input.cargo.trim().toUpperCase(),
        dt5: input.area_code.trim(),
        dt6: String(input.vehicle_model_id || 376),
        dt7: input.shift,
        dt8: input.apellido_paterno.trim().toUpperCase(),
        dt9: input.apellido_materno.trim().toUpperCase(),
        dt10: String(input.external_id_reg),
        dt11: input.parking_lot,
        dt12: normalizeMatricula(input.matricula),
      }),
    },
    8000,
  );
}

export async function setCavRecordStatus(externalIdReg: number, status: "A" | "X"): Promise<void> {
  const session = await loginToCavHgr1(8000);
  await fetchLatin1Html(
    `${session.baseUrl}/dashboard/plataforma/mysql/update_campo.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        SD0: String(externalIdReg),
        SD1: status,
      }),
    },
    8000,
  );
}

export async function fetchCavQrPdfBuffer(externalIdReg: number): Promise<Buffer> {
  const session = await loginToCavHgr1(8000);
  // Paso 1: Generar código QR encriptado en el servidor CAV HGR 1
  await fetchLatin1Html(
    `${session.baseUrl}/dashboard/fpdf/print/gen_code_qr_encript_hgr1.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        UserSess: session.userSess,
        SD0: session.userSess,
        SD1: "1",
        SD2: String(externalIdReg),
        NumRep: "1",
      }),
    },
    8000,
  );

  // Paso 2: Descargar el PDF oficial generado por FPDF
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${session.baseUrl}/dashboard/fpdf/print/pdf_id_acceso_hgr1.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: encodeFormBody({
        NumRep: "1",
        dtf1: "1",
        dtf2: String(externalIdReg),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al generar el PDF QR en CAV HGR 1`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export function buildRecordDisplayFields(row: {
  area_code?: string | null;
  area_label?: string | null;
  vehicle_model_id?: number | null;
  vehicle_model_label?: string | null;
}) {
  return {
    area_label: row.area_label || getCavAreaLabel(row.area_code),
    vehicle_model_label: row.vehicle_model_label || getCavVehicleModelLabel(row.vehicle_model_id),
  };
}

export type CavBridgeAction =
  | "sync_all"
  | "create"
  | "update"
  | "toggle_status"
  | "download_qr"
  | "detail"
  | "lookup_worker";

export interface ParkingBridgeStationStatus {
  stationOnline: boolean;
  bridgeCapable: boolean;
  stationName: string | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
}

export async function getParkingBridgeStatus(
  supabase: SupabaseClient<Database>,
  delegationId: string,
): Promise<ParkingBridgeStationStatus> {
  const { data: station } = await supabase
    .from("union_print_stations")
    .select("id, name, is_active, last_seen_at, agent_version")
    .eq("delegation_id", delegationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!station) {
    return {
      stationOnline: false,
      bridgeCapable: false,
      stationName: null,
      agentVersion: null,
      lastSeenAt: null,
    };
  }

  const lastSeenMs = station.last_seen_at ? Date.now() - new Date(station.last_seen_at).getTime() : Infinity;
  const stationOnline = lastSeenMs <= 90_000;
  const versionStr = station.agent_version ?? "1.0.0";
  const [majorStr = "1", minorStr = "0"] = versionStr.replace(/^v/i, "").split(".");
  const major = Number(majorStr) || 1;
  const minor = Number(minorStr) || 0;
  const bridgeCapable = major > 1 || (major === 1 && minor >= 1);

  return {
    stationOnline,
    bridgeCapable,
    stationName: station.name,
    agentVersion: station.agent_version,
    lastSeenAt: station.last_seen_at,
  };
}

export async function upsertCavRowsToSupabase(
  supabase: SupabaseClient<Database>,
  delegationId: string,
  cavRows: CavSearchRow[],
): Promise<{
  total_cav_rows: number;
  linked_workers_count: number;
  unlinked_count: number;
  synced_at: string;
}> {
  const nowIso = new Date().toISOString();
  if (cavRows.length === 0) {
    return {
      total_cav_rows: 0,
      linked_workers_count: 0,
      unlinked_count: 0,
      synced_at: nowIso,
    };
  }

  const [workersData, existingData] = await Promise.all([
    fetchAllSupabaseRows<{ id: string; employee_number: string }>(
      ({ from, to }) =>
        supabase
          .from("union_workers")
          .select("id, employee_number")
          .eq("delegation_id", delegationId)
          .neq("source_import_state", "rolled_back")
          .range(from, to),
      { pageSize: 1000 },
    ),
    fetchAllSupabaseRows<{ external_id_reg: number; internal_status: string; worker_id: string | null }>(
      ({ from, to }) =>
        supabase
          .from("union_parking_records")
          .select("external_id_reg, internal_status, worker_id")
          .eq("delegation_id", delegationId)
          .range(from, to),
      { pageSize: 1000 },
    ),
  ]);

  const existingMap = new Map<number, { internal_status: string; worker_id: string | null }>();
  for (const row of existingData) {
    existingMap.set(row.external_id_reg, {
      internal_status: row.internal_status,
      worker_id: row.worker_id,
    });
  }

  const linkedPayloads = linkParkingRowsWithWorkers(
    delegationId,
    cavRows,
    workersData,
    existingMap,
    nowIso,
  );

  const batchSize = 400;
  for (let i = 0; i < linkedPayloads.length; i += batchSize) {
    const batch = linkedPayloads.slice(i, i + batchSize);
    const { error: upsertErr } = await supabase
      .from("union_parking_records")
      .upsert(batch, { onConflict: "delegation_id,external_id_reg" });

    if (upsertErr) {
      throw new Error(`Error al sincronizar lote de estacionamiento: ${upsertErr.message}`);
    }
  }

  const linkedCount = linkedPayloads.filter((p) => p.worker_id !== null).length;
  return {
    total_cav_rows: linkedPayloads.length,
    linked_workers_count: linkedCount,
    unlinked_count: linkedPayloads.length - linkedCount,
    synced_at: nowIso,
  };
}

async function notifyParkingBridgeRealtime(delegationId: string, requestId: string): Promise<void> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !anonKey) return;

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `parking-bridge:${delegationId}`,
            event: "parking-wake",
            payload: { request_id: requestId, ts: Date.now() },
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    // Fallback automático por latido si el broadcast falla
  }
}

export async function dispatchCavBridgeCommand<TResult = Record<string, unknown>>(
  supabase: SupabaseClient<Database>,
  params: {
    delegationId: string;
    action: CavBridgeAction;
    payload: Record<string, unknown>;
    userId?: string | null;
    timeoutMs?: number;
    leaveQueuedOnTimeout?: boolean;
  },
): Promise<{
  executedLive: boolean;
  queued: boolean;
  requestId: string;
  result?: TResult;
  stationStatus: ParkingBridgeStationStatus;
}> {
  const stationStatus = await getParkingBridgeStatus(supabase, params.delegationId);

  const { data: inserted, error: insertErr } = await supabase
    .from("union_parking_bridge_requests")
    .insert({
      delegation_id: params.delegationId,
      action: params.action,
      payload: params.payload as unknown as Json,
      status: "pending",
      created_by: params.userId ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new Error(`No se pudo registrar la solicitud en el Puente en Vivo: ${insertErr?.message ?? "Error"}`);
  }

  const requestId = inserted.id;
  // Despertar al instante al Print Agent vía WebSocket Broadcast (0 consultas extra en reposo)
  void notifyParkingBridgeRealtime(params.delegationId, requestId);

  const canWaitLive = stationStatus.stationOnline && stationStatus.bridgeCapable;
  const maxWaitMs = canWaitLive ? (params.timeoutMs ?? 30_000) : 900;
  const startedAt = Date.now();
  let checkCount = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    const delayMs = checkCount === 0 ? 450 : 650;
    checkCount += 1;
    await new Promise((r) => setTimeout(r, delayMs));
    const { data: current } = await supabase
      .from("union_parking_bridge_requests")
      .select("status, result, error_message")
      .eq("id", requestId)
      .maybeSingle();

    if (!current) break;
    if (current.status === "completed") {
      return {
        executedLive: true,
        queued: false,
        requestId,
        result: (current.result ?? {}) as unknown as TResult,
        stationStatus,
      };
    }
    if (current.status === "failed") {
      throw new Error(current.error_message || "El Puente en Vivo reportó un error al operar en CAV HGR 1.");
    }
  }

  if (params.leaveQueuedOnTimeout === false) {
    await supabase
      .from("union_parking_bridge_requests")
      .update({
        status: "failed",
        error_message: "Tiempo de espera agotado esperando respuesta del agente de oficina.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    return {
      executedLive: false,
      queued: false,
      requestId,
      stationStatus,
    };
  }

  return {
    executedLive: false,
    queued: true,
    requestId,
    stationStatus,
  };
}

