import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { buildCoverage } from "@/features/normativa/services/coverage"
import { buildDeterministicAnswer, resolveProvider } from "@/features/normativa/services/llm-provider"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { query?: string; provider?: string }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (!query) {
    return privateJsonError(400, "Consulta vacía", crypto.randomUUID(), "bad_request")
  }

  const catalog = new NormativeCatalog(process.cwd())
  const hits = catalog.searchNormativeCorpus(query, { limit: 24 })
  const coverage = buildCoverage(catalog, query)

  const hitsForAnswer = hits.map((h) => ({
    documentId: h.documentId,
    documentTitle: h.documentTitle,
    type: catalog.getDocument(h.documentId)?.type,
    snippet: h.snippet,
    text: h.text,
    pdfPageIndex: h.pdfPageIndex,
    clause: h.clause,
    article: h.article,
    validity: h.validity,
  }))

  const deterministic = buildDeterministicAnswer({ question: query, hits: hitsForAnswer })

  let respuesta = deterministic
  let provider: string | null = null

  const llm = resolveProvider(body.provider)
  if (llm) {
    provider = llm.name
    try {
      const polished = await llm.complete({
        system: `Eres un investigador normativo del IMSS/SNTSS. No uses memoria general para completar reglas que no aparezcan en las fuentes. Distingue texto documental de explicación. No inventes cláusulas, artículos, páginas, fechas, cantidades ni procedimientos. Devuelve la respuesta en español, con encabezados breves (Respuesta breve / Qué dice el CCT / Qué establece el procedimiento institucional / Qué dicen las leyes / Qué debes revisar en tu caso), citando las fuentes proporcionadas. Si una fuente no permite sostener una afirmación, responde NEEDS_MORE_EVIDENCE.`,
        user: `PREGUNTA: ${query}\n\nEVIDENCIA DOCUMENTAL (única fuente autorizada):\n${hitsForAnswer
          .map((h) => `- ${h.documentId}${h.clause ? ` ${h.clause}` : ""}${h.article ? ` Art.${h.article}` : ""}${h.pdfPageIndex != null ? ` pág.${h.pdfPageIndex}` : ""}: ${h.text.slice(0, 600)}`)
          .join("\n")}`,
      })
      if (polished.trim()) respuesta = polished.trim()
    } catch {
      /* si el LLM falla, se conserva la respuesta determinista */
    }
  }

  return privateJson({
    query,
    respuesta,
    provider,
    deterministicOnly: provider === null,
    coverage,
    hits: hitsForAnswer.map((h) => ({
      documentId: h.documentId,
      documentTitle: h.documentTitle,
      clause: h.clause,
      article: h.article,
      pdfPageIndex: h.pdfPageIndex,
      printedPage: hits.find((x) => x.documentId === h.documentId && x.pdfPageIndex === h.pdfPageIndex)?.printedPage ?? null,
    })),
  })
}
