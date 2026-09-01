import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { isEscritoDraftV2, migrateLegacyEscritoToV2 } from "@/shared/contracts/escrito-draft"
import { renderStoredEscritoToPdfFile } from "@/shared/lib/escrito-pdf-renderer"

/**
 * Genera un PDF vectorial (Carta jsPDF) a partir de un escrito guardado (V1 o V2),
 * hidratando sus firmas y fotografías desde IndexedDB.
 */
export async function escritoToPdfFile(
  escrito: unknown,
  userId = "anonymous",
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
  }
): Promise<File> {
  const draft: EscritoDraftV2 = isEscritoDraftV2(escrito)
    ? escrito
    : migrateLegacyEscritoToV2(escrito as { id?: string }, userId)

  return renderStoredEscritoToPdfFile(draft, userId, {
    nombreTrabajador: workerProfile?.nombre,
    nombre: workerProfile?.nombre,
    matricula: workerProfile?.matricula,
    categoria: workerProfile?.categoria,
    adscripcion: workerProfile?.adscripcion,
  })
}
