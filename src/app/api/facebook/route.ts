import { NextRequest, NextResponse } from "next/server"

const FB_APP_ID = process.env.FACEBOOK_APP_ID ?? ""
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? ""
const FB_PAGE_NAME = "SNTSSSeccionXXMichoacan"

interface FBPost {
  id: string
  text: string | null
  time: string
  image: string | null
  video: string | null
  likes: number | null
  comments: number | null
  shares: number | null
  url: string | null
}

async function getAppToken(): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&grant_type=client_credentials`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error("No se pudo obtener token de Facebook")
  const data = await res.json()
  return data.access_token
}

async function getPageId(pageName: string, token: string): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageName}?fields=id&access_token=${token}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`Página "${pageName}" no encontrada`)
  const data = await res.json()
  return data.id
}

async function getPosts(pageName: string, count: number): Promise<FBPost[]> {
  const token = await getAppToken()
  const pageId = await getPageId(pageName, token)

  const fields = "message,created_time,full_picture,attachments{media_type,media,url},shares"
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/posts?fields=${fields}&limit=${count}&access_token=${token}`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!res.ok) throw new Error("Error al obtener posts")
  const data = await res.json()

  const posts: FBPost[] = (data.data ?? []).map((p: Record<string, unknown>) => {
    const msg = typeof p.message === "string" ? p.message : null
    const time = typeof p.created_time === "string" ? p.created_time : new Date().toISOString()
    const img = typeof p.full_picture === "string" ? p.full_picture : null

    let video: string | null = null
    const atts = p.attachments as { data?: { media_type?: string; media?: { source?: string }; url?: string }[] } | undefined
    if (atts?.data) {
      const vid = atts.data.find((a) => a.media_type === "video" || a.media_type === "video_inline")
      if (vid?.media?.source) video = vid.media.source
    }

    const shares = typeof p.shares === "object" && p.shares !== null
      ? (p.shares as { count?: number }).count ?? null
      : null

    return {
      id: String(p.id ?? ""),
      text: msg,
      time,
      image: img,
      video,
      likes: null,
      comments: null,
      shares,
      url: `https://www.facebook.com/${pageName}/posts/${String(p.id ?? "").split("_")[1] ?? ""}`,
    }
  })

  if (posts.length > 0) {
    const batch = posts.slice(0, 4).map((p) => ({
      method: "GET",
      relative_url: `${p.id}?fields=likes.summary(true),comments.summary(true)&access_token=${token}`,
    }))
    try {
      const batchRes = await fetch(`https://graph.facebook.com/v19.0/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch, access_token: token }),
        signal: AbortSignal.timeout(10000),
      })
      if (batchRes.ok) {
        const batchData = await batchRes.json() as { body?: string; code?: number }[]
        batchData.forEach((r, idx) => {
          if (r.code === 200 && r.body) {
            try {
              const d = JSON.parse(r.body) as { likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } } }
              if (d.likes?.summary?.total_count != null) posts[idx].likes = d.likes.summary.total_count
              if (d.comments?.summary?.total_count != null) posts[idx].comments = d.comments.summary.total_count
            } catch {}
          }
        })
      }
    } catch {}
  }

  return posts
}

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || FB_PAGE_NAME
  const pages = parseInt(request.nextUrl.searchParams.get("pages") || "3", 10)

  if (!FB_APP_ID || !FB_APP_SECRET) {
    return NextResponse.json(
      { error: "Facebook API no configurada. Agrega FACEBOOK_APP_ID y FACEBOOK_APP_SECRET a .env.local", posts: [] },
      { status: 503 }
    )
  }

  try {
    const posts = await getPosts(page, pages)
    return NextResponse.json({ posts })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al obtener posts de Facebook", posts: [] },
      { status: 502 }
    )
  }
}
