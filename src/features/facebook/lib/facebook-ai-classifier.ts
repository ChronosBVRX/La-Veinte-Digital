export const FACEBOOK_POST_CATEGORIES = [
  "Deportes y Cultura",
  "Previsión Social",
  "Convocatorias y Trámites",
  "Laboral y Escalafón",
  "Institucional y Efemérides",
  "Avisos Generales",
] as const

export type FacebookPostCategory = (typeof FACEBOOK_POST_CATEGORIES)[number]

export interface PostClassificationResult {
  category: FacebookPostCategory
  summary: string
  tags: string[]
  source: "ollama" | "rule-based"
}

/**
 * Clasificador determinista por reglas de palabras clave.
 * Garantiza que siempre exista una categoría y resumen institucional,
 * incluso si el motor de IA local está apagado o en mantenimiento.
 */
export function classifyPostByRules(text: string): {
  category: FacebookPostCategory
  summary: string
  tags: string[]
} {
  const lower = (text || "").toLowerCase()
  const tags: string[] = []

  // 1. Deportes y Cultura
  if (
    /torneo|voleibol|futbol|fútbol|básquet|carrera|atletismo|deport|cultural|teatro|baile|danza|recreativ/i.test(
      lower,
    )
  ) {
    if (/voleibol/i.test(lower)) tags.push("Voleibol")
    if (/torneo/i.test(lower)) tags.push("Torneo")
    if (/deport/i.test(lower)) tags.push("Deportes")
    return {
      category: "Deportes y Cultura",
      summary: extractFirstSignificantSentence(text) || "Actividades deportivas y de convivencia sindical para las y los trabajadores.",
      tags: tags.length > 0 ? tags : ["Deportes", "Convivencia"],
    }
  }

  // 2. Previsión Social
  if (
    /previsi[oó]n social|jubilaci[oó]n|pensi[oó]n|cr[eé]dito|pr[eé]stamo|fondo de ayuda|seguro de vida|cesant[ií]a/i.test(
      lower,
    )
  ) {
    if (/cr[eé]dito|pr[eé]stamo/i.test(lower)) tags.push("Créditos")
    if (/jubila/i.test(lower)) tags.push("Jubilación")
    return {
      category: "Previsión Social",
      summary: extractFirstSignificantSentence(text) || "Información sobre prestaciones, créditos y previsión social.",
      tags: tags.length > 0 ? tags : ["Previsión Social", "Beneficios"],
    }
  }

  // 3. Convocatorias y Trámites
  if (
    /convocatoria|tr[aá]mite|registro|requisitos|plazo|inscripci[oó]n|beca|formatos|recepci[oó]n/i.test(
      lower,
    )
  ) {
    if (/convocatoria/i.test(lower)) tags.push("Convocatoria")
    if (/beca/i.test(lower)) tags.push("Becas")
    return {
      category: "Convocatorias y Trámites",
      summary: extractFirstSignificantSentence(text) || "Avisos de convocatoria y trámites oficiales del sindicato.",
      tags: tags.length > 0 ? tags : ["Convocatoria", "Trámites"],
    }
  }

  // 4. Laboral y Escalafón
  if (
    /escalaf[oó]n|plaza|vacante|antig[uü]edad|categor[ií]a|jornada|cambio de rama|contrato colectivo|cct/i.test(
      lower,
    )
  ) {
    if (/escalaf/i.test(lower)) tags.push("Escalafón")
    if (/plaza|vacante/i.test(lower)) tags.push("Plazas")
    return {
      category: "Laboral y Escalafón",
      summary: extractFirstSignificantSentence(text) || "Actualizaciones sobre derechos laborales, escalafón y normatividad.",
      tags: tags.length > 0 ? tags : ["Laboral", "Derechos"],
    }
  }

  // 5. Institucional y Efemérides
  if (
    /d[ií]a mundial|d[ií]a internacional|felicita|reconoc|conmemora|aniversario|escuela de enfermer|asamblea|comit[eé]/i.test(
      lower,
    )
  ) {
    if (/enfermer/i.test(lower)) tags.push("Enfermería")
    if (/reconoc|felicita/i.test(lower)) tags.push("Reconocimiento")
    return {
      category: "Institucional y Efemérides",
      summary: extractFirstSignificantSentence(text) || "Reconocimiento institucional y conmemoraciones de nuestra organización.",
      tags: tags.length > 0 ? tags : ["Institucional", "Comunidad"],
    }
  }

  // 6. Avisos Generales
  return {
    category: "Avisos Generales",
    summary: extractFirstSignificantSentence(text) || "Comunicado informativo para la base trabajadora del IMSS.",
    tags: ["Avisos", "SNTSS"],
  }
}

function extractFirstSignificantSentence(text: string): string {
  const cleaned = (text || "").replace(/^[^\wáéíóúÁÉÍÓÚñÑ]+/gu, "").trim()
  if (!cleaned) return ""
  const firstParagraph = cleaned.split(/\r?\n/)[0]?.trim() ?? ""
  if (firstParagraph.length <= 160) return firstParagraph
  const match = firstParagraph.match(/([^.!?]+[.!?])/u)
  return match ? match[1].trim() : firstParagraph.slice(0, 157).trim() + "…"
}

/**
 * Clasifica y resume una publicación utilizando el motor local Ollama en el VPS.
 * Si Ollama no está disponible o tarda más del timeout, recurre al clasificador por reglas.
 */
export async function classifyPostWithLocalAI(
  text: string,
  ollamaBaseUrl = process.env.OLLAMA_API_URL || "http://127.0.0.1:11434",
  model = "qwen2.5:1.5b",
): Promise<PostClassificationResult> {
  const fallback = classifyPostByRules(text)
  if (!text || text.trim().length < 20) {
    return { ...fallback, source: "rule-based" }
  }

  try {
    const prompt = `Analiza la publicación del sindicato SNTSS (IMSS) y responde ÚNICAMENTE un JSON válido con este formato:
{
  "categoria": "Deportes y Cultura" | "Previsión Social" | "Convocatorias y Trámites" | "Laboral y Escalafón" | "Institucional y Efemérides" | "Avisos Generales",
  "resumen": "un resumen institucional breve de una oración clara",
  "etiquetas": ["etiqueta1", "etiqueta2"]
}

Publicación:
${text.slice(0, 1200)}
`

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) {
      return { ...fallback, source: "rule-based" }
    }

    const data = (await response.json()) as { response?: string }
    if (!data.response) {
      return { ...fallback, source: "rule-based" }
    }

    const parsed = JSON.parse(data.response) as {
      categoria?: string
      resumen?: string
      etiquetas?: string[]
    }

    const matchedCategory = FACEBOOK_POST_CATEGORIES.find(
      (c) => c.toLowerCase() === (parsed.categoria || "").trim().toLowerCase(),
    )

    const category = matchedCategory ?? fallback.category
    const summary = typeof parsed.resumen === "string" && parsed.resumen.trim().length > 10
      ? parsed.resumen.trim()
      : fallback.summary
    const tags = Array.isArray(parsed.etiquetas) && parsed.etiquetas.length > 0
      ? parsed.etiquetas.map((t) => String(t).trim()).filter(Boolean).slice(0, 4)
      : fallback.tags

    return {
      category,
      summary,
      tags,
      source: "ollama",
    }
  } catch {
    return { ...fallback, source: "rule-based" }
  }
}
