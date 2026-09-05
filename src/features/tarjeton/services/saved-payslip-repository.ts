/**
 * Repositorio canónico de documentos de Tarjetón guardados en la aplicación ("Mis documentos").
 *
 * Consulta las fuentes documentales reales:
 * 1. Documentos nativos en Android (Room DB) vía window.LaVeinteApp.listNativeDocuments()
 * 2. Documentos en IndexedDB (web / almacenamiento local) vía listAllTarjetonBlobs()
 *
 * Aplica ordenamiento estricto por periodo laboral: año -> mes -> 1A/2A
 * y desempate por fecha de descarga o modificación.
 *
 * La Veinte Digital.
 */
import { readNativeDocumentAsFile } from "@/features/transferir/services/transfer"
import { listAllTarjetonBlobs, getTarjetonPdfBlob } from "@/shared/services/tarjeton-blob-storage"

export interface SavedPayslipDocument {
  id: string
  name: string
  source: "native" | "indexeddb"
  localPath?: string
  key?: string
  periodKey?: string
  year?: number
  month?: number
  half?: 1 | 2
  periodRank: number
  fileSize: number
  timestamp: number
  mimeType?: string
  getBytes: () => Promise<Uint8Array | null>
}

const MONTH_MAP: Record<string, number> = {
  ENE: 1, ENERO: 1,
  FEB: 2, FEBRERO: 2,
  MAR: 3, MARZO: 3,
  ABR: 4, ABRIL: 4,
  MAY: 5, MAYO: 5,
  JUN: 6, JUNIO: 6,
  JUL: 7, JULIO: 7,
  AGO: 8, AGOSTO: 8,
  SEP: 9, SEPTIEMBRE: 9, SETIEMBRE: 9,
  OCT: 10, OCTUBRE: 10,
  NOV: 11, NOVIEMBRE: 11,
  DIC: 12, DICIEMBRE: 12,
}

/**
 * Calcula el rango ordinal absoluto para un periodo quincenal.
 * Permite comparaciones directas:
 * 2A-AGO-2026 (48640) < 1A-SEP-2026 (48641) < 2A-SEP-2026 (48642)
 */
export function calculatePeriodRank(year: number, month: number, half: 1 | 2): number {
  if (!year || year < 1970) return 0
  const m = Math.max(1, Math.min(12, month || 1))
  const h = half === 2 ? 2 : 1
  return year * 24 + (m - 1) * 2 + h
}

/**
 * Extrae año, mes y quincena a partir del nombre de archivo, clave o texto de periodo.
 */
export function parsePeriodFromText(raw: string): {
  year: number
  month: number
  half: 1 | 2
  periodKey: string
  periodRank: number
} | null {
  if (!raw || typeof raw !== "string") return null
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "_")

  // Patrón 1: 1A_SEP_2026 o 2A_AGO_2026 o 1_SEP_2026
  const p1 = /(?:^|_)(1A|2A|1Q|2Q|1|2)_([A-Z]{3,10})_(\d{4})(?:_|$)/.exec(clean)
  if (p1) {
    const halfStr = p1[1]
    const monthStr = p1[2]
    const yearStr = p1[3]
    const half: 1 | 2 = halfStr.startsWith("2") ? 2 : 1
    const month = MONTH_MAP[monthStr] || 0
    const year = parseInt(yearStr, 10)
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2099) {
      const rank = calculatePeriodRank(year, month, half)
      const periodKey = `${half}A_${monthStr.slice(0, 3)}_${year}`
      return { year, month, half, periodKey, periodRank: rank }
    }
  }

  // Patrón 2: 2026_09_1A o 2026_08_2 o 2026-09-01
  const p2 = /(?:^|_)(\d{4})_(0?[1-9]|1[0-2])_(1A|2A|1Q|2Q|1|2)(?:_|$)/.exec(clean)
  if (p2) {
    const year = parseInt(p2[1], 10)
    const month = parseInt(p2[2], 10)
    const half: 1 | 2 = p2[3].startsWith("2") ? 2 : 1
    const monthName = Object.keys(MONTH_MAP).find((k) => MONTH_MAP[k] === month && k.length === 3) || "MES"
    const rank = calculatePeriodRank(year, month, half)
    const periodKey = `${half}A_${monthName}_${year}`
    return { year, month, half, periodKey, periodRank: rank }
  }

  // Patrón 3: 2026_SEP_1A o 2026_AGO_2
  const p3 = /(?:^|_)(\d{4})_([A-Z]{3,10})_(1A|2A|1Q|2Q|1|2)(?:_|$)/.exec(clean)
  if (p3) {
    const year = parseInt(p3[1], 10)
    const month = MONTH_MAP[p3[2]] || 0
    const half: 1 | 2 = p3[3].startsWith("2") ? 2 : 1
    if (month >= 1 && month <= 12) {
      const rank = calculatePeriodRank(year, month, half)
      const periodKey = `${half}A_${p3[2].slice(0, 3)}_${year}`
      return { year, month, half, periodKey, periodRank: rank }
    }
  }

  // Patrón 4: Contiene mes y año aunque quincena esté en otra posición
  const yearMatch = /(\d{4})/.exec(clean)
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10)
    for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
      if (clean.includes(mName)) {
        const half: 1 | 2 = clean.includes("2A") || clean.includes("2Q") || clean.includes("_2_") || clean.endsWith("_2") ? 2 : 1
        const rank = calculatePeriodRank(year, mNum, half)
        const periodKey = `${half}A_${mName.slice(0, 3)}_${year}`
        return { year, month: mNum, half, periodKey, periodRank: rank }
      }
    }
  }

  return null
}

