import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { compareDocuments } from "@/features/normativa/services/compare"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { fromId?: string; toId?: string }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const fromId = typeof body.fromId === "string" ? body.fromId : "CCT-IMSS-SNTSS-2023-2025"
  const toId = typeof body.toId === "string" ? body.toId : "CCT-IMSS-SNTSS-2025-2027"

  const catalog = new NormativeCatalog(process.cwd())
  const report = compareDocuments(catalog.db, fromId, toId)
  if (!report) {
    return privateJsonError(404, "Ambos documentos deben estar indexados con versiones disponibles", crypto.randomUUID(), "not_found")
  }
  return privateJson({ report })
}
