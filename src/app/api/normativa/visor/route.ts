import fs from "node:fs"
import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJsonError } from "@/shared/lib/api-response"
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
  const page = Number(url.searchParams.get("page") ?? "1")

  const catalog = new NormativeCatalog(process.cwd())
  const location = catalog.openOriginalAtPage(id, Number.isFinite(page) && page > 0 ? page : 1)
  if (!location) {
    return privateJsonError(404, "Archivo original no disponible", crypto.randomUUID(), "not_found")
  }

  const buf = fs.readFileSync(location.filePath)
  const isPdf = location.filePath.endsWith(".pdf")
  const headers: Record<string, string> = {
    "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
    "Content-Disposition": `inline; filename="${id}-original.${isPdf ? "pdf" : "html"}"`,
    "Cache-Control": "private, max-age=3600",
    "X-Normativa-Page": String(location.page),
    "X-Normativa-Source": "copia local utilizada por la Biblioteca Normativa",
  }
  return new NextResponse(new Uint8Array(buf), { headers })
}
