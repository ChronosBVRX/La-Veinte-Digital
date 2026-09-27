// src/features/representacion/lib/category-normalizer.ts
// Motor puro de normalización y agrupación de categorías laborales para el padrón sindical.
// Elimina inconsistencias tipográficas, abreviaciones, diferencias de género contractual,
// códigos de jornada (80, 65, 60, etc.) y contaminación de horarios en la celda.

export interface NormalizedCategoryResult {
  canonicalName: string;
  rawInput: string;
  matchedCode?: string;
  extractedJornada?: string;
  confidence: "catalog_alias" | "rule_normalized" | "exact_clean" | "anomaly";
}

/**
 * Diccionario maestro de mapeo directo para unificar variantes ortográficas,
 * abreviaciones institucionales y equivalencias contractuales del IMSS.
 */
const CANONICAL_ALIAS_MAP: ReadonlyMap<string, string> = new Map([
  // --- Limpieza e Higiene ---
  ["AUX LIMPIEZA E HIGIENE UM Y NO MED", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AYTE LIMPIEZA E HIGIENE UM Y NO MED", "AYUDANTE DE LIMPIEZA E HIGIENE"],
  ["AUXILIAR DE LIMPIEZA E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUX DE LIMPIEZA E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUXILIAR DE HIGIENE Y LIMPIEZA", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUX DE HIGIENE Y LIMPIEZA", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUXILIAR DE HIGIENE Y LIMP", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUX DE LIMPIEZ E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUX DELIMPIEZA E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUX DE HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AUXILIAT DE LIMPIEZA E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AXILIAR DELIMPIEZA HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],
  ["AYUDANTE DE LIMPIEZA E HIGIENE", "AYUDANTE DE LIMPIEZA E HIGIENE"],
  ["AUXILIAR DE LIPIEZA E HIGIENE", "AUXILIAR DE LIMPIEZA E HIGIENE"],

  // --- Enfermería ---
  ["ENFERMERA GENERAL", "ENFERMERA GENERAL"],
  ["ENFERMERO GENERAL", "ENFERMERA GENERAL"],
  ["ENFERMERA GENRAL", "ENFERMERA GENERAL"],
  ["ENFERMERA GRAL", "ENFERMERA GENERAL"],
  ["ENF GENERAL", "ENFERMERA GENERAL"],
  ["ENF GRAL", "ENFERMERA GENERAL"],
  ["ENFERMERIA GRAL", "ENFERMERA GENERAL"],
  ["ENFERMERA GENERAL CLINICA", "ENFERMERA GENERAL CLINICA"],
  ["ENFERMERO GENERAL CLINICA", "ENFERMERA GENERAL CLINICA"],
  ["ENFERMERA GRAL CLINICA", "ENFERMERA GENERAL CLINICA"],
  ["ENFERMERA ESPECIALISTA", "ENFERMERA ESPECIALISTA"],
  ["ENFERMERO ESPECIALISTA", "ENFERMERA ESPECIALISTA"],
  ["ENFERMERA ESP", "ENFERMERA ESPECIALISTA"],
  ["ENFERMERA QUIRURGICA", "ENFERMERA ESPECIALISTA"],
  ["ENFERMERA JEFE DE PISO", "ENFERMERA JEFE DE PISO"],
  ["AUX DE ENFERMERIA GRAL", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUXILIAR DE ENFERMERA GENERAL", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUXILIAR DE ENFERMERIA", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUXILIAR ENFERMERIA", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUX ENFERMERA GENERAL", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUX DE ENFERMERIA", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["AUX ENFERMERIA U M", "AUXILIAR DE ENFERMERIA GENERAL"],
  ["ENF ESPEC SALUD PUBL", "ENFERMERA ESPECIALISTA EN SALUD PUBLICA"],

  // --- Médicos y Especialistas ---
  ["MEDICO NO FAMILIAR", "MEDICO NO FAMILIAR"],
  ["MEDICO FAMILIAR", "MEDICO FAMILIAR"],
  ["MEDICO GENERAL", "MEDICO GENERAL"],
  ["CIRUJANO MAXILO FACIAL", "CIRUJANO MAXILOFACIAL"],
  ["RESIDENTE 1", "RESIDENTE 1"],
  ["RESIDENTE 2", "RESIDENTE 2"],
  ["RESIDENTE 3", "RESIDENTE 3"],
  ["RESIDENTE 4", "RESIDENTE 4"],
  ["INTERNO DE PREGRADO", "INTERNO DE PREGRADO"],

  // --- Asistente Médica y Trabajo Social ---
  ["ASISTENTE MEDICA", "ASISTENTE MEDICA"],
  ["ASISTENTE MEDICO", "ASISTENTE MEDICA"],
  ["TRABAJADORA SOCIAL", "TRABAJADORA SOCIAL"],
  ["TRABAJADOR SOCIAL", "TRABAJADORA SOCIAL"],
  ["TRABAJADOR SOCIAL CLINICO", "TRABAJADOR SOCIAL CLINICO"],

  // --- Camilleros y Choferes ---
  ["CAMILLERO", "CAMILLERO EN UNIDADES HOSPITALARIAS"],
  ["CAMILLERO EN UNIDADES HOSPITALARIAS", "CAMILLERO EN UNIDADES HOSPITALARIAS"],
  ["CHOFER", "CHOFER"],

  // --- Alimentos y Cocina ---
  ["MANEJADOR ALIMENTOS", "MANEJADOR DE ALIMENTOS"],
  ["MANEJADOR DE ALIMENTOS", "MANEJADOR DE ALIMENTOS"],
  ["NUTRICIONISTA DIETISTA", "NUTRICIONISTA DIETISTA"],
  ["ESP NUTRIC DIETETICA", "ESPECIALISTA EN NUTRICION Y DIETETICA"],
  ["COCINERO TECNICO 1", "COCINERO TECNICO 1"],
  ["COCINERO TECNICO 2", "COCINERO TECNICO 2"],

  // --- Laboratorio y Farmacia ---
  ["LABORATORISTA", "LABORATORISTA"],
  ["AUX DE LABORATORIO", "AUXILIAR DE LABORATORIO"],
  ["AUXILIAR DE LABORATORIO", "AUXILIAR DE LABORATORIO"],
  ["QUIMICO CLINICO", "QUIMICO CLINICO"],
  ["AYUDANTE DE FARMACIA", "AYUDANTE DE FARMACIA"],
  ["AUXILIAR DE FARMACIA", "AUXILIAR DE FARMACIA"],
  ["OFICIAL DE FARMACIA", "OFICIAL DE FARMACIA"],
  ["COORDINADOR DE FARMACIA", "COORDINADOR DE FARMACIA"],
  ["RESP SAN FARM HOSP 2DO NIVEL TIPO A", "RESPONSABLE SANITARIO FARMACIA HOSPITALARIA"],

  // --- Almacén y Abastecimiento ---
  ["AUXILIAR DE ALMACEN", "AUXILIAR DE ALMACEN"],
  ["OFICIAL DE ALMACEN", "OFICIAL DE ALMACEN"],
  ["COORDINADOR DE ALMACEN", "COORDINADOR DE ALMACEN"],

  // --- Oficinas y Administrativos ---
  ["AUX UNIV DE OFICINAS", "AUXILIAR UNIVERSAL DE OFICINAS"],
  ["AUXILIAR GENERAL", "AUXILIAR GENERAL"],
  ["OFICIAL DE ESTADISTICA", "OFICIAL DE ESTADISTICA"],
  ["COORD DE ESTADISTICA", "COORDINADOR DE ESTADISTICA"],
  ["JEFE GPO ESTADISTICA", "JEFE DE GRUPO DE ESTADISTICA"],
  ["OFICIAL DE PERSONAL", "OFICIAL DE PERSONAL"],
  ["COORD DE PERSONAL", "COORDINADOR DE PERSONAL"],
  ["COORD ASIST MEDICAS", "COORDINADOR DE ASISTENTES MEDICAS"],

  // --- Técnicos y Mantenimiento ---
  ["TECNICO RADIOLOGO", "TECNICO RADIOLOGO"],
  ["TERAPISTA FISICO", "TERAPISTA FISICO"],
  ["TERAPISTA OCUPACIONAL", "TERAPISTA OCUPACIONAL"],
  ["INHALOTERAPEUTA", "INHALOTERAPEUTA"],
  ["HINALOTERAPEUTA", "INHALOTERAPEUTA"],
  ["TECNICO MECANICO", "TECNICO MECANICO"],
  ["TEC MECANICO", "TECNICO MECANICO"],
  ["TECNICO PLOMERO", "TECNICO PLOMERO"],
  ["TECNICO ELECTRICISTA", "TECNICO ELECTRICISTA"],
  ["TECNICO ELECTRONICO", "TECNICO ELECTRONICO"],
  ["TECNICO POLIVALENTE", "TECNICO POLIVALENTE"],
  ["TECNICO DE BIBLIOTECAS", "TECNICO DE BIBLIOTECAS"],
  ["ASIST BIBLIOTECARIO", "ASISTENTE BIBLIOTECARIO"],
  ["TEC A AIRE ACON REFRIG", "TECNICO A EN AIRE ACONDICIONADO Y REFRIGERACION"],
  ["TEC A EQUIPOS MEDICOS", "TECNICO A EN EQUIPOS MEDICOS"],
  ["TEC B EQUIPOS MEDICOS", "TECNICO B EN EQUIPOS MEDICOS"],
  ["TEC C FLUIDOS ENERGET", "TECNICO C EN FLUIDOS Y ENERGETICOS"],
  ["TEC EQ HELICOIDAL", "TECNICO EN EQUIPO HELICOIDAL"],
  ["TEC EQ RECIPROCANTES", "TECNICO EN EQUIPOS RECIPROCANTES"],
  ["TEC MANEJO AP ELECTRODI", "TECNICO EN MANEJO DE APARATOS DE ELECTRODIAGNOSTICO"],
  ["AUX SOPORTE TEC INFORMAT", "AUXILIAR DE SOPORTE TECNICO EN INFORMATICA"],

  // --- Lavandería e Intendencia ---
  ["OP SERVS DE LAVANDERIA", "OPERADOR DE SERVICIOS DE LAVANDERIA"],
  ["OF SERVS DE LAVANDERIA", "OFICIAL DE SERVICIOS DE LAVANDERIA"],
  ["AUX DE SERVS DE INT", "AUXILIAR DE SERVICIOS DE INTENDENCIA"],
  ["OP MAQUINA DE REV AUT", "OPERADOR DE MAQUINA DE REVISION AUTOMATICA"],

  // --- Transporte y Comunicación ---
  ["OPERADOR AMBULANCIAS", "OPERADOR DE AMBULANCIAS"],
  ["OPERADOR TELEFONICO A", "OPERADOR TELEFONICO A"],
  ["MENSAJERO", "MENSAJERO"],

  // --- Clínicos y Paramédicos ---
  ["CITOTECNOLOGO", "CITOTECNOLOGO"],
  ["HISTOTECNOLOGO", "HISTOTECNOLOGO"],
  ["FONOAUDIOLOGO", "FONOAUDIOLOGO"],
  ["PSICOLOGO CLINICO", "PSICOLOGO CLINICO"],
  ["YESISTA", "YESISTA"],
  ["AYUDANTE DE AUTOPSIA", "AYUDANTE DE AUTOPSIA"],

  // --- Personal de Confianza / Niveles N ---
  ["N17 CONTROLADOR INCIDENCIAS REC HUM", "N17 CONTROLADOR DE INCIDENCIAS DE RECURSOS HUMANOS"],
  ["N20 TEC INF C CTR P INV", "N20 TECNICO EN INFORMATICA C CENTRO INVESTIGACION"],
  ["N25 J O DIE ENS UMH AYB", "N25 JEFE DE DIETETICA ENSEÑANZA UMH A Y B"],
  ["N25 TECNICA ATN OR DER", "N25 TECNICA EN ATENCION Y ORIENTACION AL DERECHOHABIENTE"],
  ["N30 SUP AREA ROPERIA UMH", "N30 SUPERVISOR DE AREA ROPERIA UMH"],
  ["N32 JEFE LIMP E HIG UMAE HGR HGZ", "N32 JEFE DE LIMPIEZA E HIGIENE UMAE HGR HGZ"],
  ["N36 ANALISTA RESP D", "N36 ANALISTA RESPONSABLE D"],
  ["N36 JEF D NUT DIE UMHA", "N36 JEFE DE NUTRICION Y DIETETICA UMH A"],
  ["N36 JEF TRAB SOC UMH A", "N36 JEFE DE TRABAJO SOCIAL UMH A"],
  ["N36 SUBJEF A CONS UNID", "N36 SUBJEFE A CONSULTA DE UNIDAD"],
  ["N39 SUPERVISOR LIMPIEZA E HIGIENE", "N39 SUPERVISOR DE LIMPIEZA E HIGIENE"],
  ["N41 ANALISTA COORD C", "N41 ANALISTA COORDINADOR C"],
  ["N41 COORD CURSOS TEC", "N41 COORDINADOR DE CURSOS TECNICOS"],
  ["N41 SUBJ ENF UM A", "N41 SUBJEFE DE ENFERMERIA UM A"],
  ["N47 JEFE DEPTO UMH A", "N47 JEFE DE DEPARTAMENTO UMH A"],
  ["N51 JEFE DE LABORATORIO UMH", "N51 JEFE DE LABORATORIO UMH"],
  ["N51 JEFE SERVICIO UMH", "N51 JEFE DE SERVICIO UMH"],
  ["N52 COORD CLINICO UMH", "N52 COORDINADOR CLINICO UMH"],
  ["N53 COORD CL TURNO UMH", "N53 COORDINADOR CLINICO DE TURNO UMH"],
  ["N54 SUBDIR ADMVO UMH A", "N54 SUBDIRECTOR ADMINISTRATIVO UMH A"],
  ["N55 SUBD MED UMH A", "N55 SUBDIRECTOR MEDICO UMH A"],
  ["N56 DIRECTOR UMH A", "N56 DIRECTOR UMH A"],
  ["CONSULTORA AL DERECHOHABIENTE", "CONSULTORA AL DERECHOHABIENTE"],
  ["CONTROLADOR INCIDENCIAS REC HUM", "CONTROLADOR DE INCIDENCIAS DE RECURSOS HUMANOS"],
  ["ESPECIAL SEG EN EL TRABAJO", "ESPECIALISTA EN SEGURIDAD EN EL TRABAJO"],
  ["TEC ATN DERECHOHABIENTE", "TECNICO EN ATENCION AL DERECHOHABIENTE"],
]);

export const CATEGORY_PENDING_REVIEW = "PENDIENTE DE REVISION";

/**
 * Mapa inverso canónico -> conjunto de variantes conocidas para optimización de queries.
 */
const REVERSE_ALIAS_MAP: Map<string, Set<string>> = new Map();
for (const [raw, canon] of CANONICAL_ALIAS_MAP.entries()) {
  if (!REVERSE_ALIAS_MAP.has(canon)) {
    REVERSE_ALIAS_MAP.set(canon, new Set([canon]));
  }
  REVERSE_ALIAS_MAP.get(canon)!.add(raw);
}

/**
 * Expande una lista de categorías canónicas para incluir todas sus variantes textuales conocidas
 * en la base de datos, garantizando que filtros por categoría encuentren tanto registros normalizados
 * como cualquier registro histórico previo a la homologación.
 */
export function getCategoryQueryVariants(categories: string[]): string[] {
  const result = new Set<string>();
  for (const cat of categories) {
    const trimmed = (cat || "").trim();
    if (!trimmed) continue;
    result.add(trimmed);
    const variants = REVERSE_ALIAS_MAP.get(trimmed);
    if (variants) {
      for (const v of variants) {
        result.add(v);
        // Variantes comunes con padding o sufijo de jornada
        result.add(`${v} 80`);
        result.add(`${v}      80`);
        result.add(`${v} 65`);
        result.add(`${v}       65`);
        result.add(`${v} 60`);
        result.add(`${v}      60`);
      }
    }
  }
  return [...result];
}

/**
 * Normaliza cualquier variante de categoría a su forma canónica única.
 */
export function normalizeCategory(
  raw: string | null | undefined,
  positionCode?: string | null | undefined,
): NormalizedCategoryResult {
  const input = typeof raw === "string" ? raw : "";
  const trimmed = input.trim();

  // Detectar anomalías obvias o entradas vacías
  if (
    trimmed === "" ||
    trimmed === "(VACIO)" ||
    trimmed === "(NULL)" ||
    trimmed.toUpperCase() === "JUAN DE DIOS"
  ) {
    return {
      canonicalName: CATEGORY_PENDING_REVIEW,
      rawInput: input,
      matchedCode: positionCode?.trim() || undefined,
      confidence: "anomaly",
    };
  }

  // 1. Quitar acentos y diacríticos
  let s = trimmed
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 2. Limpieza de contaminación de horarios y turnos incrustados en la celda
  s = s.replace(/DE \d{1,2}:\s*\d{2}\s*A\s*\d{1,2}:\s*\d{2}.*$/i, "");
  s = s.replace(/\d{1,2}:\s*\d{2}\s*A\s*\d{1,2}:\s*\d{2}.*$/i, "");
  s = s.replace(/\bTURNO\s+(MATUTINO|VESPERTINO|NOCTURNO|MIXTO|ACUMULADA|JORNADA)\b.*/i, "");
  s = s.replace(/\bJORNADA\s+(MIXTA|ACUMULADA)\b.*/i, "");
  s = s.trim();

  // 3. Extracción y remoción de sufijo de jornada laboral (80, 65, 60, 40, 20, E0, 6.5)
  let extractedJornada: string | undefined;
  const jornadaMatch = s.match(/(?:\s+|^)(80|65|60|40|20|E0|6\.5)$/);
  if (jornadaMatch) {
    extractedJornada = jornadaMatch[1];
    s = s.slice(0, jornadaMatch.index).trim();
  } else {
    // Casos especiales donde no hubo espacio (ej. ESPECIALISTA0, FARMACIA80, INV80)
    const attachedMatch = s.match(/(\D)(80|65|60|40|20|E0|0)$/);
    if (attachedMatch) {
      extractedJornada = attachedMatch[2] === "0" ? "80" : attachedMatch[2];
      s = s.slice(0, attachedMatch.index ? attachedMatch.index + 1 : 1).trim();
    }
  }

  // 4. Limpieza de caracteres de puntuación
  s = s.replace(/[\.\,\-\_\/\(\)\:]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // 5. Coincidencia directa con mapa de alias
  if (CANONICAL_ALIAS_MAP.has(s)) {
    return {
      canonicalName: CANONICAL_ALIAS_MAP.get(s)!,
      rawInput: input,
      matchedCode: positionCode?.trim() || undefined,
      extractedJornada,
      confidence: "catalog_alias",
    };
  }

  // 6. Expansión de abreviaciones y corrección tipográfica general
  const general = s
    .replace(/\bENF\b/g, "ENFERMERA")
    .replace(/\bGRAL\b/g, "GENERAL")
    .replace(/\bGENRAL\b/g, "GENERAL")
    .replace(/\bAUX\b/g, "AUXILIAR")
    .replace(/\bAUXILIAT\b/g, "AUXILIAR")
    .replace(/\bAXILIAR\b/g, "AUXILIAR")
    .replace(/\bDELIMPIEZA\b/g, "DE LIMPIEZA")
    .replace(/\bLIPIEZA\b/g, "LIMPIEZA")
    .replace(/\bLIMPIEZ\b/g, "LIMPIEZA")
    .replace(/\bAYTE\b/g, "AYUDANTE")
    .replace(/\bAYUD\b/g, "AYUDANTE")
    .replace(/\bTEC\b/g, "TECNICO")
    .replace(/\bADMVO\b/g, "ADMINISTRATIVO")
    .replace(/\bDEPTO\b/g, "DEPARTAMENTO")
    .replace(/\bESP\b/g, "ESPECIALISTA")
    .replace(/\bLIMP\b/g, "LIMPIEZA")
    .replace(/\bHINALOTERAPEUTA\b/g, "INHALOTERAPEUTA")
    .replace(/\bENFERMERO GENERAL\b/g, "ENFERMERA GENERAL")
    .replace(/\bENFERMERO ESPECIALISTA\b/g, "ENFERMERA ESPECIALISTA")
    .replace(/\bTRABAJADOR SOCIAL\b/g, "TRABAJADORA SOCIAL")
    .replace(/\bASISTENTE MEDICO\b/g, "ASISTENTE MEDICA")
    .replace(/\s+/g, " ")
    .trim();

  if (CANONICAL_ALIAS_MAP.has(general)) {
    return {
      canonicalName: CANONICAL_ALIAS_MAP.get(general)!,
      rawInput: input,
      matchedCode: positionCode?.trim() || undefined,
      extractedJornada,
      confidence: "rule_normalized",
    };
  }

  return {
    canonicalName: general,
    rawInput: input,
    matchedCode: positionCode?.trim() || undefined,
    extractedJornada,
    confidence: "exact_clean",
  };
}

/**
 * Función auxiliar que devuelve exclusivamente la cadena canónica resultante.
 */
export function canonicalizeCategoryName(
  raw: string | null | undefined,
  positionCode?: string | null | undefined,
): string {
  return normalizeCategory(raw, positionCode).canonicalName;
}
