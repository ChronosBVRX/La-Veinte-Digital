// Parser puro para respuestas HTML/JS del sistema CAV v1.0 (HGR No. 1 - 11.1.17.44:8080)

import {
  getCavAreaLabel,
  getCavParkingLotCode,
  getCavParkingLotLabel,
  getCavVehicleModelLabel,
} from "./catalogs";

export interface CavSearchRow {
  external_id_reg: number;
  status: "A" | "X";
  cajon_number: string;
  full_name: string;
  matricula: string;
  area_code: string;
  area_label: string;
  placas: string;
  parking_lot: "1" | "2" | "3";
  parking_lot_label: string;
}

export interface CavAltaRow {
  external_id_reg: number;
  cajon_number: string;
  full_name: string;
  matricula: string;
  placas: string;
  area_code: string;
  area_label: string;
}

export interface CavRecordDetail {
  external_id_reg: number;
  cajon_key: string;
  cajon_number: string;
  matricula: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  full_name: string;
  cargo: string;
  area_code: string;
  area_label: string;
  placas: string;
  vehicle_model_id: number | null;
  vehicle_model_label: string;
  parking_lot: "1" | "2" | "3";
  parking_lot_label: string;
  shift: "M" | "V" | "N" | "A";
  email: string;
}

export interface CavWorkerLookup {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  cargo: string;
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMatricula(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = String(raw).trim();
  const digitsOnly = cleaned.replace(/\D/g, "");
  return digitsOnly.length >= 5 ? digitsOnly : cleaned.toUpperCase();
}

export function parseLoginSessionId(html: string): string | null {
  const match =
    html.match(/name=["']UserSess["'][^>]*value=["']([^"']+)["']/i) ??
    html.match(/id=["']UserSess["'][^>]*value=["']([^"']+)["']/i) ??
    html.match(/value=["']([^"']+)["'][^>]*name=["']UserSess["']/i);
  if (!match) return null;
  const val = match[1].trim();
  return val.length > 0 ? val : null;
}

/**
 * Parsea la tabla devuelta por `dashboard/plataforma/buscar_registro.php`
 * que contiene el switch Activo/Suspendido (`checked='checked'`), cajón,
 * nombre // matrícula, área, placas y estacionamiento.
 */
export function parseBuscarRegistroRows(html: string): CavSearchRow[] {
  const rows: CavSearchRow[] = [];
  const trRegex = /<tr[^>]*class=['"](?:odd|even)[^'"]*['"][^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(html)) !== null) {
    const tr = match[1];

    // Extraer IDReg desde select_campos_show("0","2422") o Send_Auxiliar2(...,'2422')
    const idMatch =
      tr.match(/select_campos_show\(\s*['"][^'"]*['"]\s*,\s*['"](\d+)['"]\s*\)/i) ??
      tr.match(/gen_code_qr_encript_hgr1\.php['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"](\d+)['"]/i);
    if (!idMatch) continue;
    const externalIdReg = parseInt(idMatch[1], 10);
    if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) continue;

    // Verificar si el checkbox está activo
    const checkboxMatch = tr.match(/<input[^>]*type=['"]checkbox['"][^>]*>/i);
    const isChecked = checkboxMatch ? /checked/i.test(checkboxMatch[0]) : false;
    const status: "A" | "X" = isChecked ? "A" : "X";

    // Extraer número de cajón
    const cajonMatch = tr.match(/<label[^>]*class=['"]left['"][^>]*>([^<]*)<\/label>/i);
    const cajonNumber = cajonMatch ? cajonMatch[1].trim() : "";

    // Extraer celdas <td>
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(tr)) !== null) {
      tds.push(tdMatch[1]);
    }
    // Esperamos 5 celdas: [0]=QR button, [1]=switch+cajon, [2]=Nombre // Matricula <br> Area, [3]=Placas, [4]=Estacionamiento
    if (tds.length < 5) continue;

    const personalRaw = tds[2];
    const [nameAndMatPart, areaPart] = personalRaw.split(/<br\s*\/?>/i);
    const nameAndMatText = cleanHtmlText(nameAndMatPart ?? "");
    const slashParts = nameAndMatText.split("//");
    const fullName = (slashParts[0] ?? "").trim();
    const rawMatricula = (slashParts[1] ?? "").trim();
    const matricula = normalizeMatricula(rawMatricula);
    const areaCode = cleanHtmlText(areaPart ?? "");
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

/**
 * Parsea la tabla devuelta por `dashboard/plataforma/alta_registros.php`
 * que vincula cada `IDReg` con `config_usuarios.php`.
 */
export function parseAltaRegistrosRows(html: string): CavAltaRow[] {
  const rows: CavAltaRow[] = [];
  const rowRegex =
    /Send_Auxiliar\(\s*["']config_usuarios\.php["']\s*,\s*["'](\d+)["']\s*\)\s*;?['"]>([^<]*)<\/button>\s*<\/td>\s*<td>\s*<span>([^<]*?)(?:<br\s*\/?>\s*<em>([^<]*)<\/em>)?\s*<\/span>\s*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const externalIdReg = parseInt(match[1], 10);
    if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) continue;
    const cajonNumber = (match[2] ?? "").trim();
    const fullName = cleanHtmlText(match[3] ?? "");
    const matricula = normalizeMatricula(match[4] ?? "");
    const placas = cleanHtmlText(match[5] ?? "").toUpperCase();
    const areaCode = cleanHtmlText(match[6] ?? "");

    rows.push({
      external_id_reg: externalIdReg,
      cajon_number: cajonNumber,
      full_name: fullName,
      matricula,
      placas,
      area_code: areaCode,
      area_label: getCavAreaLabel(areaCode),
    });
  }

  return rows;
}

function extractInputValue(html: string, id: string): string {
  const regex = new RegExp(`<input[^>]*id=["']${id}["'][^>]*>`, "i");
  const tagMatch = html.match(regex);
  if (!tagMatch) return "";
  const valMatch = tagMatch[0].match(/value=["']([^"']*)["']/i);
  return valMatch ? valMatch[1].trim() : "";
}

function extractSelectedOption(html: string, selectId: string): { code: string; label: string } {
  const idx = html.indexOf(`id="${selectId}"`);
  const idxSingle = idx === -1 ? html.indexOf(`id='${selectId}'`) : idx;
  if (idxSingle === -1) return { code: "", label: "" };
  const endIdx = html.indexOf("</select>", idxSingle);
  const chunk = endIdx === -1 ? html.slice(idxSingle, idxSingle + 5000) : html.slice(idxSingle, endIdx);

  // En config_usuarios.php el primer <option> suele ser el valor actual seleccionado
  const selectedMatch =
    chunk.match(/<option[^>]*selected[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/i) ??
    chunk.match(/<option[^>]*value=['"]([^'"]*)['"][^>]*selected[^>]*>([^<]*)<\/option>/i) ??
    chunk.match(/<option[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/i);

  if (!selectedMatch) return { code: "", label: "" };
  const code = selectedMatch[1].trim();
  const label = cleanHtmlText(selectedMatch[2]);
  if (code === "0") return { code: "", label: "" };
  return { code, label };
}

/**
 * Parsea el formulario de edición `dashboard/plataforma/config_usuarios.php`.
 */
export function parseConfigUsuarioDetail(html: string): CavRecordDetail | null {
  const spanIdMatch = html.match(/<span[^>]*id=["']SpanIdReg["'][^>]*>(\d+)<\/span>/i);
  if (!spanIdMatch) return null;
  const externalIdReg = parseInt(spanIdMatch[1], 10);
  if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) return null;

  const spanKeyMatch = html.match(/<span[^>]*id=["']SpanIdReg2["'][^>]*>([^<]*)<\/span>/i);
  const cajonKey = spanKeyMatch ? spanKeyMatch[1].trim() : "";
  // Clave suele tener formato "170501-1-30-2730" donde el 3er segmento es el cajón
  const keyParts = cajonKey.split("-");
  const cajonNumber = keyParts.length >= 3 ? keyParts[2].trim() : "";

  const matricula = normalizeMatricula(extractInputValue(html, "Cmpo_12"));
  const nombre = extractInputValue(html, "Cmpo_2");
  const apellidoPaterno = extractInputValue(html, "Cmpo_2A");
  const apellidoMaterno = extractInputValue(html, "Cmpo_2B");
  const cargo = extractInputValue(html, "Cmpo_4");
  const placas = extractInputValue(html, "Cmpo_1").toUpperCase();
  const email = extractInputValue(html, "Cmpo_3");

  const areaOpt = extractSelectedOption(html, "Cmpo_5");
  const modelOpt = extractSelectedOption(html, "Cmpo_6");
  const lotOpt = extractSelectedOption(html, "Cmpo_11");
  const shiftOpt = extractSelectedOption(html, "Cmpo_7");

  const vehicleModelId = modelOpt.code ? parseInt(modelOpt.code, 10) : null;
  const validModelId = vehicleModelId !== null && Number.isFinite(vehicleModelId) && vehicleModelId > 0 ? vehicleModelId : null;
  const parkingLot = getCavParkingLotCode(lotOpt.code || "1");
  const rawShift = (shiftOpt.code || "M").toUpperCase();
  const shift: "M" | "V" | "N" | "A" =
    rawShift === "V" || rawShift === "N" || rawShift === "A" ? rawShift : "M";

  const fullName = [nombre, apellidoPaterno, apellidoMaterno]
    .map((s) => s.trim())
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
    vehicle_model_label: getCavVehicleModelLabel(validModelId) || modelOpt.label,
    parking_lot: parkingLot,
    parking_lot_label: getCavParkingLotLabel(parkingLot),
    shift,
    email,
  };
}

/**
 * Parsea la respuesta de `dashboard/plataforma/consultas/list_trab.php`
 * cuando se busca una matrícula en la base de datos del CAV.
 */
export function parseWorkerLookupResponse(jsHtml: string): CavWorkerLookup | null {
  const extractJsAssign = (fieldId: string): string => {
    const re = new RegExp(`getElementById\\(\\s*["']${fieldId}["']\\s*\\)\\.value\\s*=\\s*["']([^"']*)["']`, "i");
    const m = jsHtml.match(re);
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
