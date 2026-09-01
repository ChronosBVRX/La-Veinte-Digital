import {
  TIPOS_ESCRITO,
  type GenerarEscritoRequest,
  type GenerarEscritoResponse,
} from "@/shared/contracts/escrito-draft"

/**
 * Genera un borrador determinista estructurado en párrafos claros sin invocar LLMs.
 * Usado cuando el backend está fuera de línea, no hay API key o ocurre un error de red.
 */
export function generateBasicFallbackEscrito(req: GenerarEscritoRequest): GenerarEscritoResponse {
  const tipoDef = TIPOS_ESCRITO[req.tipo as keyof typeof TIPOS_ESCRITO]
  const tipoNombre = tipoDef ? tipoDef.titulo : "Escrito"

  const asunto = req.asunto || `${tipoNombre}: ${req.hechos.slice(0, 60)}...`
  const titulo = `Escrito de ${tipoNombre} - ${req.destino.nombre || "Destinatario"}`

  const cuerpo =
    `Por medio de la presente, me dirijo a usted con el debido respeto para exponer los siguientes hechos:\n\n` +
    `${req.hechos.trim()}\n\n` +
    `Por lo anteriormente expuesto, solicito atentamente:\n\n` +
    `${req.peticion.trim()}\n\n` +
    `Agradezco de antemano su atención y quedo en espera de su pronta respuesta conforme a derecho corresponda.`

  return {
    cuerpo,
    asuntoSugerido: asunto,
    tituloSugerido: titulo,
    fuentes: [],
    advertencias: ["Se generó un borrador formal básico utilizando la información proporcionada."],
    generationMode: "basic_fallback",
  }
}
