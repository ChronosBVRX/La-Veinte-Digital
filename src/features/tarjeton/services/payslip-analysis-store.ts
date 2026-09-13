/**
 * Almacén persistente de análisis de Tarjetón IMSS.
 *
 * Cada análisis queda vinculado a la combinación inmutable:
 * documentHash + parserVersion
 *
 * Evita reprocesamientos repetidos del mismo archivo y sirve como
 * fuente de verdad única para la Guía del Tarjetón y el visor quincenal.
 *
 * La Veinte Digital.
 */

import { scopedStorageKey } from "@/shared/services/scoped-storage"

export const CURRENT_PARSER_VERSION = "2026.09.v1"
const STORAGE_KEY_PREFIX = "la_veinte_payslip_analyses"

/**
 * Multiusuario: cada análisis se guarda bajo el namespace del `user.id`
 * autenticado (`la_veinte_payslip_analyses:v2:<userId>`). La clave global
 * antigua queda en cuarentena lógica: no se lee ni se borra automáticamente.
 */

export type PayslipConceptKind = "perception" | "deduction"

export interface PayslipConcept {
  code: string | null
  description: string
  amount: number
  kind: PayslipConceptKind
}

export type PayslipAnalysisStatus = "pending" | "analyzing" | "ready" | "partial" | "error"

export interface PayslipAnalysis {
  documentId: string
  documentHash: string
  parserVersion: string
  period: string
  periodRank: number
  perceptionsTotal: number
  deductionsTotal: number
  netAmount: number
  concepts: PayslipConcept[]
  status: PayslipAnalysisStatus
  analyzedAt: string | null
  errorCode: string | null
  errorMessage?: string
}

function getStoreMap(userId: string): Record<string, PayslipAnalysis> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(scopedStorageKey(STORAGE_KEY_PREFIX, userId))
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, PayslipAnalysis>
  } catch {
    return {}
  }
}

function setStoreMap(userId: string, map: Record<string, PayslipAnalysis>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(scopedStorageKey(STORAGE_KEY_PREFIX, userId), JSON.stringify(map))
  } catch (err) {
    console.warn("[payslip-analysis-store] Error persistiendo análisis:", err)
  }
}

function makeCompositeKey(documentHash: string, parserVersion: string = CURRENT_PARSER_VERSION): string {
  return `${documentHash}_${parserVersion}`
}

/**
 * Guarda o actualiza un análisis de tarjetón en localStorage.
 */
export function savePayslipAnalysis(userId: string, analysis: PayslipAnalysis): void {
  const map = getStoreMap(userId)
  const key = makeCompositeKey(analysis.documentHash, analysis.parserVersion)
  map[key] = analysis
  // También guardar con alias de documentId si es distinto para búsqueda rápida
  if (analysis.documentId) {
    map[`id_${analysis.documentId}`] = analysis
  }
  setStoreMap(userId, map)

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("tarjeton_analysis_state_changed", {
        detail: analysis,
      })
    )
  }
}

/**
 * Recupera un análisis por hash del archivo y versión del parser.
 */
export function getPayslipAnalysisByHash(
  userId: string,
  documentHash: string,
  parserVersion: string = CURRENT_PARSER_VERSION
): PayslipAnalysis | null {
  if (!documentHash) return null
  const map = getStoreMap(userId)
  const key = makeCompositeKey(documentHash, parserVersion)
  return map[key] || null
}

/**
 * Recupera un análisis por documentId.
 */
export function getPayslipAnalysisById(userId: string, documentId: string): PayslipAnalysis | null {
  if (!documentId) return null
  const map = getStoreMap(userId)
  if (map[`id_${documentId}`]) return map[`id_${documentId}`]

  for (const item of Object.values(map)) {
    if (item.documentId === documentId) return item
  }
  return null
}

/**
 * Lista todos los análisis guardados en el dispositivo.
 */
export function getAllPayslipAnalyses(userId: string): PayslipAnalysis[] {
  const map = getStoreMap(userId)
  const list: PayslipAnalysis[] = []
  const seenHashes = new Set<string>()

  for (const [key, item] of Object.entries(map)) {
    if (key.startsWith("id_")) continue
    if (!seenHashes.has(item.documentHash)) {
      seenHashes.add(item.documentHash)
      list.push(item)
    }
  }

  // Ordenar por periodRank descendente y analyzedAt descendente
  list.sort((a, b) => {
    if (b.periodRank !== a.periodRank) {
      return b.periodRank - a.periodRank
    }
    const tA = a.analyzedAt ? new Date(a.analyzedAt).getTime() : 0
    const tB = b.analyzedAt ? new Date(b.analyzedAt).getTime() : 0
    return tB - tA
  })

  return list
}

/**
 * Obtiene el análisis más reciente con estado 'ready' (o el más reciente disponible).
 */
export function getLatestPayslipAnalysis(userId: string): PayslipAnalysis | null {
  const all = getAllPayslipAnalyses(userId)
  if (all.length === 0) return null

  // Priorizar el que esté 'ready' con el periodo más reciente
  const readyOnes = all.filter((a) => a.status === "ready" && a.concepts.length > 0)
  if (readyOnes.length > 0) {
    return readyOnes[0]
  }

  return all[0]
}
