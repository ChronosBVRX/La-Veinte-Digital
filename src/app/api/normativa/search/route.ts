import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { query?: string; includeHistorical?: boolean; limit?: number; category?: string }
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
  const hits = catalog.searchNormativeCorpus(query, {
    includeHistorical: body.includeHistorical === true,
    limit: Math.min(Math.max(typeof body.limit === "number" ? body.limit : 20, 1), 50),
    category: typeof body.category === "string" ? body.category : undefined,
  })

  return privateJson({ query, total: hits.length, hits })
}
