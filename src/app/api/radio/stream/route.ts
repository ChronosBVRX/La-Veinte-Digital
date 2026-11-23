import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Dominios permitidos para streaming seguro de podcasts de La 20 Radio (protección anti-SSRF)
const ALLOWED_HOSTS = new Set([
  "d3ctxlq1ktw2nl.cloudfront.net",
  "anchor.fm",
  "d3t3ozftmdmh3i.cloudfront.net",
])

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url")
  if (!urlParam) {
    return NextResponse.json({ error: "Parámetro url requerido" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(urlParam)
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 })
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Origen no autorizado para streaming" }, { status: 403 })
  }

  const rangeHeader = request.headers.get("range")
  const headers: Record<string, string> = {
    "User-Agent": "LaVeinteDigital/1.0 AudioProxy",
  }
  if (rangeHeader) {
    headers["Range"] = rangeHeader
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers,
      cache: "force-cache",
    })

    const status = upstream.status === 206 ? 206 : 200
    const responseHeaders = new Headers()

    responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg")
    responseHeaders.set("Accept-Ranges", "bytes")
    responseHeaders.set("Access-Control-Allow-Origin", "*")
    responseHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800")

    const contentRange = upstream.headers.get("content-range")
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange)
    }

    const contentLength = upstream.headers.get("content-length")
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength)
    }

    return new NextResponse(upstream.body, {
      status,
      headers: responseHeaders,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al conectar con el servidor de audio"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
