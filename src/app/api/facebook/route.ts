import { NextRequest, NextResponse } from "next/server"

const FB_PAGE = "SNTSSSeccionXXMichoacan"

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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function extractText(html: string, startAfter: RegExp, endBefore: RegExp): string | null {
  const afterMatch = html.match(startAfter)
  if (!afterMatch) return null
  const after = html.slice(afterMatch.index! + afterMatch[0].length)
  const beforeMatch = after.match(endBefore)
  const raw = beforeMatch ? after.slice(0, beforeMatch.index!) : after.slice(0, 500)
  const cleaned = raw.replace(/<[^>]+>/g, "").trim()
  return cleaned.length > 0 ? decodeHtmlEntities(cleaned) : null
}

function scrapePosts(html: string): FBPost[] {
  const posts: FBPost[] = []

  const postRegex = /data-sigil="feed-entry[^"]*"[^>]*>([\s\S]*?)(?=data-sigil="feed-entry|<\/div>\s*<\/div>\s*<\/div>\s*$)/gi
  let match: RegExpExecArray | null

  while ((match = postRegex.exec(html)) !== null) {
    const block = match[1]
    if (block.length < 50) continue

    const idMatch = block.match(/data-ft=\{[^}]*"story_fbid":"(\d+)"/i)
      || block.match(/id="u_0_\w+_(\d+)"/i)
      || block.match(/href="[^"]*\/(\d{10,})\/"/i)
    const id = idMatch ? idMatch[1] : `post-${posts.length}-${Date.now()}`

    let text: string | null = null
    const msgMatch = block.match(/data-ad-preview="message"[^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<div[^>]*class="[^"]*story_message[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<span[^>]*data-content="[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    if (msgMatch) {
      text = decodeHtmlEntities(msgMatch[1].replace(/<[^>]+>/g, "").trim())
      if (text.length < 3) text = null
    }

    let image: string | null = null
    const imgMatch = block.match(/background-image:\s*url\("([^"]+)"\)/i)
      || block.match(/src="(https?:\/\/[^"]*(?:fbcdn|z-m-scontent)[^"]*\.(?:jpg|png|webp)[^"]*)"/i)
    if (imgMatch) image = imgMatch[1]

    let video: string | null = null
    const vidMatch = block.match(/src="(https?:\/\/[^"]*(?:fbcdn|z-m-scontent)[^"]*\.mp4[^"]*)"/i)
      || block.match(/data-store="{[^}]*video_url[^}]*}"(\s|$)/i)
    if (vidMatch) video = vidMatch[1] || null

    const timeMatch = block.match(/data-absolute-date="(\d+)"/i)
      || block.match(/<abbr[^>]*data-utime="(\d+)"/i)
    let timeStr = new Date().toISOString()
    if (timeMatch) {
      const ts = parseInt(timeMatch[1], 10)
      if (!isNaN(ts)) timeStr = ts > 1e12 ? new Date(ts).toISOString() : new Date(ts * 1000).toISOString()
    }

    let likes: number | null = null
    const likesMatch = block.match(/(\d[\d.,]*[kK]?)\s*people reacted/i)
      || block.match(/(\d[\d.,]*[kK]?)\s*(?:likes?|me gusta)/i)
    if (likesMatch) likes = parseCount(likesMatch[1])

    let comments: number | null = null
    const commentsMatch = block.match(/(\d[\d.,]*[kK]?)\s*(?:comments?|comentarios?)/i)
    if (commentsMatch) comments = parseCount(commentsMatch[1])

    let shares: number | null = null
    const sharesMatch = block.match(/(\d[\d.,]*[kK]?)\s*(?:shares?|compartidos?)/i)
    if (sharesMatch) shares = parseCount(sharesMatch[1])

    let url: string | null = null
    const urlMatch = block.match(/href="(\/story\.php[^"]*|\/[^"]*\/posts\/[^"]*|https?:\/\/(?:www\.)?facebook\.com\/[^"]*\/posts\/[^"]*)"/i)
    if (urlMatch) {
      url = urlMatch[1].startsWith("http") ? urlMatch[1] : `https://m.facebook.com${urlMatch[1]}`
    }

    if (text || image || video) {
      posts.push({ id, text, time: timeStr, image, video, likes, comments, shares, url })
    }
  }

  return posts
}

function parseCount(s: string): number | null {
  const clean = s.replace(/,/g, "").trim()
  if (/[kK]/.test(clean)) return Math.round(parseFloat(clean) * 1000)
  const n = parseInt(clean, 10)
  return isNaN(n) ? null : n
}

async function fetchFacebookPage(pageName: string): Promise<string> {
  const urls = [
    `https://m.facebook.com/${pageName}/posts/`,
    `https://m.facebook.com/${pageName}`,
    `https://www.facebook.com/${pageName}/posts/`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })

      if (res.ok) {
        const html = await res.text()
        if (html.includes("story_message") || html.includes("data-sigil") || html.includes("story-body")) {
          return html
        }
      }
    } catch {}
  }

  throw new Error("No se pudo obtener la página de Facebook")
}

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || FB_PAGE
  const pages = parseInt(request.nextUrl.searchParams.get("pages") || "3", 10)

  try {
    const html = await fetchFacebookPage(page)
    const posts = scrapePosts(html)
    return NextResponse.json({ posts: posts.slice(0, pages) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al obtener posts de Facebook", posts: [] },
      { status: 502 }
    )
  }
}
