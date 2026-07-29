import { NextResponse } from "next/server"
import OpenAI from "openai"
import data from "@/lib/services/vectorstore-data.json"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SCENARIOS: Record<string, { nombre: string; contexto: string; keywords: string[] }> = {
  faltas: {
    nombre: "Faltas Injustificadas",
    contexto: "Investigación por faltas de asistencia sin justificar. El trabajador acumuló 3 faltas en 15 días, posible abandono de servicio.",
    keywords: ["faltas", "asistencia", "abandono", "justificar", "inasistencia", "Cláusula 47", "artículo 51", "Reglamento Interior"],
  },
  maltrato: {
    nombre: "Presunto Maltrato",
    contexto: "Queja formal por maltrato verbal y hostigamiento laboral, turnada a la Comisión Mixta Disciplinaria.",
    keywords: ["maltrato", "hostigamiento", "queja", "disciplinaria", "respeto", "Cláusula 9", "artículo 48", "Ley Federal del Trabajo"],
  },
  incumplimiento: {
    nombre: "Incumplimiento de Funciones",
    contexto: "Reporte de supervisión por omisión de funciones según profesiograma y falta de reporte al jefe inmediato.",
    keywords: ["funciones", "profesiograma", "obligaciones", "omisión", "incumplimiento", "Cláusula 3", "Cláusula 45"],
  },
  extravio: {
    nombre: "Extravío de Insumos",
    contexto: "Faltante en inventario trimestral de materiales bajo resguardo del trabajador por ~$15,000.",
    keywords: ["inventario", "resguardo", "extravió", "pérdida", "patrimonial", "Cláusula 38", "Cláusula 52"],
  },
  retardo: {
    nombre: "Retardos Frecuentes",
    contexto: "Múltiples retardos registrados en un mes, acumulando más de 240 minutos, con dos llamadas de atención previas.",
    keywords: ["retardo", "horario", "puntualidad", "asistencia", "Cláusula 47", "Reglamento Interior"],
  },
  confidencialidad: {
    nombre: "Violación de Confidencialidad",
    contexto: "Investigación por presunta divulgación de información confidencial de derechohabientes a terceros no autorizados.",
    keywords: ["confidencialidad", "información", "datos", "divulgación", "resguardo", "Cláusula 8", "Cláusula 42", "Ley General de Salud"],
  },
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function extractNumbers(text: string, pattern: RegExp): number[] {
  const nums: number[] = []
  const m = text.match(pattern)
  if (m) {
    for (const match of m) {
      const n = parseInt(match.replace(/\D/g, ""), 10)
      if (!isNaN(n)) nums.push(n)
    }
  }
  return [...new Set(nums)]
}

function topK(queryEmbedding: number[], query: string, k: number, keywords: string[]): string[] {
  const queryArts = extractNumbers(query, /art[iíïi]culo\s*(\d+)/gi)
  const queryClaus = extractNumbers(query, /cl[aá]usula\s*(\d+)/gi)
  const q = query.toLowerCase()

  const scored = data.embeddings.map((emb, i) => {
    let score = cosineSimilarity(queryEmbedding, emb)
    const chunk = data.chunks[i]
    const chunkLower = chunk.toLowerCase()

    // Keyword boosts from scenario
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase()) && chunkLower.includes(kw.toLowerCase())) {
        score += 0.25
      }
    }

    // Boost Ley Federal del Trabajo and Ley General de Salud when relevant
    if (q.includes("ley federal") && chunkLower.includes("ley federal del trabajo")) score += 0.4
    if (q.includes("ley general de salud") && chunkLower.includes("ley general de salud")) score += 0.4
    if (q.includes("confidencialidad") && chunkLower.includes("ley general de salud")) score += 0.3
    if (q.includes("salud") && chunkLower.includes("ley general de salud")) score += 0.2
    if (q.includes("trabajo") && chunkLower.includes("ley federal del trabajo")) score += 0.2
    if (q.includes("despido") && chunkLower.includes("ley federal del trabajo")) score += 0.3
    if (q.includes("rescisión") && chunkLower.includes("rescisión")) score += 0.35
    if (q.includes("disciplinaria") && chunkLower.includes("disciplinaria")) score += 0.3

    // Structural boosts for article/clause references
    for (const qn of queryArts) {
      if (new RegExp(`art[iíïi]culo\\s*${qn}`, "i").test(chunk)) score += 0.8
    }
    for (const qn of queryClaus) {
      if (new RegExp(`cl[aá]usula\\s*${qn}`, "i").test(chunk)) score += 0.8
    }

    return { score, idx: i }
  })
  scored.sort((a, b) => b.score - a.score)

  const selected = new Set<number>()
  for (const s of scored) {
    if (selected.size >= k) break
    selected.add(s.idx)
  }

  return Array.from(selected).sort((a, b) => a - b).map((i) => data.chunks[i])
}

