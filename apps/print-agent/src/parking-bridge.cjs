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

// Código oficial de unidad HGR No. 1 Morelia en CAV v1.0 (dt3="170501")
const CAV_HGR1_UNIT_CODE = "170501";
const LAN_DELTA_INTERVAL_MS = 45000; // 45s en red local LAN (0 tráfico a internet si no hay cambios)

const APPDATA_DIR = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const DATA_DIR = path.join(APPDATA_DIR, "LaVeintePrintAgent");
const FINGERPRINTS_FILE = path.join(DATA_DIR, "parking-fingerprints.json");

const CAV_AREAS_BY_CODE = {
  "51201": "Servs orient y quejas",
  "100902": "Servicios Admvos En Unidades M",
  "130100": "Depto Construc-Planeac Inmobil",
  "141901": "Transportes Terrestres -Ambula",
  "141902": "Comunicaciones Electricas",
  "142901": "Servs Basicos",
  "142902": "Residencia De Conservacion",
  "142905": "Servicio de Limpieza e Higiene",
  "150901": "Almacen De Unidad Medica",
  "200200": "Direccion de la Unidad Médica",
  "200201": "Jefatura de Cirugía / Especialidades",
  "200202": "Jefatura de Medicina Interna",
  "200203": "Farmacia",
  "200204": "Lab Citología Exfoliativa",
  "200205": "Laboratorio Clínico",
  "200206": "Atención Médica Continúa",
  "200207": "Gabinete De Rayos X",
  "200208": "Consulta Dental",
  "200209": "Nutrición y Dietética",
  "200210": "Banco de Sangre",
  "200211": "Consulta a Donadores",
  "200215": "Medicina Fisica y Rehabilitaci",
  "200216": "Anatomía Patológica",
  "200217": "Hospitalización",
  "200218": "Urgencias",
  "200219": "Quirofanos",
  "200220": "Terapia Intensiva",
  "200221": "Tococírugia",
  "200222": "Pediatría",
  "200223": "Consulta De Especialidades",
  "200224": "Gabinete de Electrodiagnostico",
  "200227": "Hemodialisis",
  "200240": "Terapia Psicologica",
  "200242": "Protesis y Ortesis",
  "200244": "Terapia Física",
  "200246": "Tomografia Axial Computarizada",
  "200260": "UnidCuidadosIntensivNeonatales",
  "200263": "Centro de Mezclas",
  "200901": "Jefatura de Enfermería",
  "200902": "Trabajo Social",
  "200903": "Lavanderia Propia de la Unidad",
  "200905": "Traslado De Pacientes",
  "200907": "Ctral de Equipos y Esterilizac",
  "200908": "Traspaso Costo Atn Med IMSS",
  "230201": "Medicina Del Trabajo Anal Y Ev",
  "230204": "Serv de Prev yProm de la Salud",
  "230903": "Divisiones De Salud En El Trab",
  "230904": "Servs Infor-Asesoria-Capacit-S",
  "250901": "Coordinación Clínica de Educación",
  "250902": "Biblioteca Medica Biblio Trab",
  "250903": "Educacion Continua",
  "250904": "Pasantes En Servicio Social Pr",
  "250905": "Postgrado De Enfermeria",
  "250906": "Internado De Pregrado",
  "250908": "Postgrado De Medicina",
  "250909": "Formacion Profesores P-Ensenan",
  "250910": "Lic Enfer Sist Univer Abierta",
  "2H0210": "Promoción de la Salud",
  "2H0220": "Prog Integ de Salud PREVENIMSS",
  "2H0230": "Prog Esp de Planificacion Fam",
  "2H0240": "Prot Anticonc Gen y Salud",
  "2H0250": "Atn Materna y Perinatal",
  "2J0910": "Area Inf Med y Archivo Clinico",
  "610200": "Serv Admvos Presp Cont UMed",
  "999998": "CENTRO DE COSTOS DUMMY",
};

function getCavAreaLabel(code) {
  if (!code) return "";
  const trimmed = String(code).trim();
  return CAV_AREAS_BY_CODE[trimmed] || trimmed;
}

function getCavParkingLotCode(raw) {
  if (!raw) return "1";
  const upper = String(raw).trim().toUpperCase();
  if (upper === "2" || upper.includes("CONFIANZA")) return "2";
  if (upper === "3" || upper.includes("VISITANTE")) return "3";
  return "1";
}

function getCavParkingLotLabel(code) {
  const c = getCavParkingLotCode(code);
  if (c === "2") return "CONFIANZA";
  if (c === "3") return "VISITANTES";
  return "BASE";
}