/**
 * Consulta y lista todos los tarjetones guardados en el dispositivo (Android Room e IndexedDB),
 * ordenados principalmente por periodo quincenal (más reciente primero) y desempate por fecha.
 */
export async function listSavedPayslipDocuments(): Promise<SavedPayslipDocument[]> {
  const docs: SavedPayslipDocument[] = []

  // 1. Android Nativo (Room Database)
  if (typeof window !== "undefined" && window.LaVeinteApp?.listNativeDocuments) {
    try {
      const nativeList = await window.LaVeinteApp.listNativeDocuments()
      for (const item of nativeList ?? []) {
        const source = (item.source || "").toUpperCase()
        const name = item.name || ""
        const isTarjeton =
          source === "TARJETON_DIGITAL" ||
          source === "TU_PERFIL" ||
          name.toLowerCase().includes("tarjeton") ||
          (source.includes("TARJETON") && !source.includes("BIOMETRIC"))

        if (!isTarjeton) continue

        const parsedPeriod = parsePeriodFromText(name) || parsePeriodFromText(source)
        const periodRank = parsedPeriod?.periodRank ?? 0
        const timestamp = item.downloadedAt || Date.now()

        docs.push({
          id: `native_${item.id}`,
          name,
          source: "native",
          localPath: item.localPath,
          periodKey: parsedPeriod?.periodKey,
          year: parsedPeriod?.year,
          month: parsedPeriod?.month,
          half: parsedPeriod?.half,
          periodRank,
          fileSize: item.fileSize || 0,
          timestamp,
          mimeType: item.mimeType || "application/pdf",
          getBytes: async () => {
            if (!item.localPath) return null
            const file = await readNativeDocumentAsFile({
              name: item.name,
              mimeType: item.mimeType || "application/pdf",
              localPath: item.localPath,
            })
            if (!file) return null
            return new Uint8Array(await file.arrayBuffer())
          },
        })
      }
    } catch (nativeErr) {
      console.warn("[saved-payslip-repository] Error listando documentos nativos:", nativeErr)
    }
  }

  // 2. Almacenamiento Web / IndexedDB
  try {
    const blobRecords = await listAllTarjetonBlobs()
    for (const record of blobRecords) {
      const name = record.fileName || record.key || "tarjeton.pdf"
      const parsedPeriod = parsePeriodFromText(name) || parsePeriodFromText(record.key)
      const periodRank = parsedPeriod?.periodRank ?? 0
      const timestamp = record.updatedAt ? new Date(record.updatedAt).getTime() : Date.now()

      docs.push({
        id: `idb_${record.key}`,
        name,
        source: "indexeddb",
        key: record.key,
        periodKey: parsedPeriod?.periodKey,
        year: parsedPeriod?.year,
        month: parsedPeriod?.month,
        half: parsedPeriod?.half,
        periodRank,
        fileSize: record.fileSize || 0,
        timestamp,
        mimeType: record.mimeType || "application/pdf",
        getBytes: async () => {
          if (record.blob) {
            return new Uint8Array(await record.blob.arrayBuffer())
          }
          const file = await getTarjetonPdfBlob(record.key)
          if (!file) return null
          return new Uint8Array(await file.arrayBuffer())
        },
      })
    }
  } catch (idbErr) {
    console.warn("[saved-payslip-repository] Error listando IndexedDB tarjetones:", idbErr)
  }

  // 3. Ordenamiento estricto:
  // - Principal: periodRank descendente (2A-SEP-2026 > 1A-SEP-2026 > 2A-AGO-2026)
  // - Secundario: timestamp descendente (descarga más reciente primero)
  docs.sort((a, b) => {
    if (b.periodRank !== a.periodRank) {
      return b.periodRank - a.periodRank
    }
    return b.timestamp - a.timestamp
  })

  // 4. Deduplicación por periodKey o ID cuando haya copias redundantes
  const uniqueDocs: SavedPayslipDocument[] = []
  const seenKeys = new Set<string>()

  for (const doc of docs) {
    const dedupKey = doc.periodKey ? `period_${doc.periodKey}` : doc.id
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey)
      uniqueDocs.push(doc)
    }
  }

  return uniqueDocs
}

/**
 * Localiza el tarjetón guardado más reciente en "Mis documentos".
 */
export async function getLatestSavedPayslipDocument(): Promise<SavedPayslipDocument | null> {
  const list = await listSavedPayslipDocuments()
  return list.length > 0 ? list[0] : null
}
