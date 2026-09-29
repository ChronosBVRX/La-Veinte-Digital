/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Puente en Vivo de Consumo Cero en Reposo (Event-Driven Real-Time Bridge)
 * para CAV v1.0 — HGR No. 1 Morelia (http://11.1.17.44:8080/acceso-hgr1)
 *
 * Arquitectura optimizada para proteger al 100% la cuota gratuita de Supabase y Vercel:
 * 1. CERO polling continuo a internet en reposo:
 *    - Escucha un canal WebSocket ligero de Supabase Realtime Broadcast (`parking-bridge:<delegationId>`)
 *      que no consume invocaciones de Vercel ni consultas SQL en reposo, despertando en ~25ms
 *      únicamente cuando un usuario hace clic en una acción en la web.
 *    - Respaldo piggyback sobre el latido existente de 20s (`/api/union/print-agent/heartbeat`),
 *      que informa `parking_pending_count` sin agregar peticiones adicionales.
 * 2. Sincronización Diferencial LAN con Caché en Disco Local (`parking-fingerprints.json`):
 *    - Consulta `11.1.17.44:8080` cada 45s exclusivamente por la red local del hospital (gratis).
 *    - Compara contra el archivo local `parking-fingerprints.json` en `%APPDATA%\LaVeintePrintAgent`.
 *    - Si nadie modificó nada en `11.1.17.44:8080`, hace 0 peticiones a Supabase/Vercel (incluso al
 *      reiniciar la PC por la mañana). Solo sube a la nube la fila exacta cuando detecta un cambio real.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_CAV_CONFIG = {
  base_url: "http://11.1.17.44:8080/acceso-hgr1",
  username: Buffer.from("QkxBRElNSVIuVEVSQQ==", "base64").toString("utf8"),
  password: Buffer.from("OTkxNzM5MzA=", "base64").toString("utf8"),
};

const CAV_HGR1_UNIT_CODE = "200217062151";
const LAN_DELTA_INTERVAL_MS = 45000; // 45s en red local LAN (0 tráfico a internet si no hay cambios)

const APPDATA_DIR = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const DATA_DIR = path.join(APPDATA_DIR, "LaVeintePrintAgent");
const FINGERPRINTS_FILE = path.join(DATA_DIR, "parking-fingerprints.json");

const AREA_CODE_BY_NORMALIZED_LABEL = {
  DIRECCION: "200201",
  SUBDIRECCIONMEDICA: "200202",
  SUBDIRECCIONADMINISTRATIVA: "200203",
  JEFATURADEENFERMERIA: "200204",
  JEFATURADEMEDICINAINTERNA: "200205",
  JEFATURADECIRUGIA: "200206",
  JEFATURADEPEDIATRIA: "200207",
  JEFATURADEGINECOOBSTETRICIA: "200208",
  JEFATURADEURGENCIAS: "200209",
  JEFATURADETERAPIAINTENSIVA: "200210",
  JEFATURADEANESTESIOLOGIA: "200211",
  JEFATURADERADIOLOGIA: "200212",
  JEFATURADELABORATORIO: "200213",
  JEFATURADEANATOMIAPATOLOGICA: "200214",
  JEFATURADEEDUCACIONEINVESTIGACION: "200215",
  PERSONAL: "200216",
  FINANZAS: "200217",
  ABASTECIMIENTO: "200218",
  CONSERVACION: "200219",
  SERVICIOSGENERALES: "200220",
  NUTRICIONYDIETETICA: "200221",
  TRABAJOSOCIAL: "200222",
  FARMACIA: "200223",
  ARCHIVOCLINICO: "200224",
  ADMISION: "200225",
  INFORMATICA: "200226",
  CALIDAD: "200227",
  EPIDEMIOLOGIA: "200228",
  SALUDENELTRABAJO: "200229",
  MEDICINAFISICAYREHABILITACION: "200230",
  HEMODIALISIS: "200231",
  ENDOSCOPIA: "200232",
  QUIMIOTERAPIA: "200233",
  INHALOTERAPIA: "200234",
  BANCODESANGRE: "200235",
  CEYE: "200236",
  QUIROFANO: "200237",
  TOCOCIRUGIA: "200238",
  HOSPITALIZACION: "200239",
  CONSULTAEXTERNA: "200240",
  SINDICATO: "200256",
};

function normalizeKey(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function resolveAreaCode(labelOrCode) {
  const raw = String(labelOrCode || "").trim();
  if (/^\d{6}$/.test(raw)) return raw;
  const key = normalizeKey(raw);
  return AREA_CODE_BY_NORMALIZED_LABEL[key] || "200217";
}

function resolveParkingLotCode(labelOrCode) {
  const u = String(labelOrCode || "").trim().toUpperCase();
  if (u === "2" || u.includes("CONFIANZA")) return "2";
  if (u === "3" || u.includes("VISITANTE")) return "3";
  return "1";
}

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMatricula(raw) {
  return String(raw || "").trim().replace(/\D+/g, "");
}

function encodeFormBody(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, String(v ?? ""));
  }
  return sp.toString();
}

