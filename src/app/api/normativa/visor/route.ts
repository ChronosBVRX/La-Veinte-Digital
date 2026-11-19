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

  // Tabulador de sueldos (Base y general)
  "tabulador-de-sueldos": "Tabulador de sueldos.pdf",
  tabulador: "Tabulador de sueldos.pdf",
  "tabulador-base": "Tabulador de sueldos.pdf",
  "imss-tabulador-base-2025-2026": "Tabulador de sueldos.pdf",
  "imss-tabulador-base": "Tabulador de sueldos.pdf",
  "imss-tabulador": "Tabulador de sueldos.pdf",
  "tabulador-2025-2026": "Tabulador de sueldos.pdf",

  // Profesiogramas y Catálogo de Puestos
  profesiogramas: "Profesiogramas.pdf",
  "imss-profesiogramas": "Profesiogramas.pdf",
  catalogo: "Catalogo.pdf",
  "catalogo-de-puestos": "Catalogo.pdf",
  "imss-catalogo": "Catalogo.pdf",
  "imss-catalogo-de-puestos": "Catalogo.pdf",

  // Jubilaciones y Pensiones
  rjp: "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  "regimen-de-jubilaciones-y-pensiones": "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  jubilaciones: "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  "cct-jubilaciones": "RÉGIMEN DE JUBILACIONES Y PENSIONES.pdf",
  "convenio-jubilaciones": "CONVENIO ADICIONAL PARA LAS JUBILACIONES Y PENSIONES DE LOS TRABAJADORES DE BASE DE NUEVO INGRESO.pdf",
  "cct-convenio-jubilaciones": "CONVENIO ADICIONAL PARA LAS JUBILACIONES Y PENSIONES DE LOS TRABAJADORES DE BASE DE NUEVO INGRESO.pdf",

  // Reglamento Interior de Trabajo
  rit: "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "reglamento-interior-de-trabajo": "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "reglamento-interior": "REGLAMENTO INTERIOR DE TRABAJO.pdf",
  "cct-rit": "REGLAMENTO INTERIOR DE TRABAJO.pdf",

  // 25 Reglamentos Bilaterales CCT del acervo local
  "cct-bolsa": "REGLAMENTO DE BOLSA DE TRABAJO.pdf",
  "reglamento-bolsa-trabajo": "REGLAMENTO DE BOLSA DE TRABAJO.pdf",
  "cct-bolsa-bienestar": "REGLAMENTO DE BOLSA DE TRABAJO PARA LOS TRABAJADORES DEL PROGRAMA IMSS-BIENESTAR.pdf",
  "cct-escalafon": "REGLAMENTO DE ESCALAFÓN.pdf",
  "reglamento-escalafon": "REGLAMENTO DE ESCALAFÓN.pdf",
  "cct-becas": "REGLAMENTO DE BECAS PARA LA CAPACITACIÓN DE LOS TRABAJADORES DEL SEGURO SOCIAL.pdf",
  "imss-reglamento-becas": "REGLAMENTO DE BECAS PARA LA CAPACITACIÓN DE LOS TRABAJADORES DEL SEGURO SOCIAL.pdf",
  "cct-capacitacion": "REGLAMENTO DE CAPACITACIÓN Y ADIESTRAMIENTO.pdf",
  "cct-conductores": "REGLAMENTO DE CONDUCTORES DE VEHÍCULOS AL SERVICIO DEL INSTITUTO MEXICANO DEL SEGURO SOCIAL.pdf",
  "cct-guarderias": "REGLAMENTO DE GUARDERIAS PARA HIJOS DE TRABAJADORES DEL IMSS.pdf",
  "cct-infectocontagiosidad": "REGLAMENTO DE INFECTOCONTAGIOSIDAD Y EMANACIONES RADIACTIVAS.pdf",
  "cct-plantillas": "REGLAMENTO DE LA COMISIÓN NACIONAL MIXTA DE REVISIÓN DE PLANTILLAS.pdf",
  "cct-seguridad-higiene": "REGLAMENTO DE LA COMISIÓN NACIONAL MIXTA DE SEGURIDAD E HIGIENE.pdf",
  "cct-proteccion-salario": "REGLAMENTO DE LA COMISIÓN NACIONAL PARITARIA DE PROTECCIÓN AL SALARIO.pdf",
  "cct-medicos-residentes": "REGLAMENTO DE MÉDICOS RESIDENTES EN PERÍODO DE ADIESTRAMIENTO EN UNA ESPECIALIDAD.pdf",
  "cct-prestamos-habitacion": "REGLAMENTO DE PRÉSTAMOS PARA EL FOMENTO DE LA HABITACIÓN DE LOS TRABAJADORES.pdf",
  "cct-resguardo-patrimonial": "REGLAMENTO DE RESGUARDO PATRIMONIAL.pdf",
  "cct-ropa-trabajo": "REGLAMENTO DE ROPA DE TRABAJO Y UNIFORMES.pdf",
  "cct-uniformes": "REGLAMENTO DE ROPA DE TRABAJO Y UNIFORMES.pdf",
  "cct-cambio-rama": "REGLAMENTO DE SELECCION DE RECURSOS HUMANOS PARA CAMBIO DE RAMA.pdf",
  "cct-tiendas": "REGLAMENTO DE TIENDAS PARA EMPLEADOS DEL IMSS.pdf",
  "cct-viaticos": "REGLAMENTO DE VIÁTICOS PARA CHÓFERES.pdf",
  "cct-fondo-retiro": "REGLAMENTO DEL FONDO DE RETIRO PARA TRABAJADORES DEL INSTITUTO MEXICANO DEL SEGURO SOCIAL.pdf",
  "cct-pasajes": "REGLAMENTO PARA EL PAGO DE PASAJES.pdf",
  "cct-alimentos": "REGLAMENTO PARA EL SUMINISTRO DE ALIMENTOS A PERSONAL DE LAS UNIDADES MEDICO-HOSPITALARIAS.pdf",
  "imss-confianza-b": "REGLAMENTO PARA LA CALIFICACIÓN Y SELECCIÓN DE PUESTOS DE CONFIANZA B.pdf",
  "cct-bienestar": "REGLAMENTO PARA LOS TRABAJADORES DEL PROGRAMA IMSS-BIENESTAR.pdf",
  "cct-plazas-n34": "REGLAMENTO QUE FIJA LAS BASES PARA LA CREACIÓN Y TRANSFORMACIÓN DE LAS PLAZAS N34, MÉDICO GENERAL, EN PLAZAS DE CATEGORÍA AUTONÓMA DE MÉDICO GENERAL.pdf",
  "cct-deportes": "Reglamento de Actividades Deportivas.pdf",
}

