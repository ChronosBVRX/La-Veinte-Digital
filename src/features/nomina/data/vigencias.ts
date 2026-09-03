/**
 * Vigencias normativas del motor de nómina y calculadoras.
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
  desde?: string
  /** Vigencia de fin del documento (opcional). */
  hasta?: string
  /** Versión del documento. */
  version?: string
  /** SHA-256 o identificador de integridad del documento cuando está disponible. */
  sha256?: string
  /** Fuente de la vigencia (normalmente el propio documento o sello). */
  source: string
  /** URL o referencia oficial cuando se conoce. */
  officialUrl?: string
  /** Página o referencia interna del documento. */
  reference?: string
  /** Estado de verificación del documento. */
  status: "verified" | "empirical" | "pending_validation" | "expired"
  /** Fecha en que se verificó la vigencia en el repo. */
  verifiedAt: string
}

export const CCT_2025_2027: NormativaVigencia = {
  id: "cct-2025-2027",
  title: "Contrato Colectivo de Trabajo 2025-2027",
  desde: "2025-10-16",
  hasta: "2027-10-15",
  version: "2025-2027",
  source: "Sello de vigencia del CCT (fuente oficial)",
  officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const TABULADOR_2024_2025_VIGENCIA: NormativaVigencia = {
  id: "tabulador-2024-2025",
  title: "Tabulador de Sueldos para Personal de Base 2024-2025",
  desde: "2024-10-16",
  hasta: "2025-10-15",
  version: "2024-2025",
  source: "Convenio de Revisión Salarial 2024 IMSS-SNTSS",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const TABULADOR_2025_2026_VIGENCIA: NormativaVigencia = {
  id: "tabulador-2025-2026",
  title: "Tabulador de Sueldos para Personal de Base 2025-2026",
  desde: "2025-10-16",
  hasta: "2026-10-15",
  version: "2025-2026",
  source: "Convenio de Revisión Salarial 2025 IMSS-SNTSS (aumento 3.10% a 002 y 011 al 82.15%)",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const NORMA_1000_001_020: NormativaVigencia = {
  id: "norma-1000-001-020",
  title:
    "Norma para la aplicación de los conceptos asociados a la categoría, puesto y/o servicio, Primas, Sobresueldos y Percepciones de los Trabajadores de Base",
  desde: "2025-10-16",
  version: "1000-001-020",
  source: "Catálogo de normas institucionales (fuente oficial)",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const PROC_1A74_003_031: NormativaVigencia = {
  id: "proc-1a74-003-031",
  title: "Procedimiento: cálculo y pago de tiempo extraordinario",
  desde: "2025-10-16",
  version: "1A74-003-031",
  source: "Catálogo de procedimientos (fuente oficial)",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const PROC_1A74_003_024: NormativaVigencia = {
  id: "proc-1a74-003-024",
  title: "Procedimiento: cálculo de la cláusula 144 (base del Fondo de Ahorro en régimen ordinario)",
  desde: "2025-10-16",
  version: "1A74-003-024",
  source: "Catálogo de procedimientos (fuente oficial)",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const PROC_1A74_003_025: NormativaVigencia = {
  id: "proc-1a74-003-025",
  title: "Procedimiento para la programación y disfrute de periodos vacacionales del personal de base",
  desde: "2025-10-16",
  version: "1A74-003-025",
  source: "Catálogo de procedimientos institucionales (fuente oficial)",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const APENDICE_F_TABLA_07: NormativaVigencia = {
  id: "apendice-f-tabla-07",
  title: "Apéndice F - Tabla numérica 07: porcentajes de la Ayuda para Libros no Médicos (concepto 072)",
  desde: "2025-10-16",
  version: "CCT-2025-2027",
  source: "Apéndice F del CCT 2025-2027",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const APENDICE_H_TABLA_67: NormativaVigencia = {
  id: "apendice-h-tabla-67",
  title: "Apéndice H - Tabla numérica 67: porcentajes del Sobresueldo por Investigación y Docencia (concepto 083)",
  desde: "2025-10-16",
  version: "CCT-2025-2027",
  source: "Apéndice H del CCT 2025-2027",
  status: "verified",
  verifiedAt: "2026-08-13",
}

export const CONCEPTO_050_VIGENCIA: NormativaVigencia = {
  id: "concepto-050-despensa",
  title: "Ayuda para Despensa (Concepto 050)",
  source: "Tarjetón real anonimizado 2A-AGO-2026 ($200 quincenales empíricos)",
  status: "pending_validation",
  verifiedAt: "2026-08-13",
}

export const NORMATIVA_VIGENCIAS: NormativaVigencia[] = [
  CCT_2025_2027,
  TABULADOR_2024_2025_VIGENCIA,
  TABULADOR_2025_2026_VIGENCIA,
  NORMA_1000_001_020,
  PROC_1A74_003_031,
  PROC_1A74_003_024,
  PROC_1A74_003_025,
  APENDICE_F_TABLA_07,
  APENDICE_H_TABLA_67,
  CONCEPTO_050_VIGENCIA,
]

const BY_ID = new Map(NORMATIVA_VIGENCIAS.map((v) => [v.id, v]))

export function getNormativaVigencia(id: string): NormativaVigencia | undefined {
  return BY_ID.get(id)
}
