import type { GenerarEscritoRequest, GenerarEscritoResponse } from "@/shared/contracts/escrito-draft"
import { generateBasicFallbackEscrito } from "@/features/escritos/lib/fallback-generator"

export async function generarEscritoApi(
  req: GenerarEscritoRequest
): Promise<GenerarEscritoResponse> {
  try {
    const res = await fetch("/api/escritos/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const errorMsg = data.error || `Error en el servidor (${res.status})`
      console.warn("[generarEscrito] Fallo en API, usando fallback:", errorMsg)
      return generateBasicFallbackEscrito(req)
    }

    const data = await res.json()
    return data as GenerarEscritoResponse
  } catch (error) {
    console.warn("[generarEscrito] Error de red o conexión, usando fallback:", error)
    return generateBasicFallbackEscrito(req)
  }
}

/**
 * Función de compatibilidad para llamadas simples con solo hechos
 */
export async function generarEscrito(hechos: string): Promise<string> {
  const res = await generarEscritoApi({
    tipo: "solicitud",
    hechos,
    peticion: "",
    destino: { cargo: "", nombre: "" },
    ciudad: "",
    fecha: new Date().toISOString().slice(0, 10),
  })
  return res.cuerpo
}
