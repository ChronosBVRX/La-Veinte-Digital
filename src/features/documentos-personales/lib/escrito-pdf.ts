import type { EscritoGuardado } from "@/features/escritos/services/escritos-storage"
import { renderEscritoToPdfFile } from "@/shared/lib/escrito-pdf-renderer"
import type { WorkerProfileContext } from "@/shared/contracts/escrito-draft"

/**
 * Genera un archivo PDF formal (letter, texto seleccionable y anexos) a partir
 * de un escrito guardado, utilizando el renderizador unificado compartido.
 */
export async function escritoToPdfFile(
  escrito: EscritoGuardado,
  profile?: WorkerProfileContext
): Promise<File> {
  return renderEscritoToPdfFile(escrito, profile)
}