export async function GET() {
  return NextResponse.json({ status: "ok" })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, history, scenario: scenarioId, difficulty = 1 } = body

    if (action === "analyze") {
      return handleAnalysis(history, scenarioId)
    }

    return handleChat(history, scenarioId, difficulty)
  } catch (e) {
    const error = e as Error
    return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 })
  }
}

async function handleChat(
  history: { role: string; content: string }[],
  scenarioId: string,
  difficulty: number
) {
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.faltas
  const question = [...history].reverse().find((m) => m.role === "user")?.content?.trim()
  const openai = getOpenAI()

  // Build rich context from ALL documentation
  const searchQuery = `${scenario.nombre} ${scenario.keywords.join(" ")} ${question ?? ""}`
  let context = ""

  try {
    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: searchQuery,
    })
    const queryEmbedding = embeddingResp.data[0].embedding
    const relevantChunks = topK(queryEmbedding, searchQuery, 12, scenario.keywords)
    context = relevantChunks.join("\n\n---\n\n")
  } catch {
    context = ""
  }

  const intensityDesc = difficulty === 2
    ? "Eres INTIMIDADOR, buscas contradicciones agresivamente, aceleras el ritmo, interrumpes con preguntas de seguimiento, y usas un tono de presión constante. No das tiempo para respirar."
    : "Tus preguntas son directas pero formales, das tiempo para responder, mantienes un tono profesional sin ser agresivo."

  const isFirstMessage = history.length <= 1

  const systemPrompt = `Eres el Lic. Mendoza, funcionario del área jurídica del IMSS o representante de la Comisión Mixta Disciplinaria. Tu personalidad es FRÍA, BUROCRÁTICA, INCISIVA y PROFESIONAL. Hablas como un investigador que busca esclarecer los hechos. NO eres amigable, NO usas emojis, NO das consejos. Eres neutral y procedimental.

CONTEXTO DE LA INVESTIGACIÓN:
${scenario.contexto}

NIVEL DE DIFICULTAD: ${difficulty === 2 ? "Nivel 2 - Presión Alta" : "Nivel 1 - Aclaración de hechos"}
${intensityDesc}

NORMATIVIDAD APLICABLE (DOCUMENTACIÓN OFICIAL — debes basar tus preguntas ESTRICTAMENTE en este contenido):
${context || "Tienes conocimiento de la normatividad IMSS, CCT, Estatutos SNTSS, Ley Federal del Trabajo y Ley General de Salud. Debes citar artículos y cláusulas específicos."}

INSTRUCCIONES ESTRICTAS — CERO INVENCIÓN:
1. NO inventes cláusulas, artículos o disposiciones que no estén en el contexto proporcionado.
2. Cada pregunta o afirmación debe poder respaldarse con una referencia documental específica (Cláusula X, Artículo Y, Ley Z).
3. Si no encuentras una disposición específica en el contexto, formula la pregunta de forma genérica sin citar artículos falsos.
4. Es preferible decir "según la normatividad aplicable" a inventar un número de artículo.
5. Cita SIEMPRE el documento de origen: "[Clausulas.pdf]", "[Ley Federal del Trabajo.pdf]", "[REGLAMENTO INTERIOR DE TRABAJO.pdf]", etc.
6. Tus preguntas deben ser verosímiles y basadas en derecho laboral real.

REGLAS DE CONDUCTA:
1. Responde SIEMPRE en español formal, con tono burocrático, serio y profesional. Usa "usted".
2. Haz preguntas capciosas, de seguimiento y que busquen obtener información detallada.
3. Si el trabajador se contradice, omite información o da respuestas vagas, SEÑÁLALO y presiona para obtener claridad.
4. NO uses emojis. NO seas cálido. NO ofrezcas ayuda.
5. Cada respuesta debe hacer avanzar la investigación hacia una conclusión.
6. Si el trabajador pide un abogado o representante sindical, indícale que tiene derecho pero que la investigación continuará.

${isFirstMessage ? `INICIO DE LA AUDIENCIA:
Comienza la investigación presentándote formalmente como el Lic. Mendoza, del área jurídica, indicando el motivo de la citatoria y preguntando al trabajador si está consciente del motivo de esta investigación. Menciona la normatividad aplicable citando documentos reales del contexto. No seas agresivo en la primera interacción, pero sí formal y serio.` : ""}

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido en este formato exacto (sin texto adicional, sin markdown):
{"mensaje": "tu respuesta como inquisidor", "presion": 1-10, "estado": "neutral"|"inquisitivo"|"presionando"|"desaprobando"}

Donde:
- "mensaje": tu respuesta textual como Lic. Mendoza. Incluye citas a documentos reales del contexto.
- "presion": nivel de presión de 1 a 10 (1 = pregunta suave, 10 = interrogatorio intimidante)
- "estado": expresión sugerida para el avatar`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: difficulty === 2 ? 0.5 : 0.2,
    messages,
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  let parsed: { mensaje: string; presion: number; estado: string }

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = { mensaje: raw.replace(/[{}"]/g, ""), presion: 5, estado: "neutral" }
  }

  return NextResponse.json({
    respuesta: parsed.mensaje,
    presion: Math.max(1, Math.min(10, parsed.presion ?? 5)),
    estado: ["neutral", "inquisitivo", "presionando", "desaprobando"].includes(parsed.estado)
      ? parsed.estado : "neutral",
  })
}

async function handleAnalysis(history: { role: string; content: string }[], scenarioId: string) {
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.faltas
  const conversationText = history
    .map((m) => `${m.role === "user" ? "TRABAJADOR" : "LIC. MENDOZA"}: ${m.content}`)
    .join("\n\n")

  const openai = getOpenAI()

  // Get relevant legal context for the analysis
  const lastMessages = history.slice(-4).map((m) => m.content).join(" ")
  let legalContext = ""
  try {
    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: `${scenario.nombre} ${scenario.keywords.join(" ")} ${lastMessages}`,
    })
    const queryEmbedding = embeddingResp.data[0].embedding
    const relevantChunks = topK(queryEmbedding, lastMessages, 8, scenario.keywords)
    legalContext = relevantChunks.join("\n\n---\n\n")
  } catch {
    legalContext = ""
  }

  const systemPrompt = `Eres un analista especializado en evaluar el desempeño de trabajadores en investigaciones laborales y auditorías disciplinarias del IMSS. Debes analizar la siguiente conversación entre un trabajador y un investigador (Lic. Mendoza del área jurídica).

NORMATIVIDAD DE REFERENCIA PARA ESTE ANÁLISIS (usa esto para identificar qué artículos debió invocar el trabajador):
${legalContext || "CCT del IMSS, Ley Federal del Trabajo, Reglamento Interior de Trabajo, Estatutos SNTSS."}

Evalúa los siguientes aspectos y responde ÚNICAMENTE con un objeto JSON (sin texto adicional):

{
  "puntajeCalma": 0-100,
  "puntajeFirmeza": 0-100,
  "erroresTacticos": ["descripción del error 1", "descripción del error 2"],
  "fortalezas": ["aspecto positivo 1", "aspecto positivo 2"],
  "articulosRelevantes": ["Cláusula/Artículo que debió invocar con nombre del documento", "otro artículo con documento"],
  "resumen": "párrafo breve con recomendación general"
}

CRITERIOS DE EVALUACIÓN:
- puntajeCalma: ¿Mantuvo el trabajador la compostura? ¿Se alteró, respondió agresivamente o se puso nervioso?
- puntajeFirmeza: ¿Respondió con claridad y seguridad? ¿Se contradijo o dio respuestas vagas?
- erroresTacticos: ¿Dijo algo que podría usarse en su contra? ¿Habló de más? ¿Se autoincriminó? ¿No supo citar normatividad aplicable?
- fortalezas: ¿Mantuvo silencio cuando debía? ¿Respondió con precisión? ¿Citó cláusulas?
- articulosRelevantes: Basado en NORMATIVIDAD REAL del contexto. NO inventes artículos. Usa SOLO los documentos y artículos que aparecen en el contexto proporcionado. Ej: "Cláusula 47 del CCT", "Artículo 51 del Reglamento Interior de Trabajo", "Artículo 47 de la Ley Federal del Trabajo".
- resumen: Evaluación general y recomendación pedagógica para mejorar en futuras investigaciones.

IMPORTANTE: Sé objetivo y constructivo. NO inventes referencias legales. Usa exclusivamente la normatividad del contexto proporcionado. Si el contexto no contiene un artículo específico, no lo inventes.`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Aquí está la transcripción de la investigación:\n\n${conversationText}` },
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages,
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({
      puntajeCalma: Math.max(0, Math.min(100, parsed.puntajeCalma ?? 50)),
      puntajeFirmeza: Math.max(0, Math.min(100, parsed.puntajeFirmeza ?? 50)),
      erroresTacticos: Array.isArray(parsed.erroresTacticos) ? parsed.erroresTacticos : [],
      fortalezas: Array.isArray(parsed.fortalezas) ? parsed.fortalezas : [],
      articulosRelevantes: Array.isArray(parsed.articulosRelevantes) ? parsed.articulosRelevantes : [],
      resumen: parsed.resumen ?? "No se pudo generar un análisis completo.",
    })
  } catch {
    return NextResponse.json({
      puntajeCalma: 50, puntajeFirmeza: 50,
      erroresTacticos: ["No se pudieron analizar los errores tácticos automáticamente."],
      fortalezas: ["No se pudieron identificar fortalezas automáticamente."],
      articulosRelevantes: ["Revisa la normatividad aplicable con tu representante sindical."],
      resumen: "No se pudo completar el análisis automático. Consulta a tu representante sindical para retroalimentación personalizada.",
    })
  }
}
