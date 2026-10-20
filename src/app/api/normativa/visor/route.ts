import fs from "node:fs"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { PREAMBULOS_NORMATIVOS } from "@/features/normativa/data/preambulos-normativos"

export const runtime = "nodejs"

const BOT_API_EXACT_MAP: Record<string, string> = {
  // Leyes
  lft: "Ley Federal del Trabajo.pdf",
  "ley-federal-del-trabajo": "Ley Federal del Trabajo.pdf",
  "ley-federal-trabajo": "Ley Federal del Trabajo.pdf",
  lgs: "Ley General de Salud.pdf",
  "ley-general-de-salud": "Ley General de Salud.pdf",
  "ley-general-salud": "Ley General de Salud.pdf",

  // CCT
  cct: "Clausulas.pdf",
  clausulas: "Clausulas.pdf",
  "cct-2025-2027": "Clausulas.pdf",
  "cct-imss-sntss-2025-2027": "Clausulas.pdf",
  "contrato-colectivo": "Clausulas.pdf",
  "cct-imss": "Clausulas.pdf",

  // Estatutos y SNTSS
  estatutos: "estatutos-sntss-2022.pdf",
  "estatutos-sntss": "estatutos-sntss-2022.pdf",
  "sntss-estatutos": "estatutos-sntss-2022.pdf",
  "sntss-estatutos-2022": "estatutos-sntss-2022.pdf",
  "estatutos-sntss-2022": "estatutos-sntss-2022.pdf",
  "sntss-leyes-reglamentos": "REGLAMENTO INTERIOR DE TRABAJO.pdf",

  // Reglamentos y documentos clave
  "tabulador-de-sueldos": "Tabulador de sueldos.pdf",
  tabulador: "Tabulador de sueldos.pdf",
  "tabulador-base": "Tabulador de sueldos.pdf",
  profesiogramas: "Profesiogramas.pdf",
  catalogo: "Catalogo.pdf",
  "catalogo-de-puestos": "Catalogo.pdf",
  rjp: "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  "regimen-de-jubilaciones-y-pensiones": "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  jubilaciones: "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  rit: "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "reglamento-interior-de-trabajo": "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "reglamento-interior": "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "convenio-jubilaciones": "CONVENIO ADICIONAL PARA LAS JUBILACIONES Y PENSIONES DE LOS TRABAJADORES DE BASE DE NUEVO INGRESO.pdf",
}

function findInBotApiPdfs(repoRoot: string, id: string, aliases: string[]): string | null {
  const dir = path.join(repoRoot, "bot-api", "pdfs")
  if (!fs.existsSync(dir)) return null
  try {
    const lowId = id.toLowerCase()
    const cleanId = lowId.replace(/[^a-z0-9]/g, "")

    // 1. Mapeo exacto
    if (BOT_API_EXACT_MAP[lowId]) {
      const p = path.join(dir, BOT_API_EXACT_MAP[lowId])
      if (fs.existsSync(p)) return p
    }
    if (BOT_API_EXACT_MAP[cleanId]) {
      const p = path.join(dir, BOT_API_EXACT_MAP[cleanId])
      if (fs.existsSync(p)) return p
    }

    const files = fs.readdirSync(dir)
    const targets = [id, cleanId, ...aliases]
      .filter(Boolean)
      .map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, ""))

    for (const f of files) {
      const fClean = f.toLowerCase().replace(/[^a-z0-9]/g, "")
      for (const t of targets) {
        if (t.length >= 3 && (fClean === t || fClean.includes(t) || t.includes(fClean))) {
          return path.join(dir, f)
        }
      }
    }

    // 2. Coincidencia por palabras clave / tokens significativos
    const tokens = id
      .toLowerCase()
      .split(/[-_\s]+/)
      .filter((w) => w.length >= 4 && !["imss", "sntss", "cct", "para", "los", "las", "del", "con"].includes(w))

    if (tokens.length > 0) {
      for (const f of files) {
        const fLow = f.toLowerCase()
        const matchCount = tokens.filter((t) => fLow.includes(t)).length
        if (matchCount >= 2 || (tokens.length === 1 && matchCount === 1)) {
          return path.join(dir, f)
        }
      }
    }
  } catch {}
  return null
}

