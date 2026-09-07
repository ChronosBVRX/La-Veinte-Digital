/**
 * Sincronización best-effort de escritos con el almacenamiento nativo de Android
 * (Room + filesDir) para consulta sin conexión.
 *
 * Regla de producto: todo documento que aparezca como guardado en "Mis documentos"
 * dentro de la app Android debe poder abrirse sin Internet. Estas funciones son
 * fire-and-forget y nunca alteran el flujo web: fuera de la app nativa no hacen nada
 * y ante cualquier fallo solo registran un warning en consola.
 */

import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import {
  savePdfToNativeDocs,
  setNativeDocsOwner,
} from "@/shared/services/pdfShareBridge"
import { deleteNativeDocumentById } from "@/features/transferir/services/transfer"
import { escritoToPdfFile } from "../lib/escrito-pdf"

export { setNativeDocsOwner }

function pdfFileNameFor(draft: EscritoDraftV2): string {
  const raw = (draft.titulo || "").trim() || "Escrito Formal"
  return raw.toLowerCase().endsWith(".pdf") ? raw : `${raw}.pdf`
}

/**
 * Envía un Blob PDF ya generado a la app nativa. No hace nada fuera de Android.
 */
export function syncEscritoBlobToNative(
  blob: Blob,
  opts: { escritoId: string; title: string; ownerId: string; fecha?: string }
): void {
  try {
    if (typeof window === "undefined") return
    if (!window.LaVeinteApp?.isNativeApp?.()) return
    const file = new File([blob], pdfFileNameFor({ titulo: opts.title } as EscritoDraftV2), {
      type: "application/pdf",
    })
    void savePdfToNativeDocs(
      file,
      { escritoId: opts.escritoId, title: opts.title, ownerId: opts.ownerId, fecha: opts.fecha },
      file.name
    ).catch((err) => {
      console.warn("[escrito-native-sync] No se pudo respaldar el escrito en la app:", err)
    })
  } catch (err) {
    console.warn("[escrito-native-sync] Respaldo nativo omitido:", err)
  }
}

export interface EscritoProfileHint {
  nombre?: string
  matricula?: string | null
  categoria?: string | null
}

/**
 * Genera el PDF del escrito y lo respalda en la app nativa (fire-and-forget).
 * Llamar tras guardar/generar un escrito para que quede disponible sin conexión.
 */
export function syncEscritoPdfToNative(
  draft: EscritoDraftV2,
  userId: string,
  profile?: EscritoProfileHint | null
): void {
  try {
    if (typeof window === "undefined") return
    if (!window.LaVeinteApp?.isNativeApp?.()) return
    if (!draft || !draft.id) return
    const owner = (userId && userId.trim()) || draft.ownerId || "anonymous"
    void (async () => {
      try {
        const file = await escritoToPdfFile(draft, owner, {
          nombre: profile?.nombre ?? undefined,
          matricula: profile?.matricula ?? undefined,
          categoria: profile?.categoria ?? undefined,
        })
        if (!file || file.size === 0) return
        await savePdfToNativeDocs(
          file,
          { escritoId: draft.id, title: draft.titulo || "Escrito Formal", ownerId: owner, fecha: draft.fecha },
          file.name
        )
      } catch (err) {
        console.warn("[escrito-native-sync] No se pudo respaldar el escrito en la app:", err)
      }
    })()
  } catch (err) {
    console.warn("[escrito-native-sync] Respaldo nativo omitido:", err)
  }
}

/**
 * Elimina las copias nativas de un escrito (al borrarlo en la web), manteniendo
 * sincronizados Room + archivo físico. Fire-and-forget.
 */
export function deleteNativeEscritoCopies(escritoId: string): void {
  try {
    if (typeof window === "undefined") return
    if (!window.LaVeinteApp?.listNativeDocuments) return
    if (!escritoId) return
    void (async () => {
      try {
        const docs = await window.LaVeinteApp!.listNativeDocuments()
        const copies = (docs ?? []).filter(
          (d) => d.source === "ESCRITO" && (d as { escritoId?: string }).escritoId === escritoId
        )
        for (const copy of copies) {
          try {
            await deleteNativeDocumentById(copy.id, copy.localPath)
          } catch (err) {
            console.warn("[escrito-native-sync] No se pudo eliminar copia nativa:", err)
          }
        }
      } catch (err) {
        console.warn("[escrito-native-sync] Limpieza nativa omitida:", err)
      }
    })()
  } catch (err) {
    console.warn("[escrito-native-sync] Limpieza nativa omitida:", err)
  }
}
