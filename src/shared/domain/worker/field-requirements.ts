/**
 * Matriz dato → herramienta.
 *
 * Fuente única de la información "¿por qué necesito este dato?" y de los
 * requisitos de cada herramienta. NO debe dispersarse en componentes.
 */
import type { FieldRequirement, ToolId } from "./types"

/**
 * Herramientas reconocidas del dominio. Al añadir una nueva herramienta,
 * debe registrarse aquí y en sus FieldRequirement.
 */
export const TOOL_IDS: readonly ToolId[] = [
  "aguinaldo",
  "prima_vacacional",
  "vacaciones",
  "nomina",
  "simulador",
  "tiempo_extra",
  "escritos",
  "comparador",
  "prestaciones",
  "timeline",
  "tarjeton",
]

/**
 * Matriz completa de requisitos por campo.
 *
 * `required: true` significa que la herramienta necesita el campo para
 * funcionar correctamente; si falta, la herramienta no puede completarse
 * automáticamente.
 */
export const FIELD_REQUIREMENTS: readonly FieldRequirement[] = [
  {
    field: "categoria",
    purpose: "Define tu nivel salarial para cálculos IMSS.",
    tools: [
      { tool: "aguinaldo", required: true },
      { tool: "prima_vacacional", required: true },
      { tool: "nomina", required: true },
      { tool: "simulador", required: true },
      { tool: "comparador", required: true },
    ],
    preferredSource: "payslip_confirmed",
    whyMessage:
      "Se utiliza para: Aguinaldo · Prima vacacional · Vacaciones · Nómina · Simulador · Comparador.",
    impactIfMissing: "Las calculadoras piden capturar la categoría manualmente.",
  },
  {
    field: "effectiveSeniorityDate",
    purpose: "Tu antigüedad efectiva como fecha de ingreso al IMSS.",
    tools: [
      { tool: "vacaciones", required: true },
      { tool: "prima_vacacional", required: true },
      { tool: "nomina", required: true },
      { tool: "timeline", required: true },
      { tool: "prestaciones", required: true },
    ],
    preferredSource: "payslip_confirmed",
    whyMessage:
      "Se utiliza para: Vacaciones · Prima vacacional · Nómina · Timeline · Predicción de prestaciones.",
    impactIfMissing: "Los cálculos de antigüedad se capturan manualmente en cada herramienta.",
  },
  {
    field: "workdayHours",
    purpose: "Las horas de tu jornada laboral.",
    tools: [
      { tool: "tiempo_extra", required: true },
      { tool: "nomina", required: true },
      { tool: "simulador", required: true },
    ],
    preferredSource: "calculated",
    whyMessage: "Se utiliza para: Tiempo extra · Nómina · Simulador.",
    impactIfMissing: "Se asume una jornada estándar o se pide capturarla.",
  },
  {
    field: "shift",
    purpose: "Tu turno laboral (matutino, vespertino, etc.).",
    tools: [
      { tool: "nomina", required: false },
      { tool: "escritos", required: false },
    ],
    preferredSource: "manual",
    whyMessage: "Se utiliza para: Nómina · Escritos.",
    impactIfMissing: "No impide cálculos; enriquece el contexto.",
  },
  {
    field: "employmentType",
    purpose: "Tu tipo de contratación.",
    tools: [
      { tool: "nomina", required: true },
      { tool: "vacaciones", required: false },
    ],
    preferredSource: "manual",
    whyMessage: "Se utiliza para: Nómina · Vacaciones.",
    impactIfMissing: "Se asume contratación base en los cálculos.",
  },
  {
    field: "matricula",
    purpose: "Tu número de matrícula ante el IMSS.",
    tools: [
      { tool: "escritos", required: true },
      { tool: "tarjeton", required: false },
    ],
    preferredSource: "payslip_confirmed",
    whyMessage: "Se utiliza para: Escritos · Verificación de tarjetón.",
    impactIfMissing: "Los escritos requieren matrícula para generarse.",
  },
  {
    field: "adscripcion",
    purpose: "Tu unidad o área de adscripción.",
    tools: [{ tool: "escritos", required: false }],
    preferredSource: "manual",
    whyMessage: "Se utiliza para: Escritos.",
    impactIfMissing: "No impide cálculos; aparece vacía en los escritos.",
  },
]

/** Versión actual del aviso de privacidad laboral. No duplicar en otros archivos. */
export const WORKER_PRIVACY_NOTICE_VERSION = "2026-08-v1"
