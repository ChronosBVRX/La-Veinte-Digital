import type {
  SiapRawRow,
  ParsedWorkerRow,
  RowIssue,
  AssociatedConcept,
} from "./types";

// Catálogo de Conceptos Asociados (C A) según procedimiento de actualización de plazas SIAP
// (Bitmask de 5 posiciones)
export const ASSOCIATED_CONCEPTS_CATALOG: Record<number, { code: string; name: string }> = {
  0: { code: "012", name: "Horario discontinuo" },
  1: { code: "014", name: "Infectocontagiosidad no médica" },
  2: { code: "023", name: "Infectocontagiosidad médica" },
  3: { code: "054", name: "Emanaciones radiactivas no médicas" },
  4: { code: "063", name: "Emanaciones radiactivas" },
};

// Catálogo institucional SIAP de Tipo de Contratación (TC)
export const TC_CATALOG: Record<string, string> = {
  "0": "Estatuto",
  "1": "Confianza",
  "2": "Base",
  "5": "Becario",
  "9": "Residente",
};

// Catálogo institucional SIAP de Turno (Jor / Turno)
export const SHIFT_CATALOG: Record<string, string> = {
  "1": "Matutino",
  "2": "Vespertino",
  "3": "Nocturno",
  "4": "Móvil",
  "5": "Jornada acumulada",
};

// Valores observados en el archivo HGR No. 1 analizado: 0, 1, 5, 7, 9, 11, 20, 62, 63, 64, 65, 71, 73, 75, 77, 90, 98 y 99.
// Esta relación es evidencia del archivo, no un catálogo normativo completo.
export const OBSERVED_MO_CODES = [
  "0", "1", "5", "7", "9", "11", "20", "62", "63", "64", "65", "71", "73", "75", "77", "90", "98", "99"
] as const;

export function formatOccupationMark(code: string): string {
  if (!code) return "-";
  return code;
}

export const OCCUPATION_LIMIT_SENTINEL_LABEL =
  "Fecha centinela institucional 01/01/2050. Sin interpretación automática del tipo o definitividad de la plaza";

export function formatOccupationLimitDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  if (dateStr === "2050-01-01") {
    return OCCUPATION_LIMIT_SENTINEL_LABEL;
  }
  return dateStr;
}

// Catálogo institucional SIAP de Tipo de Plaza (normalizado a 2 posiciones)
export const TIPO_PLAZA_CATALOG: Record<string, string> = {
  "01": "Operativa Confianza",
  "11": "Operativa Base",
  "12": "Compensada Base",
  "13": "Cubre Descansos Base",
  "14": "Cubre Vacaciones Base",
  "17": "Sobrantes Base",
  "30": "Becario",
  "40": "Residentes",
  "50": "Operativa Confianza Estatuto A",
  "61": "Operativa Confianza B",
  "63": "Cubre Descansos Confianza B",
};

export const COMPOUND_SURNAME_PREFIXES = new Set([
  "DE",
  "DEL",
  "DE LA",
  "DE LAS",
  "DE LOS",
  "SAN",
  "SANTA",
  "SANTO",
  "VON",
  "VAN",
  "MC",
  "MAC",
]);

