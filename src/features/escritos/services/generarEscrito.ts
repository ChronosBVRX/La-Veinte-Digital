import type {
  GenerarEscritoRequest,
  GenerarEscritoResponse,
} from "@/shared/contracts/escrito-draft"
import { generateBasicFallbackEscrito } from "@/features/escritos/lib/fallback-generator"

export async function generarEscrito(
  req: GenerarEscritoRequest
): Promise<GenerarEscritoResponse> {
  try {
    const res = await fetch("/api/escritos/generar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const errorMessage = data.error || `Error ${res.status}: No fue posible generar el escrito.`

      // No enmascarar errores de autorización o cuota
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        throw new Error(errorMessage)
      }

      console.warn("[generarEscrito] Error del servidor en /api/escritos/generar:", errorMessage)
      return {
        ...generateBasicFallbackEscrito(req),
        advertencias: ["La redacción inteligente no está disponible en este momento."],
        generationMode: "basic_fallback",
      }
    }

    const data = (await res.json()) as GenerarEscritoResponse
    return data
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("401") || err.message.includes("Inicia sesión") || err.message.includes("cuota"))) {
      throw err
    }
    console.warn("[generarEscrito] Error de red o ejecución:", err)
    return {
      ...generateBasicFallbackEscrito(req),
      advertencias: ["La redacción inteligente no está disponible en este momento."],
      generationMode: "basic_fallback",
    }
  }
}
