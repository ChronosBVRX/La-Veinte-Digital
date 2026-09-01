import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { isEscritoDraftV2, migrateLegacyEscritoToV2 } from "@/shared/contracts/escrito-draft"
import { renderEscritoToPdfFile } from "@/shared/lib/escrito-pdf-renderer"

/**
 * Genera un PDF vectorial (Carta jsPDF) a partir de un escrito guardado (V1 o V2),
 * para compartir o imprimir a través del flujo de transferencia de Documentos Personales.
 */
export async function escritoToPdfFile(
  escrito: unknown,
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
  }
): Promise<File> {
  const draft: EscritoDraftV2 = isEscritoDraftV2(escrito)
    ? escrito
    : migrateLegacyEscritoToV2(escrito as { id: string }, "anonymous")

  return renderEscritoToPdfFile(draft, {
    nombreTrabajador: workerProfile?.nombre,
    matricula: workerProfile?.matricula,
    categoria: workerProfile?.categoria,
    adscripcion: workerProfile?.adscripcion,
  })
}