export function parseExcelDate(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  if (typeof val === "number") {
    // Excel serial date (days since Dec 30 1899)
    if (val <= 0) return null;
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  const str = String(val).trim();
  if (!str) return null;

  // Check if string matches ISO or YYYY-MM-DD or DD/MM/YYYY
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function parseSeniority(raw: string): {
  years: number | null;
  fortnights: number | null;
  days: number | null;
} {
  if (!raw || !raw.trim()) {
    return { years: null, fortnights: null, days: null };
  }

  // Example: "10 Años 15 Quincenas 02 Dias" (or AÃ±os due to latin1/utf8)
  const regex = /(\d+)\s*A(?:ñ|n|[\uFFFD]|[\u00F1]|&ntilde;)os?\s*(\d+)\s*Quincenas?\s*(\d+)\s*D(?:í|i|[\uFFFD]|[\u00ED])as?/i;
  const match = raw.match(regex);
  if (match) {
    return {
      years: parseInt(match[1], 10),
      fortnights: parseInt(match[2], 10),
      days: parseInt(match[3], 10),
    };
  }

  // Fallback: try finding independent numbers
  const yMatch = raw.match(/(\d+)\s*A/i);
  const qMatch = raw.match(/(\d+)\s*Q/i);
  const dMatch = raw.match(/(\d+)\s*D/i);

  return {
    years: yMatch ? parseInt(yMatch[1], 10) : null,
    fortnights: qMatch ? parseInt(qMatch[1], 10) : null,
    days: dMatch ? parseInt(dMatch[1], 10) : null,
  };
}

export function decodeAssociatedConcepts(rawVal: string | number): {
  mask: string;
  concepts: AssociatedConcept[];
} {
  const clean = (rawVal ?? "").toString().trim().replace(/\D/g, "");
  if (!clean || clean === "0") {
    return { mask: "00000", concepts: [] };
  }

  // Pad to 5 digits (e.g. 1 -> 00001, 10 -> 00010, 100 -> 00100, 1000 -> 01000)
  const mask = clean.padStart(5, "0").slice(-5);
  const concepts: AssociatedConcept[] = [];

  // mask has 5 bits: index 0 to 4
  for (let i = 0; i < 5; i++) {
    if (mask[i] === "1") {
      const def = ASSOCIATED_CONCEPTS_CATALOG[i];
      if (def) {
        concepts.push({
          code: def.code,
          name: def.name,
          bitIndex: i,
        });
      }
    }
  }

  return { mask, concepts };
}

export function formatAssociatedConcepts(mask: string): string {
  if (!mask || mask === "00000") return "Sin concepto asociado";
  const { concepts } = decodeAssociatedConcepts(mask);
  if (concepts.length === 0) return "Sin concepto asociado";
  return concepts.map((c) => `${c.code} ${c.name}`).join(", ");
}

export const SEMANTIC_LOCKER_KEYWORDS = new Set([
  "S/N",
  "SN",
  "SIN NUMERO",
  "SIN NÚMERO",
  "DE PASO",
  "PASO",
  "VACIO",
  "VACÍO",
  "ABRIR",
  "ABIERTO",
  "JUBILADO",
  "BAJA",
  "PENDIENTE",
  "MONSERRAT",
  "PERSONAL",
]);

export function isSemanticLocker(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase().replace(/\s+/g, " ");
  if (!s) return false;
  if (SEMANTIC_LOCKER_KEYWORDS.has(s)) return true;
  if (s.startsWith("ACTUALIZADO") || s.startsWith("ACTUALIZACION") || s.startsWith("ACT.")) return true;
  return false;
}

export function normalizeLockerNumber(val: unknown): {
  normalized: string;
  isPhysical: boolean;
  isSemantic: boolean;
  raw: string;
} {
  if (val === null || val === undefined) {
    return { normalized: "", isPhysical: false, isSemantic: false, raw: "" };
  }
  const raw = String(val).trim();
  if (!raw) {
    return { normalized: "", isPhysical: false, isSemantic: false, raw: "" };
  }

  // Limpiar comillas, backticks, símbolos numerales y prefijos comunes (ej. L-, LOCKER, NO., #)
  const cleaned = raw
    .replace(/^[`'"\s#]+|[`'"\s]+$/g, "")
    .replace(/^(?:locker|lock|no\.?|l)[-\s]*/i, "")
    .trim();
  const upper = cleaned.toUpperCase().replace(/\s+/g, " ");

  if (isSemanticLocker(upper)) {
    return { normalized: upper, isPhysical: false, isSemantic: true, raw };
  }

  // Detectar identificador físico de casillero:
  // Preserva enteros (ej. "200", "427", "686") y sufijos (ej. "200-B", "427-B")
  const match = cleaned.match(/^(\d+)(?:\s*[-–—/]?\s*([A-Za-z0-9]+))?$/);
  if (match) {
    const base = String(parseInt(match[1], 10));
    const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
    return { normalized: `${base}${suffix}`, isPhysical: true, isSemantic: false, raw };
  }

  return { normalized: upper, isPhysical: false, isSemantic: true, raw };
}

export function extractSourceUpdateYear(colValue: unknown): number | null {
  if (!colValue) return null;
  const str = String(colValue).trim();
  const m = str.match(/\b(202[0-9])\b/);
  return m ? parseInt(m[1], 10) : null;
}

export function splitWorkerNameReversible(rawName: string): {
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  source_name_raw: string;
} {
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) {
    return { first_name: "", paternal_surname: "", maternal_surname: "", source_name_raw: "" };
  }

  if (trimmed.includes("/")) {
    const parts = trimmed
      .split("/")
      .map((p) => p.trim().toUpperCase().replace(/\s+/g, " "));
    return {
      paternal_surname: parts[0] || "",
      maternal_surname: parts[1] || "",
      first_name: parts.slice(2).join(" ") || "",
      source_name_raw: trimmed,
    };
  }

  const splitRes = splitFullName(trimmed);
  return {
    ...splitRes,
    source_name_raw: trimmed,
  };
}

export function splitFullName(fullName: string): {
  paternal_surname: string;
  maternal_surname: string;
  first_name: string;
  source_name_raw?: string;
} {
  const rawCleaned = (fullName ?? "").trim();
  if (!rawCleaned) {
    return { paternal_surname: "", maternal_surname: "", first_name: "", source_name_raw: "" };
  }

  // Si contiene diagonales /, el formato es PATERNO/MATERNO/NOMBRE(S)
  if (rawCleaned.includes("/")) {
    const parts = rawCleaned
      .split("/")
      .map((p) => p.trim().toUpperCase().replace(/\s+/g, " "))
      .filter((p) => p.length > 0);

    if (parts.length === 0) {
      return { paternal_surname: "", maternal_surname: "", first_name: "", source_name_raw: rawCleaned };
    }
    if (parts.length === 1) {
      return { paternal_surname: parts[0], maternal_surname: "", first_name: "", source_name_raw: rawCleaned };
    }
    if (parts.length === 2) {
      return { paternal_surname: parts[0], maternal_surname: "", first_name: parts[1], source_name_raw: rawCleaned };
    }
    if (parts.length === 3) {
      return { paternal_surname: parts[0], maternal_surname: parts[1], first_name: parts[2], source_name_raw: rawCleaned };
    }
    // 4 o más partes con diagonales
    return {
      paternal_surname: parts[0],
      maternal_surname: parts[1],
      first_name: parts.slice(2).join(" "),
      source_name_raw: rawCleaned,
    };
  }

  const cleaned = rawCleaned.toUpperCase().replace(/\s+/g, " ");
  const rawTokens = cleaned.split(" ");
  const tokens: string[] = [];

  // Group compound prefixes
  for (let i = 0; i < rawTokens.length; i++) {
    const current = rawTokens[i];
    const next = rawTokens[i + 1];
    const nextNext = rawTokens[i + 2];

    if (next && nextNext && COMPOUND_SURNAME_PREFIXES.has(`${current} ${next}`)) {
      tokens.push(`${current} ${next} ${nextNext}`);
      i += 2;
    } else if (next && COMPOUND_SURNAME_PREFIXES.has(current)) {
      tokens.push(`${current} ${next}`);
      i += 1;
    } else {
      tokens.push(current);
    }
  }

  if (tokens.length === 1) {
    return { paternal_surname: tokens[0], maternal_surname: "", first_name: "", source_name_raw: rawCleaned };
  }
  if (tokens.length === 2) {
    return { paternal_surname: tokens[0], maternal_surname: "", first_name: tokens[1], source_name_raw: rawCleaned };
  }
  if (tokens.length === 3) {
    return { paternal_surname: tokens[0], maternal_surname: tokens[1], first_name: tokens[2], source_name_raw: rawCleaned };
  }

  // 4 or more tokens: token[0] = paternal, token[1] = maternal, token[2...] = first_name
  return {
    paternal_surname: tokens[0],
    maternal_surname: tokens[1],
    first_name: tokens.slice(2).join(" "),
    source_name_raw: rawCleaned,
  };
}

export function deriveTurn(shiftCode: string, scheduleDesc: string): string {
  const code = (shiftCode ?? "").toString().trim();
  if (SHIFT_CATALOG[code]) {
    return SHIFT_CATALOG[code];
  }
  const s = (scheduleDesc ?? "").toUpperCase();
  if (s.includes("08:00 A 16:00") || s.includes("07:00 A 15:00") || s.includes("06:00 A 14:00") || s.includes("MATUTINO")) {
    return "Matutino";
  }
  if (s.includes("14:00 A 21:30") || s.includes("14:00 A 22:00") || s.includes("VESPERTINO")) {
    return "Vespertino";
  }
  if (s.includes("21:00 A") || s.includes("22:00 A") || s.includes("NOCTURNO") || s.includes("VELADA")) {
    return "Nocturno";
  }
  if (s.includes("JORNADA ACUMULADA") || s.includes("ACUMULADA")) {
    return "Jornada acumulada";
  }
  if (s.includes("MOVIL") || s.includes("MÓVIL")) {
    return "Móvil";
  }
  return "Jornada regular";
}

export function maskRfc(rfc: string): string {
  if (!rfc || rfc.length < 7) return "***";
  return `${rfc.slice(0, 4)}****${rfc.slice(-3)}`;
}

export function maskCurp(curp: string): string {
  if (!curp || curp.length < 8) return "***";
  return `${curp.slice(0, 4)}******${curp.slice(-4)}`;
}

export function maskNss(nss: string): string {
  if (!nss || nss.length < 6) return "***";
  return `****-**-${nss.slice(-4)}`;
}

export function normalizeMatricula(raw: unknown): string {
  return (raw ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
}

export function parseWorkerRow(
  raw: SiapRawRow,
  rowNumber: number
): {
  parsed: ParsedWorkerRow;
  issues: RowIssue[];
  isValid: boolean;
} {
  const issues: RowIssue[] = [];

  // 1. Matrícula
  const matricula = normalizeMatricula(raw.matricula_raw);
  if (!matricula) {
    issues.push({
      code: "MISSING_MATRICULA",
      message: `Fila ${rowNumber}: Falta la matrícula del trabajador.`,
      severity: "error",
      field: "matricula",
    });
  } else if (!/^\d+$/.test(matricula)) {
    issues.push({
      code: "NON_NUMERIC_MATRICULA",
      message: `La matrícula '${matricula}' contiene caracteres no numéricos.`,
      severity: "warning",
      field: "matricula",
    });
  }

  // 2. Nombre del Trabajador (siap_full_name como fuente de verdad)
  const rawFullName = (raw.full_name_raw ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
  if (!rawFullName) {
    issues.push({
      code: "MISSING_NAME",
      message: "Falta el nombre completo del trabajador.",
      severity: "error",
      field: "full_name",
    });
  }

  // 3. Plaza: Longitud numérica variable (entre 2 y 5 dígitos en el archivo real)
  // Convertir a texto, limpiar espacios, no rellenar con ceros a 7 dígitos.
  const plaza_code = (raw.plaza_raw ?? "").toString().trim().replace(/\s+/g, "");
  if (!plaza_code) {
    issues.push({
      code: "MISSING_PLAZA",
      message: "Falta el código de plaza.",
      severity: "warning",
      field: "plaza",
    });
  }

  // 4. RFC
  const rfc = (raw.rfc_raw ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    if (/^[A-ZÑ&]{3,4}\d{6}/.test(rfc)) {
      issues.push({
        code: "RFC_NO_HOMOCLAVE",
        message: `El RFC '${maskRfc(rfc)}' no cuenta con homoclave estándar de 13 posiciones.`,
        severity: "warning",
        field: "rfc",
      });
    } else {
      issues.push({
        code: "INVALID_RFC_FORMAT",
        message: `Formato de RFC sospechoso o incompleto: ${maskRfc(rfc)}.`,
        severity: "warning",
        field: "rfc",
      });
    }
  }

  // 5. CURP
  const curp = (raw.curp_raw ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
  if (curp) {
    if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp)) {
      issues.push({
        code: "INVALID_CURP_FORMAT",
        message: `Formato de CURP no estándar: ${maskCurp(curp)}.`,
        severity: "warning",
        field: "curp",
      });
    }
  }

  // 6. NSS: Guardar nss_raw (valor exacto como cadena, ej. 10 u 11 dígitos).
  // Si tiene 10 dígitos: normalizar a 11 dígitos con padStart(11, '0') y emitir advertencia NSS_LEADING_ZERO_RESTORED.
  // Si tiene 11 dígitos: preservar.
  const rawNssStr = (raw.nss_raw ?? "").toString().trim();
  const nss_raw = rawNssStr.replace(/\D/g, "");
  let nss = nss_raw;
  if (nss_raw) {
    if (nss_raw.length === 10) {
      nss = nss_raw.padStart(11, "0");
      issues.push({
        code: "NSS_LEADING_ZERO_RESTORED",
        message: `NSS de 10 dígitos detectado ('${maskNss(nss_raw)}'). Se normalizó a 11 dígitos agregando cero inicial: ${maskNss(nss)}.`,
        severity: "warning",
        field: "nss",
      });
    } else if (nss_raw.length !== 11) {
      issues.push({
        code: "INVALID_NSS_LENGTH",
        message: `El NSS tiene una longitud no estándar (${nss_raw.length} dígitos en lugar de 10 u 11).`,
        severity: "warning",
        field: "nss",
      });
    }
  }

  // 7. Area de Responsabilidad (A R): Exactamente 3 posiciones alfanuméricas
  const responsibility_area_code = (raw.area_raw ?? "").toString().trim().toUpperCase();
  if (responsibility_area_code && !/^[A-Z0-9]{3}$/.test(responsibility_area_code)) {
    issues.push({
      code: "INVALID_AR_FORMAT",
      message: `El área de responsabilidad '${responsibility_area_code}' no cumple el formato esperado de 3 posiciones.`,
      severity: "warning",
      field: "area",
    });
  }

  // 8. Fechas Ocupación y Centinela 2050-01-01
  const occupation_start_date = parseExcelDate(raw.occupation_start_raw);
  const occupation_limit_date = parseExcelDate(raw.occupation_limit_raw);
  const occupation_limit_is_sentinel = occupation_limit_date === "2050-01-01";

  // 9. Marca de Ocupación (MO): Código técnico SIAP. Texto numérico de 1 o más posiciones (^[0-9]+$)
  // Preservar valor crudo recibido. Todo valor numérico se acepta sin bloqueo ni advertencia inventada.
  // Valor no numérico emite MO_INVALID_FORMAT.
  const occupation_mark_code = (raw.occupation_mark_raw ?? "").toString().trim();
  if (occupation_mark_code) {
    if (!/^\d+$/.test(occupation_mark_code)) {
      issues.push({
        code: "MO_INVALID_FORMAT",
        message: `La marca de ocupación '${occupation_mark_code}' contiene caracteres no numéricos.`,
        severity: "warning",
        field: "occupation_mark",
      });
    }
  }

  // 10. Conceptos Asociados (C A)
  const { mask: associated_concepts_mask, concepts: associated_concepts } =
    decodeAssociatedConcepts(raw.associated_concepts_raw ?? "");

  // 11. Puesto (8 posiciones exactas) y Departamento (10 posiciones exactas)
  const position_code = (raw.position_code_raw ?? "").toString().trim().toUpperCase();
  if (position_code && !/^[A-Z0-9]{8}$/.test(position_code)) {
    issues.push({
      code: "INVALID_POSITION_CODE_LENGTH",
      message: `El código de puesto '${position_code}' no tiene las 8 posiciones alfanuméricas estándar.`,
      severity: "warning",
      field: "puesto",
    });
  }
  const position_description = (raw.position_desc_raw ?? "").toString().trim().toUpperCase();

  const department_code = (raw.department_code_raw ?? "").toString().trim().toUpperCase();
  if (department_code && !/^[A-Z0-9]{10}$/.test(department_code)) {
    issues.push({
      code: "INVALID_DEPARTMENT_CODE_LENGTH",
      message: `El código de departamento '${department_code}' no tiene las 10 posiciones alfanuméricas estándar.`,
      severity: "warning",
      field: "departamento",
    });
  }
  // department_description es opcional (puede venir vacía en el archivo canónico)
  const department_description = (raw.department_desc_raw ?? "").toString().trim().toUpperCase();

  // 12. Horario y Turno
  // Si horario es numérico, rellenar a 4 posiciones (ej. 112 -> 0112); alfanuméricos como D731 se preservan
  let schedule_code = (raw.schedule_code_raw ?? "").toString().trim().toUpperCase();
  if (schedule_code && /^\d+$/.test(schedule_code) && schedule_code.length < 4) {
    schedule_code = schedule_code.padStart(4, "0");
  }
  const schedule_description = (raw.schedule_desc_raw ?? "").toString().trim().toUpperCase();
  const shift_code = (raw.shift_raw ?? "").toString().trim();
  if (shift_code && !SHIFT_CATALOG[shift_code]) {
    issues.push({
      code: "SHIFT_UNKNOWN_CODE",
      message: `Código de turno '${shift_code}' no catalogado oficialmente en SIAP.`,
      severity: "warning",
      field: "shift_code",
    });
  }
  const turn = deriveTurn(shift_code, schedule_description);

  // 13. Antigüedad
  const seniority_raw = (raw.seniority_raw ?? "").toString().trim();
  const { years: seniority_years, fortnights: seniority_fortnights, days: seniority_days } =
    parseSeniority(seniority_raw);

  // 14. Fechas Laborales
  const employment_start_date = parseExcelDate(raw.employment_start_raw);
  const reemployment_date = parseExcelDate(raw.reemployment_date_raw);
  const termination_date = parseExcelDate(raw.termination_date_raw);

  // 15. Tipo de Contratación (TC): '0' | '1' | '2' | '5' | '9'
  const contract_type_code = (raw.contract_type_raw ?? "").toString().trim();
  if (contract_type_code && !TC_CATALOG[contract_type_code]) {
    issues.push({
      code: "TC_UNKNOWN_CODE",
      message: `Código TC '${contract_type_code}' no catalogado oficialmente en SIAP.`,
      severity: "warning",
      field: "contract_type_code",
    });
  }

  // 16. Tipo de Plaza: normalizar a 2 posiciones ('1' -> '01')
  let plaza_type_code = (raw.plaza_type_raw ?? "").toString().trim();
  if (plaza_type_code.length === 1 && /^\d$/.test(plaza_type_code)) {
    plaza_type_code = plaza_type_code.padStart(2, "0");
  }
  if (plaza_type_code && !TIPO_PLAZA_CATALOG[plaza_type_code]) {
    issues.push({
      code: "TIPO_PLAZA_UNKNOWN",
      message: `Código de Tipo de Plaza '${plaza_type_code}' no catalogado oficialmente en SIAP.`,
      severity: "warning",
      field: "plaza_type_code",
    });
  }

  // No automatic name decomposition: manual names remain strictly empty upon import
  const parsed: ParsedWorkerRow = {
    contract_type_code,
    plaza_code,
    responsibility_area_code,
    occupation_start_date,
    occupation_limit_date,
    occupation_limit_is_sentinel,
    occupation_mark_code,
    plaza_type_code,
    shift_code,
    associated_concepts_mask,
    associated_concepts,
    position_code,
    position_description,
    department_code,
    department_description,
    schedule_code,
    schedule_description,
    matricula,
    siap_full_name: rawFullName,
    first_name: "",
    paternal_surname: "",
    maternal_surname: "",
    seniority_raw,
    seniority_years,
    seniority_fortnights,
    seniority_days,
    rfc,
    curp,
    nss_raw,
    nss,
    employment_start_date,
    reemployment_date,
    source_status_code: (raw.status_raw ?? "").toString().trim(),
    termination_code: (raw.termination_code_raw ?? "").toString().trim(),
    termination_date,
    micro_group_code: (raw.micro_group_raw ?? "").toString().trim(),
    turn,
    source_name_raw: rawFullName,
    locker: normalizeLockerNumber(raw.locker_raw).normalized,
    is_semantic_locker: normalizeLockerNumber(raw.locker_raw).isSemantic,
    raw_observations: (raw.observations_raw ?? "").toString().trim(),
  };

  const hasError = issues.some((i) => i.severity === "error");

  return {
    parsed,
    issues,
    isValid: !hasError,
  };
}
