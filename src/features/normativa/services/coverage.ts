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
    match: /n[óo]mina|alta|baja|pago/i,
    required: [
      { id: "IMSS-1A74-003-033", label: "Procedimiento 1A74-003-033 (altas, bajas y cambios en nómina)" },
      { id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" },
    ],
  },
  {
    match: /equipo de protecci[óo]n|EPP|riesgo psicosocial|ergon|seguridad e higiene/i,
    required: [{ id: "NOM-017-STPS-2024", label: "NOM-017-STPS-2024 (equipo de protección personal)" }],
  },
  {
    match: /violencia|acoso|hostigamiento|denuncia|represalia/i,
    required: [{ id: "IMSS-SNTSS-PROTOCOLO-VIOLENCIA", label: "Protocolo IMSS-SNTSS violencia y acoso" }],
    optional: [{ id: "CCT-IMSS-SNTSS-2025-2027", label: "CCT 2025-2027" }],
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

  for (const req of rule.required) {
    const doc = catalog.getDocument(req.id);
    if (doc?.currentVersion) {
      items.push({ id: req.id, label: req.label, status: req.review ? "review" : "available", note: req.review ? "documento oficial — vigencia sujeta a verificación" : undefined });
    } else {
      items.push({ id: req.id, label: req.label, status: "unavailable", note: "no disponible en el corpus (pendiente de descarga o descubrimiento)" });
    }
  }
  for (const opt of rule.optional ?? []) {
    const doc = catalog.getDocument(opt.id);
    items.push({
      id: opt.id,
      label: opt.label,
      status: doc?.currentVersion ? "available" : "unavailable",
      note: doc?.currentVersion ? "fuente complementaria" : "fuente complementaria pendiente",
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