function cleanHtmlText(raw) {
  return String(raw || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMatricula(raw) {
  if (!raw) return "";
  const cleaned = String(raw).trim();
  const digitsOnly = cleaned.replace(/\D/g, "");
  return digitsOnly.length >= 5 ? digitsOnly : cleaned.toUpperCase();
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
  const s = String(html || "");
  const m =
    s.match(/name=["']UserSess["'][^>]*value=["']([^"']+)["']/i) ||
    s.match(/id=["']UserSess["'][^>]*value=["']([^"']+)["']/i) ||
    s.match(/value=["']([^"']+)["'][^>]*name=["']UserSess["']/i);
  if (!m) return "16";
  const val = m[1].trim();
  return val.length > 0 ? val : "16";
}

/**
 * Parsea la tabla devuelta por `dashboard/plataforma/buscar_registro.php`
 * (5 celdas `<td>` por fila: [0]=QR button, [1]=switch+cajon, [2]=Nombre // Matricula <br> Area, [3]=Placas, [4]=Estacionamiento).
 */
function parseBuscarRegistroRows(html) {
  const rows = [];
  const s = String(html || "");
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = trRegex.exec(s)) !== null) {
    const tr = match[1];

    // Extraer IDReg desde select_campos_show("0","2422") o Send_Auxiliar2(...,'2422')
    const idMatch =
      tr.match(/select_campos_show\(\s*['"][^'"]*['"]\s*,\s*['"](\d+)['"]\s*\)/i) ||
      tr.match(/gen_code_qr_encript_hgr1\.php['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"](\d+)['"]/i);
    if (!idMatch) continue;
    const externalIdReg = Number.parseInt(idMatch[1], 10);
    if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) continue;

    // Verificar si el checkbox está activo
    const checkboxMatch = tr.match(/<input[^>]*type=['"]checkbox['"][^>]*>/i);
    const isChecked = checkboxMatch ? /checked/i.test(checkboxMatch[0]) : false;
    const status = isChecked ? "A" : "X";

    // Extraer número de cajón
    const cajonMatch = tr.match(/<label[^>]*class=['"]left['"][^>]*>([^<]*)<\/label>/i);
    const cajonNumber = cajonMatch ? cajonMatch[1].trim() : "";

    // Extraer celdas <td> (5 celdas por registro)
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(tr)) !== null) {
      tds.push(tdMatch[1]);
    }
    if (tds.length < 5) continue;

    const personalRaw = tds[2];
    const [nameAndMatPart, areaPart] = personalRaw.split(/<br\s*\/?>/i);
    const nameAndMatText = cleanHtmlText(nameAndMatPart || "");
    const slashParts = nameAndMatText.split("//");
    const fullName = (slashParts[0] || "").trim();
    const rawMatricula = (slashParts[1] || "").trim();
    const matricula = normalizeMatricula(rawMatricula);
    const areaCode = cleanHtmlText(areaPart || "");
    const placas = cleanHtmlText(tds[3]).toUpperCase();
    const parkingLotRaw = cleanHtmlText(tds[4]).toUpperCase();
    const parkingLot = getCavParkingLotCode(parkingLotRaw);
    const parkingLotLabel = getCavParkingLotLabel(parkingLot);

    rows.push({
      external_id_reg: externalIdReg,
      status,
      cajon_number: cajonNumber,
      full_name: fullName,
      matricula,
      area_code: areaCode,
      area_label: getCavAreaLabel(areaCode),
      placas,
      parking_lot: parkingLot,
      parking_lot_label: parkingLotLabel,
    });
  }

  return rows;
}

function extractInputValue(html, id) {
  const regex = new RegExp(`<input[^>]*id=["']${id}["'][^>]*>`, "i");
  const tagMatch = String(html || "").match(regex);
  if (!tagMatch) return "";
  const valMatch = tagMatch[0].match(/value=["']([^"']*)["']/i);
  return valMatch ? valMatch[1].trim() : "";
}

function extractSelectedOption(html, selectId) {
  const s = String(html || "");
  const idx = s.indexOf(`id="${selectId}"`);
  const idxSingle = idx === -1 ? s.indexOf(`id='${selectId}'`) : idx;
  if (idxSingle === -1) return { code: "", label: "" };
  const endIdx = s.indexOf("</select>", idxSingle);
  const chunk = endIdx === -1 ? s.slice(idxSingle, idxSingle + 5000) : s.slice(idxSingle, endIdx);

  const selectedMatch =
    chunk.match(/<option[^>]*selected[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/i) ||
    chunk.match(/<option[^>]*value=['"]([^'"]*)['"][^>]*selected[^>]*>([^<]*)<\/option>/i) ||
    chunk.match(/<option[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/i);

  if (!selectedMatch) return { code: "", label: "" };
  const code = selectedMatch[1].trim();
  const label = cleanHtmlText(selectedMatch[2]);
  if (code === "0") return { code: "", label: "" };
  return { code, label };
}

function parseConfigUsuarioDetail(html) {
  const s = String(html || "");
  const spanIdMatch = s.match(/<span[^>]*id=["']SpanIdReg["'][^>]*>(\d+)<\/span>/i);
  if (!spanIdMatch) return null;
  const externalIdReg = Number.parseInt(spanIdMatch[1], 10);
  if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) return null;

  const spanKeyMatch = s.match(/<span[^>]*id=["']SpanIdReg2["'][^>]*>([^<]*)<\/span>/i);
  const cajonKey = spanKeyMatch ? spanKeyMatch[1].trim() : "";
  const keyParts = cajonKey.split("-");
  const cajonNumber = keyParts.length >= 3 ? keyParts[2].trim() : "";

  const matricula = normalizeMatricula(extractInputValue(s, "Cmpo_12"));
  const nombre = extractInputValue(s, "Cmpo_2");
  const apellidoPaterno = extractInputValue(s, "Cmpo_2A");
  const apellidoMaterno = extractInputValue(s, "Cmpo_2B");
  const cargo = extractInputValue(s, "Cmpo_4");
  const placas = extractInputValue(s, "Cmpo_1").toUpperCase();
  const email = extractInputValue(s, "Cmpo_3");

  const areaOpt = extractSelectedOption(s, "Cmpo_5");
  const modelOpt = extractSelectedOption(s, "Cmpo_6");
  const lotOpt = extractSelectedOption(s, "Cmpo_11");
  const shiftOpt = extractSelectedOption(s, "Cmpo_7");

  const vehicleModelId = modelOpt.code ? Number.parseInt(modelOpt.code, 10) : null;
  const validModelId =
    vehicleModelId !== null && Number.isFinite(vehicleModelId) && vehicleModelId > 0
      ? vehicleModelId
      : null;
  const parkingLot = getCavParkingLotCode(lotOpt.code || "1");
  const rawShift = (shiftOpt.code || "M").toUpperCase();
  const shift = rawShift === "V" || rawShift === "N" || rawShift === "A" ? rawShift : "M";

  const fullName = [nombre, apellidoPaterno, apellidoMaterno]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  return {
    external_id_reg: externalIdReg,
    cajon_key: cajonKey,
    cajon_number: cajonNumber,
    matricula,
    nombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    full_name: fullName,
    cargo,
    area_code: areaOpt.code,
    area_label: getCavAreaLabel(areaOpt.code) || areaOpt.label,
    placas,
    vehicle_model_id: validModelId,
    vehicle_model_label: modelOpt.label || "",
    parking_lot: parkingLot,
    parking_lot_label: getCavParkingLotLabel(parkingLot),
    shift,
    email,
  };
}

function parseWorkerLookupResponse(jsHtml) {
  const s = String(jsHtml || "");
  const extractJsAssign = (fieldId) => {
    const re = new RegExp(
      `getElementById\\(\\s*["']${fieldId}["']\\s*\\)\\.value\\s*=\\s*["']([^"']*)["']`,
      "i"
    );
    const m = s.match(re);
    return m ? m[1].trim() : "";
  };

  const nombre = extractJsAssign("Cmpo_2");
  const apellidoPaterno = extractJsAssign("Cmpo_2A");
  const apellidoMaterno = extractJsAssign("Cmpo_2B");
  const cargo = extractJsAssign("Cmpo_4");

  if (!nombre && !apellidoPaterno) return null;
  return {
    nombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    cargo,
  };
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
      12000
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

  if (action === "detail") {
    const extId = Number(payload.external_id_reg);
    const res = await rawHttpRequest(
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
          SD2: String(extId),
        }),
      },
      8000
    );
    const detail = parseConfigUsuarioDetail(res.latin1Text);
    return {
      result: { detail },
      rows: [],
    };
  }

  if (action === "lookup_worker") {
    const normMat = normalizeMatricula(payload.matricula);
    const res = await rawHttpRequest(
      `${session.baseUrl}/dashboard/plataforma/consultas/list_trab.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(session.cookie ? { Cookie: session.cookie } : {}),
        },
        body: encodeFormBody({
          Data_M: normMat,
        }),
      },
      6000
    );
    const worker = parseWorkerLookupResponse(res.latin1Text);
    return {
      result: { worker },
      rows: [],
    };
  }

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

function createParkingBridgeWorker({ apiRequest, agentVersion = "1.2.0" }) {
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
    let totalLinked = 0;
    let totalUnlinked = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const res = await apiRequest("/api/union/print-agent/parking-bridge", {
        method: "POST",
        headers: { "x-agent-version": agentVersion },
        body: JSON.stringify({
          type: "sync_rows",
          rows: chunk,
        }),
      });
      if (res && res.ok) {
        const stats = await res.json().catch(() => null);
        if (stats) {
          totalLinked += Number(stats.linked_workers_count || 0);
          totalUnlinked += Number(stats.unlinked_count || 0);
        }
      }
    }
    return {
      linked_workers_count: totalLinked,
      unlinked_count: totalUnlinked,
    };
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
            const uploadStats = await uploadRowsInChunks(allRows);
            knownFingerprints.clear();
            for (const r of allRows) {
              knownFingerprints.set(r.external_id_reg, rowFingerprint(r));
            }
            saveFingerprintsToDisk(knownFingerprints);

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
                    linked_workers_count: uploadStats.linked_workers_count,
                    unlinked_count: uploadStats.unlinked_count,
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

    if (heartbeatData.needs_initial_sync && !isRunningDelta) {
      void runDeltaOrInitialSync(true);
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
  CAV_HGR1_UNIT_CODE,
  createParkingBridgeWorker,
  fetchAllCavRowsFromLan,
  executeCavBridgeCommandOnLan,
  parseBuscarRegistroRows,
  parseConfigUsuarioDetail,
  parseWorkerLookupResponse,
};
