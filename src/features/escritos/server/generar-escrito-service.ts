import OpenAI from "openai"
import {
  type GenerarEscritoRequest,
  type GenerarEscritoResponse,
  type FuenteNormativaVerificada,
  TIPOS_ESCRITO,
} from "@/shared/contracts/escrito-draft"
import {
  classifyRetrievalIntent,
  extractExactRefs,
  type RetrievedSource,
} from "@/features/asistente/lib/retrieval-sources"
import {
  embedQueryLru,
  retrieveHybrid,
} from "@/features/asistente/lib/motor"

export interface GenerarEscritoContext {
  evidence: RetrievedSource[]
  hasSources: boolean
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

import { generateBasicFallbackEscrito } from "@/features/escritos/lib/fallback-generator"
export { generateBasicFallbackEscrito }

export function buildEscritoPrompt(req: GenerarEscritoRequest, context: GenerarEscritoContext): string {
  const tipoDef = TIPOS_ESCRITO[req.tipo as keyof typeof TIPOS_ESCRITO]
  const tipoNombre = tipoDef ? tipoDef.titulo : "Escrito Formal"

  let prompt = `Eres un asistente experto en redacción de escritos laborales y administrativos para trabajadores del IMSS y agremiados del SNTSS en México.

Tu tarea es redactar ÚNICAMENTE el cuerpo del documento formal (en primera persona, claro, digno, respetuoso y profesional).

Tipo de escrito: ${tipoNombre}
Destinatario: ${req.destino.cargo ? `${req.destino.cargo} (${req.destino.nombre})` : req.destino.nombre || "Autoridad correspondiente"}
Lugar y fecha de referencia: ${req.ciudad || "Sede laboral"}, ${req.fecha || "Fecha actual"}

Hechos expuestos:
${req.hechos}

Petición concreta:
${req.peticion}
`

  if (req.instruccionAjuste) {
    prompt += `\nINSTRUCCIÓN DE AJUSTE:
Se solicita aplicar el siguiente ajuste al cuerpo previo: "${req.instruccionAjuste}".
Cuerpo actual:
${req.cuerpoActual || req.hechos}
Conserva los hechos y la petición intactos, pero adapta el tono, longitud o precisión según la instrucción.
`
  }

  if (context.hasSources && context.evidence.length > 0) {
    prompt += `\nFUENTES NORMATIVAS VERIFICADAS DISPONIBLES:
A continuación se presentan fragmentos normativos reales del corpus oficial:
`
    context.evidence.slice(0, 3).forEach((ev, idx) => {
      const loc = [ev.numero, ev.paginaInicio != null ? `pág. ${ev.paginaInicio}` : null].filter(Boolean).join(" · ")
      prompt += `[Fuente ${idx + 1}] ${ev.documento}${loc ? ` (${loc})` : ""}:\n${ev.fragmento}\n\n`
    })

    prompt += `\nREGLAS DE FUNDAMENTACIÓN:
- Integra citas de las fuentes disponibles de manera natural y formal en la redacción (ej. "Con fundamento en la ${context.evidence[0].numero || "normatividad aplicable"} del ${context.evidence[0].documento}...").
- NO inventes artículos, cláusulas ni leyes que no estén en las fuentes anteriores.
- NO uses etiquetas como "[S1]" o "[Fuente 1]" en el texto final; escribe el nombre de la cláusula o norma con palabras formales.
`
  } else {
    prompt += `\nREGLAS DE FUNDAMENTACIÓN:
- NO inventes números de artículos, cláusulas ni reglamentos.
- Redacta el escrito de forma formal, neutral y sólida basándote estrictamente en los hechos y peticiones aportados por el trabajador.
`
  }

  prompt += `
REGLAS GENERALES ESTRICTAS:
1. NO incluyas encabezado, lugar, fecha, destinatario, "Presente.", "ATENTAMENTE" ni firma (estos elementos se insertan automáticamente en la plantilla final).
2. NO uses markdown (NO asteriscos **, NO almohadillas #, NO viñetas con guiones raros). Solo texto plano con párrafos separados por doble salto de línea.
3. El texto debe ser fluido, formal y respetuoso, estructurado en párrafos claros (inicio, hechos, petición/fundamento y cierre).
`

  return prompt
}

function limpiarTextoGenerado(texto: string): string {
  return texto
    // Quitar encabezados comunes que el LLM pudiera haber colado
    .replace(/^(Lugar y fecha:?|Fecha:?|A quien corresponda:?|Presente\.?|Asunto:?|Estimad[oa].*?:)\s*/gim, "")
    // Quitar markdown
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    // Quitar tokens [S1], [S2], [Fuente 1], etc.
    .replace(/\[(?:S\d+|Fuente\s*\d+)\]/gi, "")
    // Normalizar saltos de línea
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function generarEscritoService(
  req: GenerarEscritoRequest
): Promise<GenerarEscritoResponse> {
  const tipoDef = TIPOS_ESCRITO[req.tipo as keyof typeof TIPOS_ESCRITO]
  const tipoNombre = tipoDef ? tipoDef.titulo : "Escrito"

  const asuntoBase = req.asunto || `${tipoNombre}: ${req.peticion ? req.peticion.slice(0, 50) : req.hechos.slice(0, 50)}`
  const tituloBase = `Escrito de ${tipoNombre} - ${req.destino.nombre || "Destinatario"}`

  const openai = getOpenAI()
  if (!openai) {
    return generateBasicFallbackEscrito(req)
  }

  try {
    const query = `${req.hechos}\n${req.peticion}`
    const intent = classifyRetrievalIntent(query)
    const refs = extractExactRefs(query)

    let evidence: RetrievedSource[] = []
    let hasSources = false
    const advertencias: string[] = []

    if (req.incluirFundamentos) {
      try {
        const emb = await embedQueryLru(query, intent)
        const retrieval = await retrieveHybrid(query, emb.embedding, intent, refs, 5)
        const MIN_RELEVANT_SCORE = 140
        const validSources = retrieval.sources.filter((s) => s.score >= MIN_RELEVANT_SCORE)
        if (validSources.length > 0) {
          evidence = validSources
          hasSources = true
        } else {
          advertencias.push(
            "El borrador fue redactado sin fundamentos normativos porque no se encontró una fuente verificable aplicable a este caso específico."
          )
        }
      } catch (e) {
        console.warn("[generar-escrito-service] Error consultando RAG normativo:", e)
        advertencias.push(
          "No se pudieron consultar las fuentes normativas en este momento. Se redactó un borrador formal basado en tus hechos."
        )
      }
    }

    const context: GenerarEscritoContext = { evidence, hasSources }
    const systemPrompt = buildEscritoPrompt(req, context)

    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: req.instruccionAjuste
            ? `Aplica el ajuste "${req.instruccionAjuste}" al escrito.`
            : `Por favor redacta el cuerpo del oficio de ${tipoNombre} conforme a las instrucciones.`,
        },
      ],
    })

    const rawText = completion.choices[0]?.message?.content || ""
    const cuerpoLimpio = limpiarTextoGenerado(rawText)

    if (!cuerpoLimpio || cuerpoLimpio.length < 30) {
      return generateBasicFallbackEscrito(req)
    }

    const fuentesFormateadas: FuenteNormativaVerificada[] = evidence.map((ev) => ({
      documento: ev.documento,
      version: ev.version,
      numero: ev.numero ?? undefined,
      paginaInicio: ev.paginaInicio ?? undefined,
      paginaFin: ev.paginaFin ?? undefined,
      sourceUrl: ev.sourceUrl ?? undefined,
      fragmento: ev.fragmento,
    }))

    return {
      cuerpo: cuerpoLimpio,
      asuntoSugerido: asuntoBase,
      tituloSugerido: tituloBase,
      fuentes: fuentesFormateadas,
      advertencias,
      generationMode: hasSources ? "ai_with_sources" : "ai_without_sources",
    }
  } catch (err) {
    console.error("[generar-escrito-service] Error generando con OpenAI:", err)
    return generateBasicFallbackEscrito(req)
  }
}
