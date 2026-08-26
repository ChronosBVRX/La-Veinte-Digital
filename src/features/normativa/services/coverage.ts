import type { NormativeCatalog } from "./catalog";

export interface CoverageItem {
  id: string;
  label: string;
  status: "available" | "unavailable" | "review";
  note?: string;
}

export interface CoverageReport {
  topic: string;
  items: CoverageItem[];
  available: number;
  total: number;
  coverage: number;
  critical: CoverageItem[];
  recommended: boolean;
  warnings: string[];
}

interface CoverageRule {
  match: RegExp;
  required: Array<{ id: string; label: string; review?: boolean }>;
  optional?: Array<{ id: string; label: string }>;
}

const RULES: CoverageRule[] = [
  {
    match: /tiempo extra|extraordinario|horas extra/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A74-003-031", label: "Procedimiento 1A74-003-031 (tiempo extraordinario)" },
      { id: "LFT", label: "Ley Federal del Trabajo" },
    ],
  },
  {
    match: /horario|cambiar.*turno|turno|jornada/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "CCT::RIT", label: "Reglamento Interior de Trabajo" },
      { id: "IMSS-1A74-003-032", label: "Procedimiento 1A74-003-032 (modificación de horarios)" },
      { id: "LFT", label: "Ley Federal del Trabajo" },
    ],
  },
  {
    match: /vacaci[óo]n|vacaciones/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A74-003-025", label: "Procedimiento 1A74-003-025 (vacaciones)" },
    ],
  },
  {
    match: /guardia|guardias/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A74-003-023", label: "Procedimiento 1A74-003-023 (guardias)" },
    ],
  },
  {
    match: /falta|retardo|asistencia|puntualidad|biom[ée]trico|checador|sustituc/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A74-003-034", label: "Procedimiento 1A74-003-034 (asistencia, puntualidad y sustituciones)" },
    ],
  },
  {
    match: /accidente|riesgo.*trabajo|ST-?7/i,
    required: [
      { id: "LSS", label: "Ley del Seguro Social" },
      { id: "IMSS-3A21-003-010", label: "Procedimiento 3A21-003-010 (accidentes de trabajo, ST-7)" },
    ],
    optional: [{ id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" }],
  },
  {
    match: /enfermedad.*trabajo|ST-?9/i,
    required: [
      { id: "LSS", label: "Ley del Seguro Social" },
      { id: "IMSS-3A21-003-003", label: "Procedimiento 3A21-003-003 (enfermedades de trabajo, ST-9)" },
    ],
  },
  {
    match: /incapacidad|incapacidades|maternidad|enfermedad general/i,
    required: [
      { id: "LSS", label: "Ley del Seguro Social" },
      { id: "IMSS-9220-003-329", label: "Procedimiento 9220-003-329 (subsidios e incapacidades)" },
    ],
    optional: [{ id: "IMSS-1A75-B03-013", label: "Procedimiento 1A75-B03-013 (bolsa, sustitutos y temporales)" }],
  },
  {
    match: /bolsa|sustituto|aspirante|candidato/i,
    required: [
      { id: "IMSS-1A75-003-010", label: "Procedimiento 1A75-003-010 (Bolsa de Trabajo)" },
      { id: "CCT::BOLSA", label: "Reglamento de Bolsa de Trabajo (CCT)" },
    ],
    optional: [{ id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" }],
  },
  {
    match: /residencia|cambio.*lugar/i,
    required: [
      { id: "IMSS-1A74-003-029", label: "Procedimiento 1A74-003-029 (cambio de residencia)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027 (Cláusula 99)" },
    ],
  },
  {
    match: /plaza|cat[áa]logo|categor[ií]a/i,
    required: [
      { id: "IMSS-1A74-003-030", label: "Procedimiento 1A74-003-030 (catálogo de plazas)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    ],
  },
  {
    match: /plantilla|enfermer/i,
    required: [{ id: "IMSS-2900-B03-002", label: "Procedimiento 2900-B03-002 (plantillas de personal)" }],
  },
  {
    match: /sindicato|sindical|estatuto|honor y justicia/i,
    required: [{ id: "SNTSS-ESTATUTOS-2022", label: "Estatutos SNTSS (edición octubre 2022)", review: true }],
  },
  {
    match: /permiso sindical|comisi[óo]n sindical/i,
    required: [
      { id: "IMSS-1A31-003-007", label: "Procedimiento 1A31-003-007 (permisos sindicales)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    ],
  },
  {
    match: /permiso|licencia/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A31-003-016", label: "Procedimiento 1A31-003-016 (permisos temporales CCT cláusula 41)" },
      { id: "IMSS-1A31-003-003", label: "Procedimiento 1A31-003-003 (permisos sin goce)" },
    ],
  },
  {
    match: /sanci[óo]n|sanciones|reconsider/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A31-003-015", label: "Procedimiento 1A31-003-015 (reconsiderar sanciones laborales)" },
    ],
  },
  {
    match: /antig[üu]edad/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A31-003-001", label: "Procedimiento 1A31-003-001 (reconocimiento de antigüedad)" },
    ],
  },
  {
    match: /n[óo]mina|alta|baja|movimiento.*trabajador|SIAP/i,
    required: [
      { id: "IMSS-1A74-003-033", label: "Procedimiento 1A74-003-033 (altas, bajas y cambios en nómina)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    ],
  },
  {
    match: /fondo de ahorro/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A74-003-024", label: "Procedimiento 1A74-003-024 (fondo de ahorro)" },
    ],
  },
  {
    match: /jubilaci[óo]n|pensi[óo]n|RJP/i,
    required: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "IMSS-1A32-003-005", label: "Procedimiento 1A32-003-005 (RJP)" },
      { id: "LSS", label: "Ley del Seguro Social" },
    ],
  },
  {
    match: /equipo de protecci[óo]n|EPP|riesgo psicosocial|ergon|seguridad e higiene/i,
    required: [{ id: "NOM-017-STPS-2024", label: "NOM-017-STPS-2024 (equipo de protección personal)" }],
  },
  {
    match: /violencia|acoso|hostigamiento|denuncia|represalia/i,
    required: [{ id: "IMSS-SNTSS-PROTOCOLO-VIOLENCIA", label: "Protocolo IMSS-SNTSS violencia y acoso" }],
    optional: [
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
      { id: "LGAMVLV", label: "Ley General de Acceso de las Mujeres a una Vida Libre de Violencias" },
    ],
  },
  // ───────── Reglas ampliación 2026-08-25 ─────────
  {
    match: /vivienda|infonavit|cr[eé]dito.*vivienda/i,
    required: [
      { id: "LEY-INFONAVIT", label: "Ley del INFONAVIT" },
      { id: "IMSS-1A72-003-005", label: "Procedimiento 1A72-003-005 (préstamos habitación IMSS)" },
    ],
  },
  {
    match: /afore|sar|ahorro para el retiro|cuenta individual/i,
    required: [
      { id: "LSAR", label: "Ley de los Sistemas de Ahorro para el Retiro" },
      { id: "LSS", label: "Ley del Seguro Social" },
    ],
    optional: [{ id: "CCT::JUBILACIONES", label: "Régimen de Jubilaciones y Pensiones (CCT)" }],
  },
  {
    match: /fonacot|cr[eé]dito.*consumo/i,
    required: [
      { id: "LEY-FONACOT", label: "Ley del INFONACOT/FONACOT" },
      { id: "IMSS-1A14-003-011", label: "Procedimiento 1A14-003-011 (recuperación crédito FONACOT)" },
    ],
  },
  {
    match: /rayos? ?x|radiolog[ií]a|imagen diagn[óo]stica|seguridad radiol[óo]gica/i,
    required: [
      { id: "NOM-229-SSA1-2002", label: "NOM-229-SSA1-2002 (rayos X diagnóstico, VIGENTE)" },
      { id: "NOM-012-STPS-2012", label: "NOM-012-STPS-2012 (radiaciones ionizantes STPS)" },
      { id: "CCT::INFECTOCONTAGIOSIDAD", label: "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas (CCT)" },
    ],
  },
  {
    match: /rpbi|residuos.*(biol[óo]gico|peligroso)|punzocortante|bioseguridad/i,
    required: [{ id: "NOM-087-SEMARNAT-SSA1-2002", label: "NOM-087-SEMARNAT-SSA1-2002 (RPBI)" }],
    optional: [{ id: "NOM-017-STPS-2024", label: "NOM-017-STPS-2024 (EPP)" }],
  },
  {
    match: /bipedestaci[óo]n|ley silla|sentarme|estar de pie|silla|taburete|pausas/i,
    required: [
      { id: "DISPOSICIONES-BIPEDESTACION-2025", label: "Disposiciones de bipedestación STPS (DOF 17-07-2025)" },
      { id: "LFT", label: "Ley Federal del Trabajo" },
    ],
    optional: [
      { id: "NOM-036-1-STPS-2018", label: "NOM-036-1-STPS-2018 (ergonomía, manejo manual de cargas)" },
      { id: "NOM-019-STPS-2011", label: "NOM-019-STPS-2011 (comisiones de seguridad e higiene)" },
    ],
  },
  {
    match: /teletrabajo|trabajo en casa|casa.*remoto/i,
    required: [
      { id: "NOM-037-STPS-2023", label: "NOM-037-STPS-2023 (teletrabajo)" },
      { id: "LFT", label: "Ley Federal del Trabajo (capítulo XII-B)" },
    ],
  },
  {
    match: /discapacidad|inclusi[óo]n.*laboral/i,
    required: [
      { id: "NOM-034-STPS-2016", label: "NOM-034-STPS-2016 (personas con discapacidad en centros de trabajo)" },
    ],
    optional: [{ id: "LGIPD", label: "Ley General para la Inclusión de las Personas con Discapacidad" }],
  },
  {
    match: /expediente cl[ií]nico|nota m[eé]dica|historia cl[ií]nica/i,
    required: [{ id: "NOM-004-SSA3-2012", label: "NOM-004-SSA3-2012 (expediente clínico)" }],
  },
  {
    match: /enfermer[íi]a|pr[áa]ctica de enfermer/i,
    required: [
      { id: "NOM-019-SSA3-2013", label: "NOM-019-SSA3-2013 (práctica de enfermería)" },
      { id: "IMSS-2900-B03-002", label: "Procedimiento 2900-B03-002 (plantillas, indicadores enfermería)" },
    ],
  },
  {
    match: /urgencias|triage/i,
    required: [{ id: "NOM-027-SSA3-2013", label: "NOM-027-SSA3-2013 (servicios de urgencias)" }],
  },
  {
    match: /sangre|transfusi[óo]n|banco de sangre/i,
    required: [{ id: "NOM-253-SSA1-2012", label: "NOM-253-SSA1-2012 (disposición de sangre humana)" }],
  },
  {
    match: /infusi[óo]n|venoclisis/i,
    required: [{ id: "NOM-022-SSA3-2012", label: "NOM-022-SSA3-2012 (terapia de infusión)" }],
  },
  {
    match: /40 horas|jornada.*reducida|reforma.*jornada|reforma.*2026/i,
    required: [
      { id: "CPEUM", label: "CPEUM Artículo 123 (reforma 2026-06-02)" },
      { id: "LFT", label: "Ley Federal del Trabajo (texto reformado + transitorios)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    ],
  },
  {
    match: /discriminaci[óo]n|igualdad|no discrimin/i,
    required: [{ id: "LFPED", label: "Ley Federal para Prevenir y Eliminar la Discriminación" }],
  },
];

const DEFAULT_RULE: CoverageRule = {
  match: /./,
  required: [
    { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    { id: "LFT", label: "Ley Federal del Trabajo" },
  ],
};

export function buildCoverage(catalog: NormativeCatalog, topic: string): CoverageReport {
  const rule = RULES.find((r) => r.match.test(topic)) ?? DEFAULT_RULE;
  const items: CoverageItem[] = [];

  // Los subdocumentos virtuales (CCT::*) no tienen versión propia: heredan la del CCT padre.
  const isAvailable = (id: string): boolean => {
    const doc = catalog.getDocument(id);
    return !!doc && (!!doc.currentVersion || doc.validity === "CURRENT");
  };

  for (const req of rule.required) {
    if (isAvailable(req.id)) {
      items.push({ id: req.id, label: req.label, status: req.review ? "review" : "available", note: req.review ? "documento oficial — vigencia sujeta a verificación" : undefined });
    } else {
      items.push({ id: req.id, label: req.label, status: "unavailable", note: "no disponible en el corpus (pendiente de descarga o descubrimiento)" });
    }
  }
  for (const opt of rule.optional ?? []) {
    items.push({
      id: opt.id,
      label: opt.label,
      status: isAvailable(opt.id) ? "available" : "unavailable",
      note: isAvailable(opt.id) ? "fuente complementaria" : "fuente complementaria pendiente",
    });
  }

  const available = items.filter((i) => i.status !== "unavailable").length;
  const coverage = items.length > 0 ? Math.round((available / items.length) * 100) : 100;
  const critical = items.filter((i) => i.status === "unavailable");
  const warnings: string[] = [];
  if (critical.length > 0) {
    warnings.push(`Faltan ${critical.length} fuentes específicas. No recomendado para publicación hasta recuperarlas.`);
  }
  const reviewItems = items.filter((i) => i.status === "review");
  if (reviewItems.length > 0) {
    warnings.push("Revisión humana obligatoria: hay fuentes cuya vigencia actual no está confirmada.");
  }

  return {
    topic,
    items,
    available,
    total: items.length,
    coverage,
    critical,
    recommended: critical.length === 0 && coverage >= 60,
    warnings,
  };
}
