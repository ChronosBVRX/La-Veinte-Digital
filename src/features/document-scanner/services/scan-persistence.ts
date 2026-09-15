/**
 * Persistencia de documentos escaneados: elige el almacenamiento existente.
 *
 * - Android con bridge del escáner: `savePdfToNativeDocs` (Room + filesDir, source explícito).
 * - Web (o bridge no disponible): IndexedDB aislada por usuario.
 *
 * Nunca se sube el PDF a servidores ni se generan URLs públicas.
 *
 * La Veinte Digital
 */

import {
  scanSourceForKind,
  type ScanDocumentKind,
} from "@/shared/contracts/document-scan"
import { isNativePdfShareSupported, savePdfToNativeDocs } from "@/shared/services/pdfShareBridge"
import {
  deleteScanDocument,
  getScanDocumentFile,
  listScanDocuments,
  newScanDocumentId,
  saveScanDocument,
  type ScanDocumentSummary,
} from "@/shared/services/scan-document-storage"

export type ScanStorageKind = "native" | "indexeddb"

export interface SaveScannedDocumentResult {
  ok: boolean
  storage: ScanStorageKind
  id: string
  docId?: number
  reason?: string
}

export interface PersistScannedDocumentParams {
  userId: string
  kind: ScanDocumentKind
  name: string
  pdfFile: File
  pageCount: number
  /** Permite forzar solo IndexedDB (pruebas o escenarios explícitos). */
  allowNative?: boolean
}

/**
 * El guardado nativo con fuente explícita solo es seguro si la MISMA APK expone
 * el escáner (APKs antiguas ignorarían `source` y guardarían como ESCRITO).
 */
export function isNativeScanPersistenceAvailable(): boolean {
  if (typeof window === "undefined") return false
  if (typeof window.LaVeinteApp?.scanDocument !== "function") return false
  return isNativePdfShareSupported()
}

export async function persistScannedDocument(
  params: PersistScannedDocumentParams
): Promise<SaveScannedDocumentResult> {
  const fallbackId = newScanDocumentId(params.kind)

  if (params.allowNative !== false && isNativeScanPersistenceAvailable()) {
    const result = await savePdfToNativeDocs(
      params.pdfFile,
      {
        escritoId: fallbackId,
        title: params.name,
        ownerId: params.userId,
        source: scanSourceForKind(params.kind),
      },
      params.pdfFile.name
    )
    if (result.ok) {
      return { ok: true, storage: "native", id: fallbackId, docId: result.docId }
    }
    // No se pierde el escaneo: se conserva localmente en IndexedDB.
    try {
      await saveScanDocument(params.userId, {
        id: fallbackId,
        kind: params.kind,
        name: params.name,
        pageCount: params.pageCount,
        blob: params.pdfFile,
      })
      return { ok: true, storage: "indexeddb", id: fallbackId, reason: result.code }
    } catch (error) {
      return {
        ok: false,
        storage: "indexeddb",
        id: fallbackId,
        reason: error instanceof Error ? error.message : "save_failed",
      }
    }
  }

  try {
    await saveScanDocument(params.userId, {
      id: fallbackId,
      kind: params.kind,
      name: params.name,
      pageCount: params.pageCount,
      blob: params.pdfFile,
    })
    return { ok: true, storage: "indexeddb", id: fallbackId }
  } catch (error) {
    return {
      ok: false,
      storage: "indexeddb",
      id: fallbackId,
      reason: error instanceof Error ? error.message : "save_failed",
    }
  }
}

export async function listWebScannedDocuments(userId: string): Promise<ScanDocumentSummary[]> {
  return listScanDocuments(userId)
}

export async function getWebScannedDocumentFile(userId: string, id: string): Promise<File | null> {
  return getScanDocumentFile(userId, id)
}

export async function deleteWebScannedDocument(userId: string, id: string): Promise<boolean> {
  return deleteScanDocument(userId, id)
}
