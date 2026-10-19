import fs from "node:fs"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { PREAMBULOS_NORMATIVOS } from "@/features/normativa/data/preambulos-normativos"

export const runtime = "nodejs"

function findInBotApiPdfs(repoRoot: string, id: string, aliases: string[]): string | null {
  const dir = path.join(repoRoot, "bot-api", "pdfs")
  if (!fs.existsSync(dir)) return null
  try {
    const files = fs.readdirSync(dir)
    const targets = [id, ...aliases]
      .filter(Boolean)
      .map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, ""))
    for (const f of files) {
      const fClean = f.toLowerCase().replace(/[^a-z0-9]/g, "")
      for (const t of targets) {
        if (t.length >= 3 && (fClean.includes(t) || t.includes(fClean))) {
          return path.join(dir, f)
        }
      }
    }
  } catch {}
  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return privateJsonError(400, "Falta el parámetro id", crypto.randomUUID(), "bad_request")
  }
  const page = Number(url.searchParams.get("page") ?? "1")

  // 1. Acervo local via NormativeCatalog
  const catalog = new NormativeCatalog(process.cwd())
  const location = catalog.openOriginalAtPage(id, Number.isFinite(page) && page > 0 ? page : 1)
  if (location && fs.existsSync(location.filePath)) {
    const buf = fs.readFileSync(location.filePath)
    const isPdf = location.filePath.endsWith(".pdf")
    const headers: Record<string, string> = {
      "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${id}-original.${isPdf ? "pdf" : "html"}"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Page": String(location.page),
      "X-Normativa-Source": "copia local utilizada por la Biblioteca Normativa",
    }
    return new NextResponse(new Uint8Array(buf), { headers })
  }

  // 2. Cache local en tmp/normativa-cache
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
  const cacheDir = path.join(process.cwd(), "tmp", "normativa-cache")
  const cachedFilePath = path.join(cacheDir, `${safeId}.pdf`)
  if (fs.existsSync(cachedFilePath)) {
    const buf = fs.readFileSync(cachedFilePath)
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeId}.pdf"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Source": "cache-local",
    }
    return new NextResponse(new Uint8Array(buf), { headers })
  }

  // 3. Documento en bot-api/pdfs si existe coincidencia
  const cleanId = id.trim().toLowerCase()
  const p = PREAMBULOS_NORMATIVOS.find(
    (item) =>
      item.documentId.toLowerCase() === cleanId ||
      (item.claveOficial && item.claveOficial.toLowerCase().includes(cleanId)) ||
      item.aliasIds?.some((a) => a.toLowerCase() === cleanId)
  )

  const botMatch = findInBotApiPdfs(process.cwd(), id, p?.aliasIds ?? [])
  if (botMatch && fs.existsSync(botMatch)) {
    const buf = fs.readFileSync(botMatch)
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${path.basename(botMatch)}"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Source": "bot-api-acervo",
    }
    return new NextResponse(new Uint8Array(buf), { headers })
  }

  // 4. Descarga y proxy de la URL oficial gubernamental
  const targetUrl = p?.urlOficial
  if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/pdf,*/*",
        },
        signal: AbortSignal.timeout(15000),
      })

      if (upstream.ok) {
        const arrayBuf = await upstream.arrayBuffer()
        const buf = Buffer.from(arrayBuf)
        try {
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
          fs.writeFileSync(cachedFilePath, buf)
        } catch {}

        const headers: Record<string, string> = {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${safeId}.pdf"`,
          "Cache-Control": "public, max-age=86400",
          "X-Normativa-Source": "repositorio-oficial-proxy",
        }
        return new NextResponse(new Uint8Array(buf), { headers })
      }
    } catch (err) {
      console.warn(`[Visor API] Error haciendo fetch a ${targetUrl}:`, err)
    }

    // Redirección directa al repositorio oficial si el proxy no pudo descargar los bytes
    return NextResponse.redirect(targetUrl, 302)
  }

  return privateJsonError(404, "Archivo original no disponible en acervo local ni remoto", crypto.randomUUID(), "not_found")
}

