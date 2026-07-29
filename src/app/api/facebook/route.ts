import { NextRequest, NextResponse } from "next/server"

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL ?? ""
const FACEBOOK_PAGE = "SNTSSSeccionXXMichoacan"

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || FACEBOOK_PAGE
  const pages = request.nextUrl.searchParams.get("pages") || "3"

  if (!BOT_API_URL) {
    return NextResponse.json(
      { error: "Bot API no configurada", posts: [] },
      { status: 503 }
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      `${BOT_API_URL}/facebook?page=${encodeURIComponent(page)}&pages=${pages}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error del bot-api: ${res.status}`, posts: [] },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error de conexion", posts: [] },
      { status: 502 }
    )
  }
}