const OFFICIAL_MIRROR_MAP: Record<string, string> = {
  riimss: "https://www.ordenjuridico.gob.mx/Documentos/Federal/wo68744.pdf",
  "imss-riimss": "https://www.ordenjuridico.gob.mx/Documentos/Federal/wo68744.pdf",
  "imss-codigo-conducta": "https://dof.gob.mx/nota_detalle.php?codigo=5744158&fecha=06%2F11%2F2024",
  "codigo-conducta": "https://dof.gob.mx/nota_detalle.php?codigo=5744158&fecha=06%2F11%2F2024",
  "ley-silla-2025": "https://dof.gob.mx/nota_detalle.php?codigo=5763187&fecha=17%2F07%2F2025",
  "disposiciones-bipedestacion-2025": "https://dof.gob.mx/nota_detalle.php?codigo=5763187&fecha=17%2F07%2F2025",
  "imss-confianza-a": "https://reposipot.imss.gob.mx/mando/UP/CNMEMPRH/AANM/Estatuto/Estatuto%20Personas%20Trabajadoras%20IMSS.pdf",
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
    for (const [key, filename] of Object.entries(BOT_API_EXACT_MAP)) {
      const cleanKey = key.replace(/[^a-z0-9]/g, "")
      if (cleanKey === cleanId && cleanKey.length >= 4) {
        const p = path.join(dir, filename)
        if (fs.existsSync(p)) return p
      }
    }

    const files = fs.readdirSync(dir)
    const targets = [id, cleanId, ...aliases]
      .filter(Boolean)
      .map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, ""))

    for (const f of files) {
      const fClean = f.toLowerCase().replace(/[^a-z0-9]/g, "")
      for (const t of targets) {
        if (t.length >= 4 && (fClean === t || fClean.startsWith(t) || t.startsWith(fClean))) {
          // Prevenir falso positivo de sufijo discriminador A vs B
          if (/(?:[-_\s]|^)a(?:[-_\s]|$)/.test(lowId) && /(?:[-_\s]|^)b(?:\.|\s|$)/.test(f.toLowerCase())) continue
          if (/(?:[-_\s]|^)b(?:[-_\s]|$)/.test(lowId) && /(?:[-_\s]|^)a(?:\.|\s|$)/.test(f.toLowerCase())) continue
          return path.join(dir, f)
        }
      }
    }

    // 2. Coincidencia por palabras clave / tokens significativos (mínimo 2 tokens para evitar colisiones)
    const tokens = id
      .toLowerCase()
      .split(/[-_\s]+/)
      .filter((w) => w.length >= 4 && !["imss", "sntss", "cct", "para", "los", "las", "del", "con"].includes(w))

    if (tokens.length >= 2) {
      for (const f of files) {
        const fLow = f.toLowerCase()
        const matchCount = tokens.filter((t) => fLow.includes(t)).length
        if (matchCount >= 2) {
          if (/(?:[-_\s]|^)a(?:[-_\s]|$)/.test(lowId) && /(?:[-_\s]|^)b(?:\.|\s|$)/.test(fLow)) continue
          if (/(?:[-_\s]|^)b(?:[-_\s]|$)/.test(lowId) && /(?:[-_\s]|^)a(?:\.|\s|$)/.test(fLow)) continue
          return path.join(dir, f)
        }
      }
    }
  } catch {}
  return null
}

