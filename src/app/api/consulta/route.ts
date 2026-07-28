import { NextResponse } from "next/server"
import OpenAI from "openai"
import data from "@/lib/services/vectorstore-data.json"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

interface Message {
  role: "user" | "assistant"
  content: string
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

    if (q.includes("secretario general") && chunkLower.includes("secretario general")) score += 0.2
    if (q.includes("obligaciones") && chunkLower.includes("obligaciones")) score += 0.15
    if (q.includes("derechos") && chunkLower.includes("derechos")) score += 0.15
    if (q.includes("requisitos") && chunkLower.includes("requisitos")) score += 0.15
    if (q.includes("suspensión") && chunkLower.includes("suspendidos")) score += 0.2
    if (q.includes("principios") && chunkLower.includes("principios")) score += 0.25
    if (q.includes("vacaciones") && chunkLower.includes("vacaciones")) score += 0.2
    if (q.includes("aguinaldo") && chunkLower.includes("aguinaldo")) score += 0.2
    if (q.includes("escalafón") && chunkLower.includes("escalaf")) score += 0.3

    for (const qn of queryArts) {
      if (new RegExp(`art[iíïi]culo\\s*${qn}`, "i").test(chunk)) {
        score += 0.8
      }
    }
    for (const qn of queryClaus) {
      if (new RegExp(`cl[aá]usula\\s*${qn}`, "i").test(chunk)) {
        score += 0.8
      }
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
    const body: { history: Message[] } = await req.json()
    const { history } = body

    if (!history?.length) {
      return NextResponse.json({ respuesta: "No recibí ninguna pregunta." })
    }

    const question = [...history].reverse().find((m) => m.role === "user")?.content?.trim()
    if (!question) {
      return NextResponse.json({ respuesta: "No pude encontrar tu pregunta." })
    }

    const openai = getOpenAI()
    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: question,
    })
    const queryEmbedding = embeddingResp.data[0].embedding

    const relevantChunks = topK(queryEmbedding, question, 8)
    const context = relevantChunks.join("\n\n---\n\n")

    const systemPrompt = `Eres el Asistente SNTSS, un aliado confiable y cercano para los trabajadores del IMSS afiliados al Sindicato Nacional de Trabajadores del Seguro Social. Tu personalidad es amigable, empática y profesional — hablas como un compañero que conoce bien los derechos laborales y siempre busca ayudar.

Tienes conocimiento profundo de estos documentos:
- **Contrato Colectivo de Trabajo (CCT)** del IMSS — cláusulas, derechos, obligaciones, prestaciones
- **Estatutos del SNTSS** — artículos, estructura sindical, asambleas, elecciones, comités
- Reglamentos varios (Escalafón, Interior de Trabajo, Becas, etc.)
- Catálogo, Profesiogramas, Tabulador de sueldos
- Régimen de Jubilaciones y Pensiones

Cada fragmento del contexto inicia con el nombre del documento entre corchetes, ej: [Clausulas.pdf], [estatutos-sntss-2022.pdf]

REGLAS DE COMPORTAMIENTO:
1. Responde SIEMPRE en español, con un tono conversacional y cercano, como si le hablaras a un compañero de trabajo.
2. Cuando encuentres información relevante, cítala mencionando el **documento** y la **CLÁUSULA** o **ARTÍCULO** específico.
3. Usa formato visual rico: **negritas** para conceptos clave, listas con viñetas para derechos/obligaciones, y separa ideas en párrafos cortos.
4. Si la pregunta es vaga o general, responde de forma amigable y ofrece orientar al trabajador con preguntas de seguimiento. No seas robótico.
5. Si el contexto menciona el tema aunque sea parcialmente, responde con lo que hay y aclara que es lo disponible.
6. SOLO si no hay absolutamente nada relacionado, responde de forma empática: "No encontré esa información específica en los documentos que tengo, pero puedo ayudarte con otros temas del CCT o los Estatutos. ¿Quieres intentar con otra pregunta?"
7. Cuando el trabajador hable de sus derechos, vacaciones, prestaciones o cualquier tema laboral, demuestra empatía y preocupación por su bienestar.
8. Usa emojis con moderación para dar calidez (ej: ✅, 📋, ⚖️) pero sin exagerar.
9. Nunca inventes información. Si no lo sabes, dilo con honestidad.

Ejemplo de respuesta ideal:
"¡Claro que sí! 📋 Según la **Cláusula 47 del CCT**, tienes derecho a **16 días hábiles** de vacaciones por cada año de servicio. Además, ese periodo aumenta **1 día por año adicional**, hasta un máximo de **20 días hábiles**. ¿Te gustaría saber algo más sobre tus prestaciones?"

Contexto:
${context}`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.0,
      messages,
    })

    const respuesta = completion.choices[0]?.message?.content ?? "Lo siento, no pude generar una respuesta."

    return NextResponse.json({ respuesta })
  } catch (e) {
    const error = e as Error
    return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 })
  }
}
