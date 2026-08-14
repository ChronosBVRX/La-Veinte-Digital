import type { LegalBasis } from "../lib/types"
import type { NormativaVigencia } from "./vigencias"
import { APENDICE_F_TABLA_07, APENDICE_H_TABLA_67 } from "./vigencias"

/**
 * Tablas institucionales de porcentajes por categoría.
 *
 * Regla para reglas de dinero: la resolución es ESTRICTA y en este orden:
 *
 *   1. `categoryId`   (código estable derivado del catálogo)
 *   2. `categoryCode` (código oficial de la categoría)
 *   3. nombre normalizado EXACTO (sin acentos, mayúsculas, sin dobles espacios)
 *   4. alias explícito documentado
 *
 * NO se usa coincidencia parcial / fuzzy: eso queda reservado únicamente para
 * SUGERIR categorías al usuario, nunca para calcular importes. Si no hay una
 * coincidencia exacta, `percentage` es `null` y el resultado pide confirmación
 * (`requires_conInfirmation`), en lugar de inventar un porcentaje por defecto.
 */

export type InstitutionalPercentageSource = "apendice_f_tabla_07" | "apendice_h_tabla_67"

export interface InstitutionalPercentageEntry {
  percentage: number
  /** Códigos estables (`stableCategoryId`) de categoría. */
  categoryIds?: string[]
  /** Códigos/códigos oficiales de la categoría en el catálogo. */
  categoryCodes?: string[]
  /** Nombres normalizados EXACTOS de la categoría. */
  categoryNames?: string[]
  /** Alias explícitos y documentados. */
  aliases?: string[]
  /** Descripción humana del rol cubierto. */
  role: string
}