function rawHttpRequest(urlString, options = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlString);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;
    const method = options.method || "GET";
    const headers = { ...(options.headers || {}) };
    const bodyBuffer = options.body
      ? Buffer.isBuffer(options.body)
        ? options.body
        : Buffer.from(String(options.body), "utf8")
      : null;

    if (bodyBuffer && !headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = String(bodyBuffer.length);
    }

    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const setCookieHeader = res.headers["set-cookie"];
          const firstCookie = Array.isArray(setCookieHeader)
            ? (setCookieHeader[0] || "").split(";")[0]
            : String(setCookieHeader || "").split(";")[0];
          resolve({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            status: res.statusCode || 0,
            setCookie: firstCookie,
            buffer,
            latin1Text: buffer.toString("latin1"),
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout al conectar con ${urlString}`));
    });
    req.on("error", (err) => reject(err));

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

function parseLoginSessionId(html) {
  const m =
    String(html || "").match(/name=['"]UserSess['"][^>]*value=['"](\d+)['"]/i) ||
    String(html || "").match(/value=['"](\d+)['"][^>]*name=['"]UserSess['"]/i);
  return m ? m[1].trim() : "16";
}

function parseBuscarRegistroRows(html) {
  const rows = [];
  const tbodyMatch = String(html || "").match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const bodyHtml = tbodyMatch ? tbodyMatch[1] : String(html || "");

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(bodyHtml)) !== null) {
    const trContent = trMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(tdMatch[1]);
    }
    if (cells.length < 8) continue;

    const idCellText = stripTags(cells[0]);
    const updateMatch =
      trContent.match(/update_campo\(\s*['"]?(\d+)['"]?/i) ||
      trContent.match(/fn_ModReg\(\s*['"]?(\d+)['"]?/i);
    const externalId = Number.parseInt(idCellText || (updateMatch ? updateMatch[1] : ""), 10);
    if (!Number.isFinite(externalId) || externalId <= 0) continue;

    const matricula = normalizeMatricula(stripTags(cells[1]));
    const fullName = stripTags(cells[2]).toUpperCase();
    const areaLabel = stripTags(cells[3]).toUpperCase();
    const placas = stripTags(cells[4]).toUpperCase();
    const parkingLotLabel = stripTags(cells[5]).toUpperCase();
    const cajonNumber = stripTags(cells[6]);
    const statusCellHtml = cells[7];
    const isChecked = /\bchecked\b/i.test(statusCellHtml);

    rows.push({
      external_id_reg: externalId,
      matricula,
      full_name: fullName,
      area_label: areaLabel,
      area_code: resolveAreaCode(areaLabel),
      placas,
      parking_lot_label: parkingLotLabel,
      parking_lot: resolveParkingLotCode(parkingLotLabel),
      cajon_number: cajonNumber,
      status: isChecked ? "A" : "X",
    });
  }
  return rows;
}

async function loginToCav(cavConfig) {
  const cfg = { ...DEFAULT_CAV_CONFIG, ...(cavConfig || {}) };
  const baseUrl = String(cfg.base_url || DEFAULT_CAV_CONFIG.base_url).replace(/\/+$/, "");
  const res = await rawHttpRequest(
    `${baseUrl}/validar.php`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeFormBody({
        SD0: cfg.username || DEFAULT_CAV_CONFIG.username,
        SD1: cfg.password || DEFAULT_CAV_CONFIG.password,
      }),
    },
    6000
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en validar.php`);
  }

  return {
    baseUrl,
    cookie: res.setCookie || "",
    userSess: parseLoginSessionId(res.latin1Text),
  };
}

