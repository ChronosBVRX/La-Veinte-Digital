import type { RadarCategory } from "../types"

export interface ScoringResult {
  relevanceScore: number // 0-100
  category: RadarCategory
  isRealInterest: boolean
  keyTopic: string
  justification: string
  relatedClause?: string
}

const CATEGORY_KEYWORDS: Record<RadarCategory, string[]> = {
  NOMINA: [
    "concepto 050",
    "concepto 023",
    "concepto 054",
    "concepto 063",
    "tarjeton",
    "tarjetón",
    "quincena",
    "aumento salarial",
    "retroactivo",
    "tabulador",
    "aguinaldo",
    "fondo de ahorro",
    "estímulo",
    "estimulo",
    "sueldo",
    "pago",
    "depósito",
    "banco",
    "santander",
    "bbva",
  ],
  ESCALAFON: [
    "bolsa de trabajo",
    "escalafon",
    "escalafón",
    "cambio de rama",
    "plaza",
    "propuesta",
    "interinato",
    "cobertura",
    "plantilla",
    "sustitución",
    "antigüedad",
    "puntos",
  ],
  PRESTACIONES: [
    "vacaciones",
    "interactivo",
    "rollo",
    "licencia",
    "días económicos",
    "prestación",
    "prestacion",
    "jubilación",
    "jubilacion",
    "pension",
    "pensión",
    "rjp",
    "crédito",
    "prestamo",
    "beca",
  ],
  SALUD_RIESGO: [
    "infecto",
    "emanaciones",
    "alto riesgo",
    "st-7",
    "st-2",
    "riesgo de trabajo",
    "incapacidad",
    "accidente",
    "insumos",
    "protección",
    "uniformes",
  ],
  CLIMA_LABORAL: [
    "acoso",
    "hostigamiento",
    "guardia",
    "jornada",
    "jornada acumulada",
    "ley silla",
    "bipedestación",
    "director",
    "jefe de servicio",
    "clima laboral",
  ],
  NORMATIVA: [
    "cct",
    "contrato colectivo",
    "cláusula",
    "clausula",
    "estatuto",
    "sntss",
    "sección",
    "reforma lft",
    "lss",
    "congreso nacional",
    "comité ejecutivo",
  ],
  OTRO: [],
}

const PATIENT_COMPLAINT_PATTERNS = [
  "fila de espera",
  "falta de medicinas para pacientes",
  "mal trato de médicos",
  "esperó horas en urgencias",
  "no hay citas en la app",
  "derechohabiente denuncia",
  "pacientes molestos",
  "negligencia medica a derechohabiente",
]

/**
 * Evaluador heurístico determinista (funciona offline o sin LLM).
 */