export interface InstitutionalTable {
  id: InstitutionalPercentageSource
  title: string
  conceptCode: string
  conceptName: string
  entries: InstitutionalPercentageEntry[]
  vigencia: NormativaVigencia
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

export const APENDICE_F_072: InstitutionalTable = {
  id: "apendice_f_tabla_07",
  title: "Apéndice F - Tabla numérica 07 (Ayuda para Libros no Médicos, concepto 072)",
  conceptCode: "072",
  conceptName: "Ayuda para Libros no Médicos",
  vigencia: APENDICE_F_TABLA_07,
  entries: [
    {
      percentage: 0.05,
      role: "Técnico Radiólogo 60%",
      categoryNames: ["TECNICO RADIOLOGO 60"],
      categoryIds: ["TECNICO_RADIOLOGO_60"],
    },
    {
      percentage: 0.05,
      role: "Técnico Radiólogo 80%",
      categoryNames: ["TECNICO RADIOLOGO 80"],
      categoryIds: ["TECNICO_RADIOLOGO_80"],
    },
    {
      percentage: 0.05,
      role: "Trabajador/a Social",
      categoryNames: ["TRABAJADORA SOCIAL 65", "TRABAJADORA SOCIAL 80"],
      categoryIds: ["TRABAJADORA_SOCIAL_65", "TRABAJADORA_SOCIAL_80"],
      aliases: ["TRABAJADOR SOCIAL 65", "TRABAJADOR SOCIAL 80", "TRAB SOCIAL"],
    },
    {
      percentage: 0.05,
      role: "Especialista en Nutrición y Dietética",
      categoryNames: ["ESP NUTRIC DIETETICA 80"],
      categoryIds: ["ESP_NUTRIC_DIETETICA_80"],
    },
    {
      percentage: 0.05,
      role: "Nutriólogo Clínico Especializado",
      categoryNames: ["NUTRIOLOGO CLIN ESPEC"],
      categoryIds: ["NUTRIOLOGO_CLIN_ESPEC"],
    },
    {
      percentage: 0.15,
      role: "Psicólogo Clínico",
      categoryNames: ["PSICOLOGO CLINICO 60", "PSICOLOGO CLINICO 80"],
      categoryIds: ["PSICOLOGO_CLINICO_60", "PSICOLOGO_CLINICO_80"],
    },
    {
      percentage: 0.15,
      role: "Químico Clínico",
      categoryNames: ["QUIMICO CLINICO 80"],
      categoryIds: ["QUIMICO_CLINICO_80"],
    },
    {
      percentage: 0.15,
      role: "Biólogo",
      categoryNames: ["BIOLOGO"],
      aliases: ["BIOLOGO CLINICO", "BIOLOGO DE LABORATORIO"],
    },
  ],
}

export const APENDICE_H_083: InstitutionalTable = {
  id: "apendice_h_tabla_67",
  title: "Apéndice H - Tabla numérica 67 (Sobresueldo por Investigación y Docencia, concepto 083)",
  conceptCode: "083",
  conceptName: "Sobresueldo por Investigación y Docencia",
  vigencia: APENDICE_H_TABLA_67,
  entries: [
    {
      percentage: 0.03,
      role: "Psicólogo Clínico",
      categoryNames: ["PSICOLOGO CLINICO 60", "PSICOLOGO CLINICO 80"],
      categoryIds: ["PSICOLOGO_CLINICO_60", "PSICOLOGO_CLINICO_80"],
    },
    {
      percentage: 0.05,
      role: "Nutricionista Dietista",
      categoryNames: ["NUTRICIONISTA DIETISTA 80"],
      categoryIds: ["NUTRICIONISTA_DIETISTA_80"],
      aliases: ["NUTRICIONISTA DIETISTA 60"],
    },
    {
      percentage: 0.05,
      role: "Nutricionista Dietista (Horario de Referencia)",
      aliases: ["NUTRICIONISTA DIETISTA HR"],
    },
    {
      percentage: 0.05,
      role: "Especialista en Nutrición y Dietética",
      categoryNames: ["ESP NUTRIC DIETETICA 80"],
      categoryIds: ["ESP_NUTRIC_DIETETICA_80"],
    },
    {
      percentage: 0.05,
      role: "Nutriólogo Clínico Especializado",
      categoryNames: ["NUTRIOLOGO CLIN ESPEC"],
      categoryIds: ["NUTRIOLOGO_CLIN_ESPEC"],
    },
    {
      percentage: 0.05,
      role: "Trabajador/a Social",
      categoryNames: ["TRABAJADORA SOCIAL 65", "TRABAJADORA SOCIAL 80"],
      categoryIds: ["TRABAJADORA_SOCIAL_65", "TRABAJADORA_SOCIAL_80"],
      aliases: ["TRABAJADOR SOCIAL 65", "TRABAJADOR SOCIAL 80"],
    },
    {
      percentage: 0.05,
      role: "Trabajador Social Clínico",
      categoryNames: ["TRABAJADOR SOCIAL CLINICO"],
      categoryIds: ["TRABAJADOR_SOCIAL_CLINICO"],
      aliases: ["TRABAJADORA SOCIAL CLINICO"],
    },
    {
      percentage: 0.05,
      role: "Puericultura / Educadora",
      categoryNames: [
        "OFICIAL PUERICULTURA 65",
        "OFICIAL PUERICULTURA 80",
        "TECNICO PUERICULTURA 80",
        "EDUCADORA 40",
        "EDUCADORA 65",
        "EDUCADORA 80",
      ],
      categoryIds: [
        "OFICIAL_PUERICULTURA_65",
        "OFICIAL_PUERICULTURA_80",
        "TECNICO_PUERICULTURA_80",
        "EDUCADORA_40",
        "EDUCADORA_65",
        "EDUCADORA_80",
      ],
      aliases: ["PUERICULTURA"],
    },
  ],
}

export function getInstitutionalTable(id: InstitutionalPercentageSource): InstitutionalTable {
  return id === "apendice_f_tabla_07" ? APENDICE_F_072 : APENDICE_H_083
}

export type PercentageMatchMethod =
  | "categoryId"
  | "categoryCode"
  | "categoryName"
  | "alias"
  | "not_found"

export interface PercentageResolution {
  percentage: number | null
  method: PercentageMatchMethod
  /** Nombre/código que coincidió (para trazabilidad en UI). */
  matchedValue?: string
  /** Rol institucional de la categoría coincidente. */
  role?: string
  legalBasis: LegalBasis
  /** true cuando no se pudo determinar el porcentaje y se requiere confirmación humana. */
  requiresConfirmation: boolean
}

export interface CategoryIdentity {
  categoryId?: string
  categoryCode?: string
  categoryName?: string
}

function buildLegalBasis(table: InstitutionalTable, vigencia: NormativaVigencia): LegalBasis {
  return {
    source: "institutional_catalog",
    title: table.title,
    reference: `${vigencia.id} (Apéndice del CCT 2025-2027)`,
    version: vigencia.id,
    effectiveFrom: vigencia.desde,
    notes: "Porcentaje institucional; verificar contra la tabla oficial vigente del CCT.",
  }
}

export function resolvePercentageFromTable(
  table: InstitutionalTable,
  category: CategoryIdentity,
): PercentageResolution {
  const vigencia = table.vigencia
  const legalBasis = buildLegalBasis(table, vigencia)

  const categoryId = category.categoryId?.trim()
  const categoryCode = category.categoryCode ? normalizeName(category.categoryCode) : undefined
  const categoryName = category.categoryName ? normalizeName(category.categoryName) : undefined

  // 1) Código estable de categoría (resolución más confiable)
  if (categoryId) {
    for (const entry of table.entries) {
      if (entry.categoryIds?.includes(categoryId)) {
        return {
          percentage: entry.percentage,
          method: "categoryId",
          matchedValue: categoryId,
          role: entry.role,
          legalBasis,
          requiresConfirmation: false,
        }
      }
    }
  }

  // 2) Código oficial de la categoría
  if (categoryCode) {
    for (const entry of table.entries) {
      if (entry.categoryCodes?.some((c) => normalizeName(c) === categoryCode)) {
        return {
          percentage: entry.percentage,
          method: "categoryCode",
          matchedValue: categoryCode,
          role: entry.role,
          legalBasis,
          requiresConfirmation: false,
        }
      }
    }
  }

  // 3) Nombre normalizado EXACTO
  if (categoryName) {
    for (const entry of table.entries) {
      if (entry.categoryNames?.some((n) => normalizeName(n) === categoryName)) {
        return {
          percentage: entry.percentage,
          method: "categoryName",
          matchedValue: categoryName,
          role: entry.role,
          legalBasis,
          requiresConfirmation: false,
        }
      }
    }
  }

  // 4) Alias explícito documentado
  if (categoryName) {
    for (const entry of table.entries) {
      if (entry.aliases?.some((a) => normalizeName(a) === categoryName)) {
        return {
          percentage: entry.percentage,
          method: "alias",
          matchedValue: categoryName,
          role: entry.role,
          legalBasis,
          requiresConfirmation: false,
        }
      }
    }
  }

  // Sin coincidencia: NUNCA se inventa un porcentaje por defecto.
  return {
    percentage: null,
    method: "not_found",
    legalBasis,
    requiresConfirmation: true,
  }
}

export function getPercentageForConcept072(category: CategoryIdentity): PercentageResolution {
  return resolvePercentageFromTable(APENDICE_F_072, category)
}

export function getPercentageForConcept083(category: CategoryIdentity): PercentageResolution {
  return resolvePercentageFromTable(APENDICE_H_083, category)
}

export function getConceptTitles(): Record<string, string> {
  return {
    "072": APENDICE_F_072.title,
    "083": APENDICE_H_083.title,
  }
}