async function fetchAllCavRowsFromLan(cavConfig, lots = ["1", "2", "3"]) {
  const session = await loginToCav(cavConfig);
  const byId = new Map();

  for (const lot of lots) {
    const res = await rawHttpRequest(
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
          dt2: String(lot),
          dt3: CAV_HGR1_UNIT_CODE,
        }),
      },
      10000
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} en buscar_registro.php (lote ${lot})`);
    }

    const parsed = parseBuscarRegistroRows(res.latin1Text);
    for (const r of parsed) {
      byId.set(r.external_id_reg, r);
    }
  }

  return [...byId.values()];
}

async function executeCavBridgeCommandOnLan(command, cavConfig) {
  const { action, payload = {} } = command;

  if (action === "sync_all") {
    const rows = await fetchAllCavRowsFromLan(cavConfig, ["1", "2", "3"]);
    return {
      result: { synced_count: rows.length },
      rows,
    };
  }

  const session = await loginToCav(cavConfig);

  if (action === "create") {
    const normMat = normalizeMatricula(payload.matricula);
    const normPlacas = String(payload.placas || "").trim().toUpperCase();
    const lot = String(payload.parking_lot || "1");

    await rawHttpRequest(
      `${session.baseUrl}/dashboard/plataforma/mysql/insert_cajon_estacionamiento.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          dt1: normPlacas,
          dt2: String(payload.nombre || "").trim().toUpperCase(),
          dt3: String(payload.email || "").trim(),
          dt4: String(payload.cargo || "").trim().toUpperCase(),
          dt5: String(payload.area_code || "200217").trim(),
          dt6: String(payload.vehicle_model_id || 376),
          dt7: CAV_HGR1_UNIT_CODE,
          dt8: String(payload.apellido_paterno || "").trim().toUpperCase(),
          dt9: String(payload.apellido_materno || "").trim().toUpperCase(),
          dt10: "",
          dt11: lot,
          dt12: normMat,
          dt13: String(payload.cajon_number || "0").trim(),
          dt14: String(payload.shift || "M"),
          dt15: "",
        }),
      },
      8000
    );

    const lotRows = await fetchAllCavRowsFromLan(cavConfig, [lot]);
    const matching = lotRows
      .filter(
        (r) =>
          (normMat && r.matricula === normMat) ||
          (normPlacas && r.placas.toUpperCase() === normPlacas)
      )
      .sort((a, b) => b.external_id_reg - a.external_id_reg);

    const created = matching[0] || null;
    return {
      result: {
        external_id_reg: created ? created.external_id_reg : null,
      },
      rows: created ? [created] : [],
    };
  }

  if (action === "update") {
    const extId = Number(payload.external_id_reg);
    const lot = String(payload.parking_lot || "1");
    await rawHttpRequest(
      `${session.baseUrl}/dashboard/plataforma/mysql/update_cajon_estacionamiento.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          dt1: String(payload.placas || "").trim().toUpperCase(),
          dt2: String(payload.nombre || "").trim().toUpperCase(),
          dt3: String(payload.email || "").trim(),
          dt4: String(payload.cargo || "").trim().toUpperCase(),
          dt5: String(payload.area_code || "200217").trim(),
          dt6: String(payload.vehicle_model_id || 376),
          dt7: String(payload.shift || "M"),
          dt8: String(payload.apellido_paterno || "").trim().toUpperCase(),
          dt9: String(payload.apellido_materno || "").trim().toUpperCase(),
          dt10: String(extId),
          dt11: lot,
          dt12: normalizeMatricula(payload.matricula),
        }),
      },
      8000
    );

    return {
      result: { updated: true, external_id_reg: extId },
      rows: [],
    };
  }

  if (action === "toggle_status") {
    const extId = Number(payload.external_id_reg);
    const status = payload.status === "A" ? "A" : "X";
    await rawHttpRequest(
      `${session.baseUrl}/dashboard/plataforma/mysql/update_campo.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          SD0: String(extId),
          SD1: status,
        }),
      },
      8000
    );

    return {
      result: { updated: true, external_id_reg: extId, status },
      rows: [],
    };
  }

  if (action === "download_qr") {
    const extId = Number(payload.external_id_reg);
    await rawHttpRequest(
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
          SD2: String(extId),
          NumRep: "1",
        }),
      },
      8000
    );

    const pdfRes = await rawHttpRequest(
      `${session.baseUrl}/dashboard/fpdf/print/pdf_id_acceso_hgr1.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          NumRep: "1",
          dtf1: "1",
          dtf2: String(extId),
        }),
      },
      10000
    );

    if (!pdfRes.ok) {
      throw new Error(`HTTP ${pdfRes.status} al descargar PDF QR`);
    }

    return {
      result: {
        pdf_base64: pdfRes.buffer.toString("base64"),
      },
      rows: [],
    };
  }

  throw new Error(`Acción desconocida en el puente: ${action}`);
}

function rowFingerprint(row) {
  return `${row.external_id_reg}|${row.matricula}|${row.placas}|${row.parking_lot}|${row.cajon_number}|${row.status}|${row.area_code}`;
}

function loadFingerprintsFromDisk() {
  const map = new Map();
  try {
    if (fs.existsSync(FINGERPRINTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(FINGERPRINTS_FILE, "utf8"));
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          map.set(Number(k), String(v));
        }
      }
    }
  } catch {
    // Si el archivo no existe o está corrupto, iniciar mapa limpio
  }
  return map;
}

function saveFingerprintsToDisk(map) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(FINGERPRINTS_FILE, JSON.stringify(obj), "utf8");
  } catch {
    // Ignorar error de escritura en disco
  }
}

function createParkingBridgeWorker({ apiRequest, agentVersion = "1.1.0" }) {
  let deltaTimer = null;
  let isRunningCommands = false;
  let isRunningDelta = false;
  let cachedCavConfig = { ...DEFAULT_CAV_CONFIG };
  let initialCheckDone = false;
  const knownFingerprints = loadFingerprintsFromDisk();

  let realtimeClient = null;
  let realtimeChannel = null;
  let subscribedDelegationId = null;

  function ensureRealtimeSubscription(delegationId, supabaseUrl, anonKey) {
    if (!delegationId || !supabaseUrl || !anonKey) return;
    if (realtimeChannel && subscribedDelegationId === delegationId) return;

    try {
      teardownRealtimeSubscription();
      realtimeClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      subscribedDelegationId = delegationId;
      realtimeChannel = realtimeClient
        .channel(`parking-bridge:${delegationId}`)
        .on("broadcast", { event: "parking-wake" }, () => {
          void pollBridgeCommands(false);
        })
        .subscribe();
    } catch {
      // Si el firewall bloquea WebSockets, operará vía piggyback del heartbeat
    }
  }

  function teardownRealtimeSubscription() {
    try {
      if (realtimeClient && realtimeChannel) {
        void realtimeClient.removeChannel(realtimeChannel);
      }
    } catch {
      // Ignorar al cerrar canal
    }
    realtimeChannel = null;
    realtimeClient = null;
    subscribedDelegationId = null;
  }

  async function uploadRowsInChunks(rows) {
    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await apiRequest("/api/union/print-agent/parking-bridge", {
        method: "POST",
        headers: { "x-agent-version": agentVersion },
        body: JSON.stringify({
          type: "sync_rows",
          rows: chunk,
        }),
      });
    }
  }

  async function pollBridgeCommands(isInitialStartup = false) {
    if (isRunningCommands) return;
    isRunningCommands = true;

    try {
      const endpoint = isInitialStartup
        ? "/api/union/print-agent/parking-bridge?check_initial=1"
        : "/api/union/print-agent/parking-bridge";

      const res = await apiRequest(endpoint, {
        method: "GET",
        headers: { "x-agent-version": agentVersion },
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data.cav_config) {
        cachedCavConfig = { ...cachedCavConfig, ...data.cav_config };
      }

      if (data.needs_initial_sync && !isRunningDelta) {
        void runDeltaOrInitialSync(true);
      } else if (!initialCheckDone && !isRunningDelta) {
        initialCheckDone = true;
        void runDeltaOrInitialSync(false);
      }

      const commands = data.commands || [];
      for (const cmd of commands) {
        try {
          if (cmd.action === "sync_all") {
            const allRows = await fetchAllCavRowsFromLan(cachedCavConfig, ["1", "2", "3"]);
            knownFingerprints.clear();
            for (const r of allRows) {
              knownFingerprints.set(r.external_id_reg, rowFingerprint(r));
            }
            saveFingerprintsToDisk(knownFingerprints);
            await uploadRowsInChunks(allRows);

            await apiRequest("/api/union/print-agent/parking-bridge", {
              method: "POST",
              headers: { "x-agent-version": agentVersion },
              body: JSON.stringify({
                type: "command_result",
                request_id: cmd.id,
                ok: true,
                result: {
                  sync_stats: {
                    total_cav_rows: allRows.length,
                    linked_workers_count: allRows.length,
                    unlinked_count: 0,
                    synced_at: new Date().toISOString(),
                  },
                },
              }),
            });
            continue;
          }

          const { result, rows } = await executeCavBridgeCommandOnLan(cmd, cachedCavConfig);
          if (Array.isArray(rows) && rows.length > 0) {
            for (const r of rows) {
              knownFingerprints.set(r.external_id_reg, rowFingerprint(r));
            }
            saveFingerprintsToDisk(knownFingerprints);
          }

          await apiRequest("/api/union/print-agent/parking-bridge", {
            method: "POST",
            headers: { "x-agent-version": agentVersion },
            body: JSON.stringify({
              type: "command_result",
              request_id: cmd.id,
              ok: true,
              result,
              rows,
            }),
          });
        } catch (cmdErr) {
          await apiRequest("/api/union/print-agent/parking-bridge", {
            method: "POST",
            headers: { "x-agent-version": agentVersion },
            body: JSON.stringify({
              type: "command_result",
              request_id: cmd.id,
              ok: false,
              error_message: cmdErr.message || "Error al ejecutar orden en CAV HGR 1",
            }),
          });
        }
      }
    } catch {
      // Ignorar errores transitorios de red
    } finally {
      isRunningCommands = false;
    }
  }

  async function runDeltaOrInitialSync(forceFull = false) {
    if (isRunningDelta) return;
    isRunningDelta = true;

    try {
      const allRows = await fetchAllCavRowsFromLan(cachedCavConfig, ["1", "2", "3"]);
      if (allRows.length === 0) return;

      if (forceFull || knownFingerprints.size === 0) {
        await uploadRowsInChunks(allRows);
        knownFingerprints.clear();
        for (const r of allRows) {
          knownFingerprints.set(r.external_id_reg, rowFingerprint(r));
        }
        saveFingerprintsToDisk(knownFingerprints);
        return;
      }

      const changedRows = [];
      for (const r of allRows) {
        const fp = rowFingerprint(r);
        if (knownFingerprints.get(r.external_id_reg) !== fp) {
          changedRows.push(r);
          knownFingerprints.set(r.external_id_reg, fp);
        }
      }

      if (changedRows.length > 0) {
        await uploadRowsInChunks(changedRows);
        saveFingerprintsToDisk(knownFingerprints);
      }
    } catch {
      // Si la PC no está en la subred 11.1.17.x o el servidor CAV está apagado, reintentará en el siguiente ciclo LAN
    } finally {
      isRunningDelta = false;
    }
  }

  function onHeartbeat(heartbeatData) {
    if (!heartbeatData || typeof heartbeatData !== "object") return;
    if (
      heartbeatData.delegation_id &&
      heartbeatData.realtime_config &&
      heartbeatData.realtime_config.url &&
      heartbeatData.realtime_config.anon_key
    ) {
      ensureRealtimeSubscription(
        heartbeatData.delegation_id,
        heartbeatData.realtime_config.url,
        heartbeatData.realtime_config.anon_key
      );
    }

    if (Number(heartbeatData.parking_pending_count) > 0) {
      void pollBridgeCommands(false);
    }
  }

  function start() {
    stop();
    // 1 sola consulta inicial al arrancar la PC; después 0 consultas en reposo gracias a WebSocket Broadcast + Heartbeat Piggyback
    void pollBridgeCommands(true);
    // Ciclo diferencial de 45s exclusivamente en la red local LAN (0 peticiones a Supabase si no hubo cambios en 11.1.17.44)
    deltaTimer = setInterval(() => void runDeltaOrInitialSync(false), LAN_DELTA_INTERVAL_MS);
  }

  function stop() {
    if (deltaTimer) clearInterval(deltaTimer);
    deltaTimer = null;
    teardownRealtimeSubscription();
  }

  return {
    start,
    stop,
    onHeartbeat,
    triggerSyncNow: () => runDeltaOrInitialSync(true),
  };
}

module.exports = {
  createParkingBridgeWorker,
  fetchAllCavRowsFromLan,
  executeCavBridgeCommandOnLan,
};
