import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return privateJsonError(400, "Falta el parámetro id", crypto.randomUUID(), "bad_request")
  }

  const catalog = new NormativeCatalog(process.cwd())
  const doc = catalog.getDocument(id)
  if (!doc) {
    return privateJsonError(404, "Documento no encontrado", crypto.randomUUID(), "not_found")
  }
  const versions = catalog.listVersions(id)
  const current = doc.currentVersion ? catalog.getVersion(doc.currentVersion) : null

  let citations: Array<Record<string, unknown>> | null = null
  if (url.searchParams.get("citations") === "1" && current) {
    citations = catalog.db.getCitations(current.id, 300)
  }

  return privateJson({
    document: doc,
    versions,
    currentVersion: current,
    citations,
  })
}
