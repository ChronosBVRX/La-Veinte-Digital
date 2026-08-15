import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { buildCoverage } from "@/features/normativa/services/coverage"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { topic?: string; includeHistorical?: boolean; limit?: number; verifyClaims?: boolean }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  if (!topic) {
    return privateJsonError(400, "Tema vacío", crypto.randomUUID(), "bad_request")
  }

  const catalog = new NormativeCatalog(process.cwd())
  const pack = catalog.buildEvidencePack(topic, {
    includeHistorical: body.includeHistorical === true,
    limit: Math.min(Math.max(typeof body.limit === "number" ? body.limit : 30, 5), 60),
  })
  const coverage = buildCoverage(catalog, topic)

  return privateJson({
    evidencePack: pack,
    coverage,
    summary: {
      documents: pack.documents.length,
      relevantChunks: pack.relevantChunks.length,
      verifiedClaims: pack.claims.filter((c) => c.state === "VERIFIED").length,
      conflicts: pack.conflicts.length,
    },
  })
}