function sanitizePdfBuffer(buf: Buffer): { isPdf: boolean; cleanBuf: Buffer } {
  if (buf.length < 5) return { isPdf: false, cleanBuf: buf }
  const maxSearch = Math.min(buf.length, 1024)
  const magic = Buffer.from("%PDF")
  const idx = buf.subarray(0, maxSearch).indexOf(magic)
  if (idx !== -1) {
    return { isPdf: true, cleanBuf: idx > 0 ? buf.subarray(idx) : buf }
  }
  return { isPdf: false, cleanBuf: buf }
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
    const { isPdf, cleanBuf } = sanitizePdfBuffer(buf)
    const headers: Record<string, string> = {
      "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${id}-original.${isPdf ? "pdf" : "html"}"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Page": String(location.page),
      "X-Normativa-Format": isPdf ? "pdf" : "html",
      "X-Normativa-Source": "copia local utilizada por la Biblioteca Normativa",
    }
    return new NextResponse(new Uint8Array(cleanBuf), { headers })
  }

  // 2. Acervo directo en bot-api/pdfs (resolución local instantánea sin latencia)
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
    const { isPdf, cleanBuf } = sanitizePdfBuffer(buf)
    const headers: Record<string, string> = {
      "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${path.basename(botMatch)}"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Format": isPdf ? "pdf" : "html",
      "X-Normativa-Source": "bot-api-acervo",
    }
    return new NextResponse(new Uint8Array(cleanBuf), { headers })
  }

  // 3. Cache local en tmp/normativa-cache
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
  const cacheDir = path.join(process.cwd(), "tmp", "normativa-cache")
  const cachedFilePath = path.join(cacheDir, `${safeId}.pdf`)
  if (fs.existsSync(cachedFilePath)) {
    const buf = fs.readFileSync(cachedFilePath)
    const { isPdf, cleanBuf } = sanitizePdfBuffer(buf)
    const headers: Record<string, string> = {
      "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${safeId}.${isPdf ? "pdf" : "html"}"`,
      "Cache-Control": "public, max-age=86400",
      "X-Normativa-Format": isPdf ? "pdf" : "html",
      "X-Normativa-Source": "cache-local",
    }
    return new NextResponse(new Uint8Array(cleanBuf), { headers })
  }

  // 4. Supabase Storage (bucket público 'normativa')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.la20.com.mx"
  const candidates: string[] = []
  if (p?.urlOficial) {
    try {
      const parsed = new URL(p.urlOficial)
      const base = path.basename(parsed.pathname)
      if (base) candidates.push(base)
    } catch {}
  }
  if (location?.filePath) {
    candidates.push(path.basename(location.filePath))
  }
  candidates.push(`${id}.pdf`)
  candidates.push(`${safeId}.pdf`)
  if (p?.documentId) candidates.push(`${p.documentId}.pdf`)
  if (p?.aliasIds) {
    for (const a of p.aliasIds) candidates.push(`${a}.pdf`)
  }

  const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)))

  for (const cand of uniqueCandidates) {
    try {
      const storageUrl = `${supabaseUrl}/storage/v1/object/public/normativa/${encodeURIComponent(cand)}`
      const storageRes = await fetch(storageUrl, {
        signal: AbortSignal.timeout(6000),
      })
      if (storageRes.ok) {
        const arrayBuf = await storageRes.arrayBuffer()
        const buf = Buffer.from(arrayBuf)
        const { isPdf, cleanBuf } = sanitizePdfBuffer(buf)
        try {
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
          fs.writeFileSync(cachedFilePath, cleanBuf)
        } catch {}

        const headers: Record<string, string> = {
          "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${safeId}.${isPdf ? "pdf" : "html"}"`,
          "Cache-Control": "public, max-age=86400",
          "X-Normativa-Format": isPdf ? "pdf" : "html",
          "X-Normativa-Source": "supabase-storage-normativa",
        }
        return new NextResponse(new Uint8Array(cleanBuf), { headers })
      }
    } catch (e) {
      console.warn(`[Visor API] Error comprobando Supabase Storage para ${cand}:`, e)
    }
  }

  // 5. Descarga y proxy de la URL oficial gubernamental (PREAMBULOS_NORMATIVOS + bootstrap-sources.yaml + Reposipot)
  let targetUrl = p?.urlOficial
  if (!targetUrl) {
    try {
      const manifestPath = path.join(process.cwd(), "resources", "normativa", "bootstrap-sources.yaml")
      if (fs.existsSync(manifestPath)) {
        const yaml = await import("yaml")
        const manifest = yaml.parse(fs.readFileSync(manifestPath, "utf8")) as {
          sources: Array<{ id: string; url?: string; mirror?: string }>
        }
        const found = manifest.sources.find(
          (s) => s.id.toLowerCase() === cleanId || s.id.toLowerCase() === id.toLowerCase()
        )
        targetUrl = found?.url || found?.mirror
      }
    } catch {}
  }

  // Si es una clave de procedimiento IMSS estándar (ej. 2610-003-017)
  if (!targetUrl && /^[0-9A-Za-z]{4}-[0-9A-Za-z]{3}-[0-9A-Za-z]{3}/.test(id)) {
    targetUrl = `https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/${id}.pdf`
  }

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
        const { isPdf, cleanBuf } = sanitizePdfBuffer(buf)
        try {
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
          fs.writeFileSync(cachedFilePath, cleanBuf)
        } catch {}

        const headers: Record<string, string> = {
          "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${safeId}.${isPdf ? "pdf" : "html"}"`,
          "Cache-Control": "public, max-age=86400",
          "X-Normativa-Format": isPdf ? "pdf" : "html",
          "X-Normativa-Source": "repositorio-oficial-proxy",
        }
        return new NextResponse(new Uint8Array(cleanBuf), { headers })
      }
    } catch (err) {
      console.warn(`[Visor API] Error haciendo fetch a ${targetUrl}:`, err)
    }
  }

  return privateJsonError(
    404,
    "Archivo original no disponible en acervo local ni remoto",
    crypto.randomUUID(),
    "not_found"
  )
}