function isIncapsulaChallenge(buf: Buffer): boolean {
  if (buf.length < 50) return false
  const sample = buf.subarray(0, 1024).toString("utf8")
  return (
    (sample.includes("ROBOTS") && sample.includes("NOINDEX") && sample.includes("<iframe id=")) ||
    sample.includes("_Incapsula_Resource") ||
    sample.includes("Just a moment...")
  )
}

function normalizeHtmlBuffer(buf: Buffer, upstreamContentType: string, targetUrl: string): Buffer {
  let charset = "utf-8"
  const ctMatch = upstreamContentType.match(/charset=([a-zA-Z0-9_-]+)/i)
  if (ctMatch) {
    charset = ctMatch[1].toLowerCase()
  } else {
    const headSample = buf.subarray(0, 2048).toString("ascii")
    const metaMatch = headSample.match(/charset=["']?([a-zA-Z0-9_-]+)/i)
    if (metaMatch) charset = metaMatch[1].toLowerCase()
  }

  const encoding = charset === "iso-8859-1" || charset === "latin1" ? "windows-1252" : charset
  let htmlString = ""
  try {
    const decoder = new TextDecoder(encoding)
    htmlString = decoder.decode(buf)
  } catch {
    htmlString = buf.toString("utf8")
  }

  let baseHref = targetUrl
  try {
    const parsedUrl = new URL(targetUrl)
    const pathname = parsedUrl.pathname
    const lastSlash = pathname.lastIndexOf("/")
    parsedUrl.pathname = lastSlash >= 0 ? pathname.substring(0, lastSlash + 1) : "/"
    parsedUrl.search = ""
    parsedUrl.hash = ""
    baseHref = parsedUrl.toString()
  } catch {}

  if (baseHref && !/<base\s/i.test(htmlString)) {
    if (/<head>/i.test(htmlString)) {
      htmlString = htmlString.replace(/<head>/i, `<head>\n<base href="${baseHref}">`)
    } else if (/<head\s[^>]*>/i.test(htmlString)) {
      htmlString = htmlString.replace(/(<head\s[^>]*>)/i, `$1\n<base href="${baseHref}">`)
    } else if (/<html>/i.test(htmlString)) {
      htmlString = htmlString.replace(/<html>/i, `<html><head><base href="${baseHref}"></head>`)
    }
  }

  if (!/name=["']viewport["']/i.test(htmlString) && /<head[^>]*>/i.test(htmlString)) {
    htmlString = htmlString.replace(/(<head[^>]*>)/i, `$1\n<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
  }

  return Buffer.from(htmlString, "utf8")
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
  const lowId = id.trim().toLowerCase()
  const cleanId = lowId.replace(/[^a-z0-9]/g, "")
  const p = PREAMBULOS_NORMATIVOS.find(
    (item) =>
      item.documentId.toLowerCase() === lowId ||
      item.documentId.toLowerCase() === cleanId ||
      (item.claveOficial && item.claveOficial.toLowerCase().includes(lowId)) ||
      item.aliasIds?.some((a) => a.toLowerCase() === lowId || a.toLowerCase() === cleanId)
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
    if (isPdf || !isIncapsulaChallenge(cleanBuf)) {
      const headers: Record<string, string> = {
        "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${safeId}.${isPdf ? "pdf" : "html"}"`,
        "Cache-Control": "public, max-age=86400",
        "X-Normativa-Format": isPdf ? "pdf" : "html",
        "X-Normativa-Source": "cache-local",
      }
      return new NextResponse(new Uint8Array(cleanBuf), { headers })
    }
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

  // 5. Descarga y proxy de la URL oficial gubernamental (PREAMBULOS_NORMATIVOS + bootstrap-sources.yaml + Reposipot + Mirror Oficial)
  let targetUrl = OFFICIAL_MIRROR_MAP[cleanId] || OFFICIAL_MIRROR_MAP[lowId] || p?.urlOficial
  if (!targetUrl) {
    try {
      const manifestPath = path.join(process.cwd(), "resources", "normativa", "bootstrap-sources.yaml")
      if (fs.existsSync(manifestPath)) {
        const yaml = await import("yaml")
        const manifest = yaml.parse(fs.readFileSync(manifestPath, "utf8")) as {
          sources: Array<{ id: string; url?: string; mirror?: string; landingPage?: string }>
        }
        const found = manifest.sources.find(
          (s) => s.id.toLowerCase() === cleanId || s.id.toLowerCase() === id.toLowerCase()
        )
        targetUrl = found?.url || found?.mirror || found?.landingPage
      }
    } catch {}
  }

  // Si es una clave de procedimiento IMSS estándar (ej. 2610-003-017)
  if (!targetUrl && /^[0-9A-Za-z]{4}-[0-9A-Za-z]{3}-[0-9A-Za-z]{3}/.test(id)) {
    targetUrl = `https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/${id}.pdf`
  }

  // Normalizar URLs oficiales (ej. dof.gob.mx sin www para evitar rechazo TLS)
  if (targetUrl) {
    targetUrl = targetUrl.replace(/^https?:\/\/www\.dof\.gob\.mx\//i, "https://dof.gob.mx/")
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

        // Validar que no sea un bloqueo de firewall Incapsula / anti-bot
        if (!isPdf && isIncapsulaChallenge(cleanBuf)) {
          console.warn(`[Visor API] Servidor oficial devolvió desafío anti-bot Incapsula en vez de documento para ${id}`)
          const altMirror = OFFICIAL_MIRROR_MAP[cleanId] || OFFICIAL_MIRROR_MAP[lowId]
          if (altMirror && altMirror !== targetUrl) {
            const altUpstream = await fetch(altMirror, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "application/pdf,*/*",
              },
              signal: AbortSignal.timeout(15000),
            })
            if (altUpstream.ok) {
              const altArrayBuf = await altUpstream.arrayBuffer()
              const altBuf = Buffer.from(altArrayBuf)
              const altSanitized = sanitizePdfBuffer(altBuf)
              if (altSanitized.isPdf || !isIncapsulaChallenge(altSanitized.cleanBuf)) {
                const finalAltBuf = altSanitized.isPdf
                  ? altSanitized.cleanBuf
                  : normalizeHtmlBuffer(altSanitized.cleanBuf, altUpstream.headers.get("content-type") || "", altMirror)
                try {
                  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
                  fs.writeFileSync(cachedFilePath, finalAltBuf)
                } catch {}
                const headers: Record<string, string> = {
                  "Content-Type": altSanitized.isPdf ? "application/pdf" : "text/html; charset=utf-8",
                  "Content-Disposition": `inline; filename="${safeId}.${altSanitized.isPdf ? "pdf" : "html"}"`,
                  "Cache-Control": "public, max-age=86400",
                  "X-Normativa-Format": altSanitized.isPdf ? "pdf" : "html",
                  "X-Normativa-Source": "repositorio-oficial-mirror",
                  "X-Normativa-Target-Url": altMirror,
                }
                return new NextResponse(new Uint8Array(finalAltBuf), { headers })
              }
            }
          }
        } else {
          const finalBuf = isPdf
            ? cleanBuf
            : normalizeHtmlBuffer(cleanBuf, upstream.headers.get("content-type") || "", targetUrl)
          try {
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
            fs.writeFileSync(cachedFilePath, finalBuf)
          } catch {}

          const headers: Record<string, string> = {
            "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="${safeId}.${isPdf ? "pdf" : "html"}"`,
            "Cache-Control": "public, max-age=86400",
            "X-Normativa-Format": isPdf ? "pdf" : "html",
            "X-Normativa-Source": "repositorio-oficial-proxy",
            "X-Normativa-Target-Url": targetUrl,
          }
          return new NextResponse(new Uint8Array(finalBuf), { headers })
        }
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
