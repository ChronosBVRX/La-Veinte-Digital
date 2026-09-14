// Motor normativo — Representación Sindical Delegación XXI.
// Fuente de verdad documental; la UI nunca hardcodea reglas laborales.
// Cada regla cita su fundamento para permitir actualización sin reescribir UI.

export interface NormativeSource {
  sourceCode: string;
  sourceName: string;
  articleOrClause: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  description: string;
  consultedAt: string;
  status: "vigente" | "requiere_revision";
}

export const UNION_NORMATIVE_SOURCES: NormativeSource[] = [
  {
    sourceCode: "CCT-IMSS-SNTSS",
    sourceName: "Contrato Colectivo de Trabajo IMSS-SNTSS",
    articleOrClause: "Cláusula 77 — Maternidad y lactancia",
    version: "2025-2027",
    effectiveFrom: "2025-10-16",
    effectiveTo: "2027-10-15",
    description:
      "90 días naturales de descanso con salario íntegro desde la expedición de la incapacidad por maternidad; periodo de lactancia de 365 días desde la reanudación de labores con modalidades por jornada (8h / ≤6.5h / acumulada, estas últimas sujetas a acuerdo con el Instituto).",
    consultedAt: "2026-09-14",
    status: "vigente",
  },
  {
    sourceCode: "CCT-IMSS-SNTSS",
    sourceName: "Contrato Colectivo de Trabajo IMSS-SNTSS",
    articleOrClause: "Cláusula 103 — Medios de transporte y compensación por pasajes",
    version: "2025-2027",
    effectiveFrom: "2025-10-16",
    effectiveTo: "2027-10-15",
    description:
      "Base para conceptos 026 (compensación fija para personal con funciones extramuros) y 027 (compensación por pasajes conforme al Reglamento). El sistema prepara el trámite; no autoriza ni dictamina.",
    consultedAt: "2026-09-14",
    status: "vigente",
  },
  {
    sourceCode: "IMSS-1A32-A03-008",
    sourceName: "Procedimiento para el pago de pasajes y su inclusión en nómina",
    articleOrClause: "Clave 1A32-A03-008 (formatos 1A32-009-026 y 1A32-009-010)",
    version: "2021-04-19",
    effectiveFrom: "2021-04-19",
    description:
      "Define solicitante, dictamen de la Subcomisión Mixta de Pasajes, número de control SIAP y reportes de inclusión/retroactivo. El número de control queda 'pendiente' hasta asignación oficial.",
    consultedAt: "2026-09-14",
    status: "vigente",
  },
  {
    sourceCode: "IMSS-1A74-003-034",
    sourceName: "Procedimiento para el control de asistencia, puntualidad y sustituciones",
    articleOrClause: "Clave 1A74-003-034 (formato 1A74-009-036 Solicitud de Licencia)",
    version: "vigente",
    effectiveFrom: "2024-01-01",
    description:
      "Formato institucional con rangos sin goce 1-3, 4-60 y 61-365 días, prórroga, licencias anteriores, motivo, comprobantes y control de adeudos. El software genera y controla la solicitud; no la concede.",
    consultedAt: "2026-09-14",
    status: "requiere_revision",
  },
  {
    sourceCode: "CCT-IMSS-SNTSS",
    sourceName: "Contrato Colectivo de Trabajo IMSS-SNTSS",
    articleOrClause: "Cláusulas 67 y 68 — Vestidores y guarda de útiles y ropa",
    version: "2025-2027",
    effectiveFrom: "2025-10-16",
    effectiveTo: "2027-10-15",
    description:
      "Fundamento general de mobiliario adecuado y seguro. NO establece criterio de prioridad para repartir lockers; el orden operativo por defecto es fecha de solicitud, con priority_override administrativo auditado.",
    consultedAt: "2026-09-14",
    status: "vigente",
  },
];

export function getNormativeSource(sourceCode: string, clause: string): NormativeSource | undefined {
  return UNION_NORMATIVE_SOURCES.find((s) => s.sourceCode === sourceCode && s.articleOrClause.includes(clause));
}

export const MATERNITY_RULE_VERSION = "CCT-2025-2027-Cl77";
export const LACTATION_RULE_VERSION = "CCT-2025-2027-Cl77";
