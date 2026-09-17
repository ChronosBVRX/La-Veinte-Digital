export function normalizeHeaderText(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\./g, "")              // Remove dots e.g. C.U.R.P. -> curp
    .replace(/[_\-/\\#]/g, " ")      // Replace hyphens, slashes, # with space
    .replace(/\s+/g, " ")            // Collapse multi-spaces
    .trim();
}

export const CANONICAL_FIELD_MAP: Record<string, string> = {
  // Locker / Casillero
  "locker": "locker_raw",
  "lockers": "locker_raw",
  "no locker": "locker_raw",
  "num locker": "locker_raw",
  "numero locker": "locker_raw",
  "casillero": "locker_raw",
  "casilleros": "locker_raw",
  "no casillero": "locker_raw",
  "num casillero": "locker_raw",
  "numero casillero": "locker_raw",

  // Observaciones
  "observaciones": "observations_raw",
  "observacion": "observations_raw",
  "observaciones de actualizacion": "observations_raw",
  "actualizacion": "observations_raw",
  "actualizado": "observations_raw",

  // Tipo Contrato
  "tc": "contract_type_raw",
  "tipo contrato": "contract_type_raw",
  "contrato": "contract_type_raw",
  "cve contrato": "contract_type_raw",

  // Plaza
  "plaza": "plaza_raw",
  "cve plaza": "plaza_raw",
  "no plaza": "plaza_raw",

  // Area de Responsabilidad (A R)
  "a r": "area_raw",
  "ar": "area_raw",
  "area responsabilidad": "area_raw",
  "area de responsabilidad": "area_raw",

  // Inicio Ocupacion
  "fech ocu": "occupation_start_raw",
  "fec ocu": "occupation_start_raw",
  "inicio ocupa": "occupation_start_raw",
  "inicio ocupacion": "occupation_start_raw",
  "fec inicio ocupa": "occupation_start_raw",

  // Limite Ocupacion
  "lim ocu": "occupation_limit_raw",
  "limite ocupa": "occupation_limit_raw",
  "limite ocupacion": "occupation_limit_raw",
  "fec lim ocu": "occupation_limit_raw",

  // Marca Ocupacion
  "mo": "occupation_mark_raw",
  "mca ocu": "occupation_mark_raw",
  "marca ocupa": "occupation_mark_raw",
  "marca ocupacion": "occupation_mark_raw",

  // Tipo Plaza
  "tipo plaza": "plaza_type_raw",
  "tipo de plaza": "plaza_type_raw",

  // Jornada / Turno
  "jor": "shift_raw",
  "jornada": "shift_raw",
  "turno": "shift_raw",
  "tipo jornada": "shift_raw",

  // Conceptos Asociados (C A)
  "c a": "associated_concepts_raw",
  "ca": "associated_concepts_raw",
  "conceptos asociados": "associated_concepts_raw",

  // Puesto
  "puesto": "position_code_raw",
  "cve puesto": "position_code_raw",
  "clave puesto": "position_code_raw",

  // Descripcion Puesto
  "descripcion 1": "position_desc_raw",
  "descripcion puesto": "position_desc_raw",
  "desc puesto": "position_desc_raw",
  "nombre puesto": "position_desc_raw",
  "categoria": "position_desc_raw",

  // Departamento
  "depto": "department_code_raw",
  "cve depto": "department_code_raw",
  "clave depto": "department_code_raw",
  "departamento": "department_code_raw",

  // Descripcion Departamento
  "descripcion 2": "department_desc_raw",
  "descripcion depto": "department_desc_raw",
  "desc depto": "department_desc_raw",
  "descripcion departamento": "department_desc_raw",
  "adscripcion": "department_desc_raw",

  // Horario
  "horario": "schedule_code_raw",
  "cve horario": "schedule_code_raw",
  "clave horario": "schedule_code_raw",

  // Descripcion Horario
  "descripcion 3": "schedule_desc_raw",
  "descripcion horario": "schedule_desc_raw",
  "desc horario": "schedule_desc_raw",

  // Matricula
  "matricula": "matricula_raw",
  "no empleado": "matricula_raw",
  "num empleado": "matricula_raw",
  "numero empleado": "matricula_raw",

  // Nombre del Trabajador
  "nombre del trabajador": "full_name_raw",
  "nombre trabajador": "full_name_raw",
  "nombre": "full_name_raw",
  "trabajador": "full_name_raw",

  // Antigüedad
  "antiguedad": "seniority_raw",
  "antigüedad": "seniority_raw",
  "tiempo servicio": "seniority_raw",

  // R.F.C.
  "rfc": "rfc_raw",
  "r f c": "rfc_raw",

  // C.U.R.P.
  "curp": "curp_raw",
  "c u r p": "curp_raw",

  // N.S.S.
  "nss": "nss_raw",
  "n s s": "nss_raw",
  "numero de seguridad social": "nss_raw",
  "no seguridad social": "nss_raw",

  // Inicio Relacion Laboral
  "inicio relacion laboral": "employment_start_raw",
  "fecha ingreso": "employment_start_raw",
  "fec ingreso": "employment_start_raw",
  "ingreso": "employment_start_raw",

  // Fecha Reingreso
  "fecha reingreso": "reemployment_date_raw",
  "fec reingreso": "reemployment_date_raw",
  "reingreso": "reemployment_date_raw",

  // Status
  "status": "status_raw",
  "estatus": "status_raw",
  "estado": "status_raw",

  // Cve Baja
  "cve baja": "termination_code_raw",
  "clave baja": "termination_code_raw",
  "motivo baja": "termination_code_raw",

  // Fecha Baja
  "fecha baja": "termination_date_raw",
  "fecha de baja": "termination_date_raw",
  "fec baja": "termination_date_raw",

  // Micro Grupo
  "micro grupo": "micro_group_raw",
  "micro y grupo": "micro_group_raw",
  "microgrupo": "micro_group_raw",
};

export const MANDATORY_FIELDS = [
  { key: "matricula_raw", label: "Matrícula" },
  { key: "full_name_raw", label: "Nombre del Trabajador" },
  { key: "plaza_raw", label: "Plaza" },
] as const;

export interface HeaderMapResult {
  valid: boolean;
  columnMap: Map<number, string>; // column index (1-based) -> canonical field key
  rawHeaders: string[];
  missingMandatoryFields: string[];
  unmappedColumns: Array<{ index: number; header: string }>;
  error?: string;
}

export function mapHeaders(headers: string[]): HeaderMapResult {
  const columnMap = new Map<number, string>();
  const unmappedColumns: Array<{ index: number; header: string }> = [];
  const matchedCanonicalKeys = new Set<string>();
  const seenHeaderStrings = new Set<string>();

  for (let idx = 0; idx < headers.length; idx++) {
    const cleanHeader = (headers[idx] ?? "").toString().trim();
    if (!cleanHeader) continue;

    const normalized = normalizeHeaderText(cleanHeader);
    if (seenHeaderStrings.has(normalized)) {
      return {
        valid: false,
        columnMap,
        rawHeaders: headers,
        missingMandatoryFields: [],
        unmappedColumns,
        error: `Se detectaron encabezados duplicados en el archivo: "${cleanHeader}".`,
      };
    }
    seenHeaderStrings.add(normalized);

    const colIndex = idx + 1;
    const canonicalKey = CANONICAL_FIELD_MAP[normalized];

    if (canonicalKey) {
      columnMap.set(colIndex, canonicalKey);
      matchedCanonicalKeys.add(canonicalKey);
    } else {
      unmappedColumns.push({ index: colIndex, header: cleanHeader });
    }
  }

  const missingMandatoryFields = MANDATORY_FIELDS.filter(
    (m) => !matchedCanonicalKeys.has(m.key)
  ).map((m) => m.label);

  const valid = missingMandatoryFields.length === 0;

  return {
    valid,
    columnMap,
    rawHeaders: headers,
    missingMandatoryFields,
    unmappedColumns,
    error: valid
      ? undefined
      : `Faltan columnas obligatorias indispensables: ${missingMandatoryFields.join(", ")}.`,
  };
}
