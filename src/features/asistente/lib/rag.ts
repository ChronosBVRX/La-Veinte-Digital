import data from "@/lib/services/vectorstore-data.json"

export const MIN_COSINE_SIMILARITY = 0.25
export const MAX_RETRIEVED_CHUNKS = 8

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function extractNumbers(text: string, pattern: RegExp): number[] {
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

/**
 * Recupera los fragmentos más relevantes del vectorstore con un umbral
 * mínimo de similitud: preguntas sin relación con los documentos devuelven
 * lista vacía (el asistente responde que no encontró la información, en
 * lugar de alimentar al LLM con contexto irrelevante).
 */
export function retrieveTopChunks(queryEmbedding: number[], query: string, k = MAX_RETRIEVED_CHUNKS): string[] {
  const queryArts = extractNumbers(query, /art[iíïi]culo\s*(\d+)/gi)
  const queryClaus = extractNumbers(query, /cl[aá]usula\s*(\d+)/gi)
  const q = query.toLowerCase()

  const scored = data.embeddings.map((emb, i) => {
    const cosine = cosineSimilarity(queryEmbedding, emb)
    let score = cosine
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

    return { score, cosine, idx: i }
  })
  scored.sort((a, b) => b.score - a.score)

  const selected: string[] = []
  for (const s of scored) {
    if (!Number.isFinite(s.cosine) || s.cosine < MIN_COSINE_SIMILARITY) break
    if (selected.length >= k) break
    selected.push(data.chunks[s.idx])
  }

  return selected
}