export function scoreTopicHeuristic(title: string, snippet: string): ScoringResult {
  const combined = `${title} ${snippet}`.toLowerCase()

  // 1. Detectar si es una queja aislada de derechohabiente/usuario
  let patientComplaintHits = 0
  for (const pat of PATIENT_COMPLAINT_PATTERNS) {
    if (combined.includes(pat)) patientComplaintHits++
  }

  // 2. Evaluar categoría por frecuencia de palabras clave
  let bestCategory: RadarCategory = "OTRO"
  let maxHits = 0
  const categoryHits: Record<RadarCategory, number> = {
    NOMINA: 0,
    ESCALAFON: 0,
    PRESTACIONES: 0,
    SALUD_RIESGO: 0,
    CLIMA_LABORAL: 0,
    NORMATIVA: 0,
    OTRO: 0,
  }

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const c = cat as RadarCategory
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        categoryHits[c]++
      }
    }
    if (categoryHits[c] > maxHits) {
      maxHits = categoryHits[c]
      bestCategory = c
    }
  }

  // 3. Cálculo de puntuación base (0 - 100)
  let score = 30 // Puntuación base por contener mención institucional

  if (combined.includes("sntss")) score += 20
  if (combined.includes("imss")) score += 10
  if (combined.includes("trabajador") || combined.includes("empleado") || combined.includes("base")) score += 15

  // Puntos por coincidencia de temas clave
  score += Math.min(35, maxHits * 12)

  // Penalización severa por queja de derechohabiente (ruido para el trabajador)
  if (patientComplaintHits > 0) {
    score = Math.max(10, score - patientComplaintHits * 35)
  }

  // Limitar al rango 0-100
  score = Math.min(100, Math.max(0, score))

  const isRealInterest = score >= 65 && patientComplaintHits === 0

  // 4. Cláusula CCT relacionada tentativa
  let relatedClause: string | undefined = undefined
  if (combined.includes("vacaciones") || combined.includes("47")) relatedClause = "Cláusula 47 (Vacaciones)"
  else if (combined.includes("concepto 050") || combined.includes("asistencia")) relatedClause = "Cláusula 91 (Estímulo de Asistencia)"
  else if (combined.includes("infecto") || combined.includes("riesgo")) relatedClause = "Cláusula 63 (Infectocontagiosidad)"
  else if (combined.includes("escalafon") || combined.includes("plaza")) relatedClause = "Reglamento de Escalafón"
  else if (combined.includes("46") || combined.includes("descanso")) relatedClause = "Cláusula 46 (Descansos obligatorios)"

  // 5. Síntesis y justificación
  const keyTopic = title.length > 90 ? `${title.slice(0, 87)}...` : title
  const justification = isRealInterest
    ? `Tema relevante para el trabajador en el rubro de ${bestCategory}, con impacto en sus derechos o condiciones laborales.`
    : `Publicación detectada pero con bajo impacto directo o clasificada como comentario general / reporte de derechohabientes.`

  return {
    relevanceScore: score,
    category: bestCategory,
    isRealInterest,
    keyTopic,
    justification,
    relatedClause,
  }
}

/**
 * Evalúa un tema utilizando Groq API si está disponible, con fallback automático a la heurística.
 */
export async function scoreTopicWithAI(title: string, snippet: string): Promise<ScoringResult> {
  const groqKey = process.env.GROQ_API_KEY
  const openAiKey = process.env.OPENAI_API_KEY

  if (!groqKey && !openAiKey) {
    return scoreTopicHeuristic(title, snippet)
  }

  const prompt = `Actúa como analista laboral del IMSS y del SNTSS (Sindicato Nacional de Trabajadores del Seguro Social).
Evalúa la siguiente publicación encontrada en medios, foros o redes:

Título: "${title}"
Contenido/Extracto: "${snippet}"

Clasifica objetivamente según el interés real para los TRABAJADORES (médicos, enfermeras, administrativos, intendencia, etc.).
Ignora quejas de derechohabientes sobre tiempos de espera o citas salvo que impliquen falta de insumos o agresión a trabajadores.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{
  "relevanceScore": <número entero entre 0 y 100>,
  "category": <"NOMINA" | "ESCALAFON" | "PRESTACIONES" | "SALUD_RIESGO" | "CLIMA_LABORAL" | "NORMATIVA" | "OTRO">,
  "isRealInterest": <true si relevanceScore >= 65 y concierne al trabajador, false de lo contrario>,
  "keyTopic": "<resumen de 1 oración del punto clave para el empleado>",
  "justification": "<explicación breve de 1 a 2 oraciones de por qué le importa o no al trabajador>",
  "relatedClause": "<cláusula CCT o reglamento aplicable, o null si no aplica>"
}`

  try {
    if (groqKey) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(6000),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          return {
            relevanceScore: Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 50)),
            category: parsed.category || "OTRO",
            isRealInterest: Boolean(parsed.isRealInterest),
            keyTopic: parsed.keyTopic || title,
            justification: parsed.justification || "",
            relatedClause: parsed.relatedClause || undefined,
          }
        }
      }
    }

    if (openAiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(6000),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          return {
            relevanceScore: Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 50)),
            category: parsed.category || "OTRO",
            isRealInterest: Boolean(parsed.isRealInterest),
            keyTopic: parsed.keyTopic || title,
            justification: parsed.justification || "",
            relatedClause: parsed.relatedClause || undefined,
          }
        }
      }
    }
  } catch (err) {
    console.warn("[radar-scoring] AI scoring fallback to heuristic:", err)
  }

  return scoreTopicHeuristic(title, snippet)
}
