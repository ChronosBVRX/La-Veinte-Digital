import { NextResponse } from "next/server"
import OpenAI from "openai"
import data from "@/lib/services/vectorstore-data.json"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SCENARIOS: Record<string, { nombre: string; contexto: string; clausulas: string }> = {
  faltas: {
    nombre: "Faltas Injustificadas",
    contexto: `El trabajador ha sido citado por haber incurrido en faltas de asistencia sin justificación. Según el reporte del departamento de personal, acumuló 3 faltas en un periodo de 15 días, lo que podría configurar abandono de servicio. Debes investigar los hechos, las razones de las faltas, si existió aviso previo, y si el trabajador presentó justificantes. Cita la Cláusula 47 del CCT y el artículo 51 del Reglamento Interior de Trabajo.`,
    clausulas: "Cláusula 47 (CCT), Artículo 51 (Reglamento Interior de Trabajo)",
  },
  maltrato: {
    nombre: "Presunto Maltrato",
    contexto: `Se ha recibido una queja formal por parte de un compañero de trabajo que acusa al trabajador de conductas de maltrato verbal y hostigamiento en el área laboral. La queja fue turnada a la Comisión Mixta Disciplinaria. Debes interrogar al trabajador sobre los hechos, su versión, testigos y antecedentes. Cita la Cláusula 9 del CCT y el artículo 48 del Reglamento Interior de Trabajo sobre respeto y buenas relaciones laborales.`,
    clausulas: "Cláusula 9 (CCT), Artículo 48 (Reglamento Interior de Trabajo)",
  },
  incumplimiento: {
    nombre: "Incumplimiento de Funciones",
    contexto: `El área de supervisión reportó que el trabajador no ha cumplido con las funciones establecidas en su profesiograma durante el último mes. Se señala omisión en tareas asignadas y falta de reporte a su jefe inmediato. Debes indagar sobre las funciones específicas del puesto, la comunicación con su supervisor y las razones del presunto incumplimiento. Cita la Cláusula 3 y 45 del CCT.`,
    clausulas: "Cláusulas 3 y 45 (CCT)",
  },
  extravio: {
    nombre: "Extravío de Insumos",
    contexto: `Durante el inventario trimestral del área se detectó la falta de materiales y equipos que estaban bajo resguardo del trabajador. El monto de lo extraviado asciende a aproximadamente $15,000 pesos. Debes cuestionar al trabajador sobre el control de inventario, las bitácoras de resguardo y si existió alguna novedad o irregularidad. Cita la Cláusula 38 y 52 del CCT sobre responsabilidad por pérdidas.`,
    clausulas: "Cláusulas 38 y 52 (CCT)",
  },
  retardo: {
    nombre: "Retardos Frecuentes",
    contexto: `El departamento de personal registró múltiples retardos del trabajador en el último mes, acumulando más de 240 minutos de retardo en el periodo. Se le ha llamado la atención en dos ocasiones previas de manera verbal. Debes investigar las causas, horarios, turnos y si existió autorización previa. Cita la Cláusula 47 del CCT y el Reglamento Interior de Trabajo.`,
    clausulas: "Cláusula 47 (CCT), Reglamento Interior de Trabajo",
  },
  confidencialidad: {
    nombre: "Violación de Confidencialidad",
    contexto: `Se investiga al trabajador por presunta divulgación de información confidencial de derechohabientes del IMSS a terceros no autorizados. El área jurídica recibió una queja anónima señalando que el trabajador compartió datos sensibles. Debes indagar sobre el manejo de información, los procedimientos de confidencialidad que conoce y si existe evidencia de la divulgación. Cita la Cláusula 8 y 42 del CCT sobre confidencialidad.`,
    clausulas: "Cláusulas 8 y 42 (CCT)",
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

function topK(queryEmbedding: number[], query: string, k: number): string[] {
  const queryArts = extractNumbers(query, /art[iíïi]culo\s*(\d+)/gi)
  const queryClaus = extractNumbers(query, /cl[aá]usula\s*(\d+)/gi)
  const q = query.toLowerCase()

  const scored = data.embeddings.map((emb, i) => {
    let score = cosineSimilarity(queryEmbedding, emb)
    const chunk = data.chunks[i]
    const chunkLower = chunk.toLowerCase()

    if (q.includes("obligaciones") && chunkLower.includes("obligaciones")) score += 0.15
    if (q.includes("derechos") && chunkLower.includes("derechos")) score += 0.15
    if (q.includes("suspensión") && chunkLower.includes("suspendidos")) score += 0.2
    if (q.includes("faltas") && chunkLower.includes("faltas")) score += 0.2
    if (q.includes("justificar") && chunkLower.includes("justificar")) score += 0.2
    if (q.includes("disciplinaria") && chunkLower.includes("disciplinaria")) score += 0.3
    if (q.includes("rescisión") && chunkLower.includes("rescisión")) score += 0.3
    if (q.includes("confidencialidad") && chunkLower.includes("confidencialidad")) score += 0.25
    if (q.includes("inventario") && chunkLower.includes("inventario")) score += 0.2
    if (q.includes("queja") && chunkLower.includes("queja")) score += 0.15

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
      return handleAnalysis(history)
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

  let context = ""
  if (question) {
    try {
      const embeddingResp = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: question,
      })
      const queryEmbedding = embeddingResp.data[0].embedding
      const relevantChunks = topK(queryEmbedding, question, 6)
      context = relevantChunks.join("\n\n---\n\n")
    } catch {
      context = "(Sin contexto documental disponible)"
    }
  }

  const intensityDesc = difficulty === 2
    ? "Eres INTIMIDADOR, buscas contradicciones agresivamente, aceleras el ritmo, interrumpes con preguntas de seguimiento, y usas un tono de presión constante. No das tiempo para respirar."
    : "Tus preguntas son directas pero formales, das tiempo para responder, mantienes un tono profesional sin ser agresivo."

  const isFirstMessage = history.length <= 1

  const systemPrompt = `Eres un funcionario del área jurídica del IMSS o un representante de la Comisión Mixta Disciplinaria. Tu nombre es Lic. Mendoza. Tu personalidad es FRÍA, BUROCRÁTICA, INCISIVA y PROFESIONAL. Hablas como un investigador que busca esclarecer los hechos. NO eres amigable, NO usas emojis, NO das consejos. Eres neutral y procedimental.

CONTEXTO DE LA INVESTIGACIÓN:
${scenario.contexto}

CLÁUSULAS APLICABLES:
${scenario.clausulas}

NIVEL DE DIFICULTAD: ${difficulty === 2 ? "Nivel 2 - Presión Alta" : "Nivel 1 - Aclaración de hechos"}
${intensityDesc}

NORMATIVIDAD DE REFERENCIA (puedes citar textualmente fragmentos de estos documentos):
${context || "(Sin contexto documental específico, usa tu conocimiento general del CCT y normatividad IMSS)"}

REGLAS DE CONDUCTA:
1. Responde SIEMPRE en español formal, con tono burocrático, serio y profesional.
2. Cita cláusulas del CCT, artículos del Reglamento Interior de Trabajo o normatividad aplicable del IMSS.
3. Haz preguntas capciosas, de seguimiento y que busquen obtener información detallada.
4. Si el trabajador se contradice, omite información o da respuestas vagas, SEÑÁLALO y presiona para obtener claridad.
5. NO uses emojis. NO seas cálido. NO ofrezcas ayuda o consejo. Eres un investigador, no un asesor.
6. Usa un lenguaje formal: "usted", "trabajador", "dígame", "explíqueme".
7. Cada respuesta debe hacer avanzar la investigación hacia una conclusión.

${isFirstMessage ? `INICIO DE LA AUDIENCIA:
Comienza la investigación presentándote formalmente como el Lic. Mendoza, del área jurídica, indicando el motivo de la citatoria y preguntando al trabajador si está consciente del motivo de esta investigación. No seas agresivo en la primera interacción, pero sí formal y serio.` : ""}

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido en este formato exacto (sin texto adicional, sin markdown):
{"mensaje": "tu respuesta como inquisidor", "presion": 1-10, "estado": "neutral"|"inquisitivo"|"presionando"|"desaprobando"}

Donde:
- "mensaje": tu respuesta textual como Lic. Mendoza
- "presion": nivel de presión de 1 a 10 (1 = pregunta suave/de apertura, 10 = interrogatorio intimidante)
- "estado": expresión sugerida para el avatar: "neutral" (pregunta normal), "inquisitivo" (indagando a fondo), "presionando" (ejerciendo presión), "desaprobando" (cuando el trabajador dice algo incorrecto o se contradice)`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: difficulty === 2 ? 0.7 : 0.3,
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

async function handleAnalysis(history: { role: string; content: string }[]) {
  const conversationText = history
    .map((m) => `${m.role === "user" ? "TRABAJADOR" : "LIC. MENDOZA"}: ${m.content}`)
    .join("\n\n")

  const openai = getOpenAI()

  const systemPrompt = `Eres un analista especializado en evaluar el desempeño de trabajadores en investigaciones laborales y auditorías disciplinarias del IMSS. Debes analizar la siguiente conversación entre un trabajador y un investigador (Lic. Mendoza del área jurídica).

Evalúa los siguientes aspectos y responde ÚNICAMENTE con un objeto JSON (sin texto adicional):

{
  "puntajeCalma": 0-100,
  "puntajeFirmeza": 0-100,
  "erroresTacticos": ["descripción del error 1", "descripción del error 2"],
  "fortalezas": ["aspecto positivo 1", "aspecto positivo 2"],
  "articulosRelevantes": ["Cláusula/Artículo que debió invocar", "otro artículo"],
  "resumen": "párrafo breve con recomendación general"
}

CRITERIOS DE EVALUACIÓN:
- puntajeCalma: ¿Mantuvo el trabajador la compostura? ¿Se alteró, respondió agresivamente o se puso nervioso?
- puntajeFirmeza: ¿Respondió con claridad y seguridad? ¿Se contradijo o dio respuestas vagas?
- erroresTacticos: ¿Dijo algo que podría usarse en su contra? ¿Habló de más? ¿Se autoincriminó? ¿No supo citar normatividad aplicable?
- fortalezas: ¿Mantuvo silencio cuando debía? ¿Respondió con precisión? ¿Citó cláusulas?
- articulosRelevantes: ¿Qué artículos del CCT o Reglamento debió haber invocado el trabajador para defenderse adecuadamente según el contexto de la investigación?
- resumen: Evaluación general y recomendación pedagógica para mejorar en futuras investigaciones.

Sé objetivo y constructivo. El objetivo es ayudar al trabajador a prepararse mejor.`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Aquí está la transcripción de la investigación:\n\n${conversationText}` },
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
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
      puntajeCalma: 50,
      puntajeFirmeza: 50,
      erroresTacticos: ["No se pudieron analizar los errores tácticos."],
      fortalezas: ["No se pudieron identificar fortalezas."],
      articulosRelevantes: ["Revisa el CCT aplicable a tu caso."],
      resumen: "No se pudo completar el análisis automático. Revisa la normatividad aplicable con tu representante sindical.",
    })
  }
}
