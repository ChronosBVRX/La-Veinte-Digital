/**
 * Servicio de generación de escritos con IA y RAG normativo estricto.
 * La Veinte Digital
 */

import OpenAI from "openai"
import {
  TIPOS_ESCRITO,
  type GenerarEscritoRequest,
  type GenerarEscritoResponse,
  type FuenteNormativaVerificada,
  type TipoEscritoKey,
} from "@/shared/contracts/escrito-draft"
import { generateBasicFallbackEscrito } from "@/features/escritos/lib/fallback-generator"
import {
  retrieveNormativaSources,
  type RetrievedNormativaSource,
} from "@/shared/server/normativa/normativa-retrieval"

export { generateBasicFallbackEscrito }

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

const STATIC_SYSTEM_PROMPT = `Eres un asistente profesional de redacción laboral y administrativa para trabajadores del IMSS y agremiados del SNTSS en México.

Tu función es redactar EXCLUSIVAMENTE el cuerpo del escrito (en primera persona, con tono digno, formal, claro y respetuoso).

REGLAS ESTRICTAS DE SEGURIDAD Y FORMATO:
1. NO incluyas lugar, fecha, destinatario, "Presente.", "ATENTAMENTE" ni firma (estos elementos se renderizan automáticamente en la plantilla).
2. NO utilices markdown (NO asteriscos **, NO títulos con #, NO viñetas con guiones). Solo texto en párrafos claros separados por doble salto de línea.
3. El texto debe estar estructurado en: párrafo inicial de presentación formal, exposición cronológica y respetuosa de los hechos, petición concreta, y párrafo de cierre formal.
4. Si se te proporciona <evidencia_normativa_verificada>, puedes fundamentar con los artículos o cláusulas exactos que aparezcan allí.
5. Si NO hay <evidencia_normativa_verificada>, NO INVENTES artículos, cláusulas, acuerdos, jurisprudencias ni números de ley bajo ninguna circunstancia.`

function sanitizeString(str: unknown, maxLen: number): string {
  if (typeof str !== "string") return ""
  return str.trim().slice(0, maxLen)
}

export function validateGenerarEscritoRequest(req: unknown): {
  valid: boolean
  error?: string
  data?: GenerarEscritoRequest
} {
  if (!req || typeof req !== "object") {
    return { valid: false, error: "Cuerpo de solicitud inválido." }
  }

  const r = req as Partial<GenerarEscritoRequest>
  const validTypes: TipoEscritoKey[] = ["solicitud", "aclaracion", "queja", "seguimiento", "libre"]
  if (!r.tipo || !validTypes.includes(r.tipo)) {
    return { valid: false, error: "El tipo de escrito no es válido." }
  }

  const hechos = sanitizeString(r.hechos, 5000)
  const peticion = sanitizeString(r.peticion, 2000)

  if (hechos.length < 5 && peticion.length < 5) {
    return { valid: false, error: "Debes proporcionar hechos o una petición concreta." }
  }

  const destinoNombre = sanitizeString(r.destino?.nombre, 150)
  const destinoCargo = sanitizeString(r.destino?.cargo, 150)
  const ciudad = sanitizeString(r.ciudad, 100)
  const fecha = sanitizeString(r.fecha, 50)
  const asunto = sanitizeString(r.asunto, 200)
  const cuerpoActual = sanitizeString(r.cuerpoActual, 10000)
  const instruccionAjuste = sanitizeString(r.instruccionAjuste, 500)

  return {
    valid: true,
    data: {
      tipo: r.tipo,
      hechos,
      peticion,
      destino: { nombre: destinoNombre, cargo: destinoCargo },
      ciudad,
      fecha,
      asunto: asunto || undefined,
      atencion: Array.isArray(r.atencion) ? r.atencion : [],
      copias: Array.isArray(r.copias) ? r.copias : [],
      incluirFundamentos: Boolean(r.incluirFundamentos),
      cuerpoActual: cuerpoActual || undefined,
      instruccionAjuste: instruccionAjuste || undefined,
    },
  }
}

export function buildUserPrompt(
  req: GenerarEscritoRequest,
  evidence: RetrievedNormativaSource[]
): string {
  const tipoDef = TIPOS_ESCRITO[req.tipo]
  const tipoNombre = tipoDef ? tipoDef.titulo : "Escrito Formal"

  let prompt = `<datos_del_escrito>
<tipo>${tipoNombre}</tipo>
<destinatario>${req.destino.cargo ? `${req.destino.cargo} (${req.destino.nombre})` : req.destino.nombre || "A quien corresponda"}</destinatario>
<lugar_fecha>${req.ciudad || "Sede laboral"}, ${req.fecha || "Fecha actual"}</lugar_fecha>
<hechos>
${req.hechos}
</hechos>
<peticion>
${req.peticion}
</peticion>
</datos_del_escrito>`

  if (evidence.length > 0) {
    prompt += `\n\n<evidencia_normativa_verificada>\n`
    for (const ev of evidence) {
      prompt += `[${ev.documento} - ${ev.numero || "Sección general"}]: ${ev.fragmento}\n`
    }
    prompt += `</evidencia_normativa_verificada>\n`
  }

  if (req.instruccionAjuste) {
    prompt += `\n\n<instruccion_ajuste>
Se solicita aplicar el siguiente ajuste al cuerpo previo: "${req.instruccionAjuste}".
Cuerpo actual:
${req.cuerpoActual || req.hechos}
Conserva los hechos y la petición íntegros, adaptando el texto según la instrucción.
</instruccion_ajuste>`
  }

  prompt += `\n\nInstrucción final: Redacta el cuerpo formal del documento en español neutro institucional mexicano.`
  return prompt
}

function limpiarTextoGenerado(texto: string): string {
  return texto
    .replace(/^(Lugar y fecha:?|Fecha:?|A quien corresponda:?|Presente\.?|Asunto:?|Estimad[oa].*?:)\s*/gim, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[(?:S\d+|Fuente\s*\d+)\]/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function generarEscritoService(
  req: GenerarEscritoRequest
): Promise<GenerarEscritoResponse> {
  const tipoDef = TIPOS_ESCRITO[req.tipo]
  const tipoNombre = tipoDef ? tipoDef.titulo : "Escrito"

  const asuntoBase =
    req.asunto ||
    `${tipoNombre}: ${req.peticion ? req.peticion.slice(0, 50) : req.hechos.slice(0, 50)}`
  const tituloBase = `Escrito de ${tipoNombre} - ${req.destino.nombre || req.destino.cargo || "Destinatario"}`

  const openai = getOpenAI()
  if (!openai) {
    return generateBasicFallbackEscrito(req)
  }

  try {
    let evidence: RetrievedNormativaSource[] = []
    let hasSources = false
    const advertencias: string[] = []

    if (req.incluirFundamentos) {
      const query = `${req.hechos} ${req.peticion}`
      evidence = await retrieveNormativaSources(query, 3)
      if (evidence.length > 0) {
        hasSources = true
      } else {
        advertencias.push(
          "Borrador generado sin fuentes normativas verificadas aplicables al caso."
        )
      }
    } else {
      advertencias.push(
        "Borrador generado sin fuentes normativas a solicitud del usuario."
      )
    }

    const userPrompt = buildUserPrompt(req, evidence)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: STATIC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
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
