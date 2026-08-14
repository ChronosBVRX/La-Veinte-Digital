/**
 * Vigencias normativas del motor de nómina.
 *
 * Cada entrada identifica un documento institucional con su vigencia exacta.
 * Se usan para documentar la base legal de reglas, tablas y relaciones de
 * repercusión, y para EVITAR asumir "2025-01-01" como fecha de inicio de un
 * dato sin evidencia.
 *
 * Regla de uso: si no existe evidencia de la vigencia concreta de un dato,
 * NO se inventa una fecha; se deja el dato sin `effectiveFrom` y se marca
 * como `pending_validation`.
 */
export interface NormativaVigencia {
  /** Identificador estable del documento. */
  id: string
  /** Título del documento institucional. */
  title: string
  /** Vigencia de inicio del documento (fecha conocida). */
  desde: string
  /** Vigencia de fin del documento (opcional). */
  hasta?: string
  /** Fuente de la vigencia (normalmente el propio documento o sello). */
  source: string
  /** URL o referencia oficial cuando se conoce. */
  officialUrl?: string
  /** Fecha en que se verificó la vigencia en el repo. */
  verifiedAt: string
}

export const CCT_2025_2027: NormativaVigencia = {
  id: "cct-2025-2027",
  title: "Contrato Colectivo de Trabajo 2025-2027",
  desde: "2025-10-16",
  hasta: "2027-10-15",
  source: "Sello de vigencia del CCT (fuente oficial)",
  officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
  verifiedAt: "2026-08-13",
}

export const NORMA_1000_001_020: NormativaVigencia = {
  id: "norma-1000-001-020",
  title:
    "Norma para la aplicación de los conceptos asociados a la categoría, puesto y/o servicio, Primas, Sobresueldos y Percepciones de los Trabajadores de Base",
  desde: "2025-10-16",
  source: "Catálogo de normas institucionales (fuente oficial)",
  verifiedAt: "2026-08-13",
}

export const PROC_1A74_003_031: NormativaVigencia = {
  id: "proc-1a74-003-031",
  title: "Procedimiento: cálculo y pago de tiempo extraordinario",
  desde: "2025-10-16",
  source: "Catálogo de procedimientos (fuente oficial)",
  verifiedAt: "2026-08-13",
}

export const PROC_1A74_003_024: NormativaVigencia = {
  id: "proc-1a74-003-024",
  title: "Procedimiento: cálculo de la cláusula 144 (base del Fondo de Ahorro en régimen ordinario)",
  desde: "2025-10-16",
  source: "Catálogo de procedimientos (fuente oficial)",
  verifiedAt: "2026-08-13",
}

export const APENDICE_F_TABLA_07: NormativaVigencia = {
  id: "apendice-f-tabla-07",
  title: "Apéndice F - Tabla numérica 07: porcentajes de la Ayuda para Libros no Médicos (concepto 072)",
  desde: "2025-10-16",
  source: "Apéndice F del CCT 2025-2027",
  verifiedAt: "2026-08-13",
}

export const APENDICE_H_TABLA_67: NormativaVigencia = {
  id: "apendice-h-tabla-67",
  title: "Apéndice H - Tabla numérica 67: porcentajes del Sobresueldo por Investigación y Docencia (concepto 083)",
  desde: "2025-10-16",
  source: "Apéndice H del CCT 2025-2027",
  verifiedAt: "2026-08-13",
}

export const NORMATIVA_VIGENCIAS: NormativaVigencia[] = [
  CCT_2025_2027,
  NORMA_1000_001_020,
  PROC_1A74_003_031,
  PROC_1A74_003_024,
  APENDICE_F_TABLA_07,
  APENDICE_H_TABLA_67,
]

const BY_ID = new Map(NORMATIVA_VIGENCIAS.map((v) => [v.id, v]))

export function getNormativaVigencia(id: string): NormativaVigencia | undefined {
  return BY_ID.get(id)
}
