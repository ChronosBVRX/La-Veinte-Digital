import type { PodcastEpisode, PodcastShow } from "../types"

export const DEFAULT_PODCAST_RSS = "https://anchor.fm/s/118056a04/podcast/rss"
export const SPOTIFY_SHOW_URL = "https://podcasters.spotify.com/pod/show/eduardo-bolaos-vzquez5"

function extractCdata(text: string | undefined): string {
  if (!text) return ""
  const match = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (match ? match[1] : text).trim()
}

function stripHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatDate(pubDateString: string): string {
  if (!pubDateString) return ""
  try {
    const date = new Date(pubDateString)
    if (isNaN(date.getTime())) return pubDateString
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date)
  } catch {
    return pubDateString
  }
}

function formatDuration(rawDuration: string): string {
  if (!rawDuration) return ""
  // If it's already in 00:09:04 or 09:04
  if (rawDuration.includes(":")) {
    const parts = rawDuration.split(":")
    if (parts.length === 3 && parts[0] === "00") {
      return `${parts[1]}:${parts[2]}`
    }
    return rawDuration
  }
  // If it's in seconds
  const secs = parseInt(rawDuration, 10)
  if (!isNaN(secs)) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }
  return rawDuration
}

export function parsePodcastRss(xmlText: string, feedUrl = DEFAULT_PODCAST_RSS): PodcastShow {
  const channelMatch = xmlText.match(/<channel>([\s\S]*?)<\/channel>/i)
  if (!channelMatch) {
    throw new Error("El documento XML no contiene un elemento <channel> válido.")
  }

  const cXml = channelMatch[1]

  const rawTitle = (cXml.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]
  const title = extractCdata(rawTitle) || "La Veinte Radio"

  const rawDesc = (cXml.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]
  const description = stripHtml(extractCdata(rawDesc))

  const imageMatch = cXml.match(/<itunes:image[^>]+href=["'](.*?)["']/i) || cXml.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i)
  const imageUrl = imageMatch ? (imageMatch[1] || "").trim() : ""

  const linkMatch = cXml.match(/<link>([\s\S]*?)<\/link>/i)
  const link = linkMatch ? extractCdata(linkMatch[1]) : SPOTIFY_SHOW_URL

  const authorMatch = cXml.match(/<itunes:author>([\s\S]*?)<\/itunes:author>/i)
  const author = authorMatch ? extractCdata(authorMatch[1]) : "Eduardo Bolaños Vázquez"

  const episodes: PodcastEpisode[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null

  while ((m = itemRegex.exec(cXml)) !== null) {
    const iXml = m[1]

    const iRawTitle = (iXml.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]
    const iTitle = extractCdata(iRawTitle)

    const iRawDesc = (iXml.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]
    const iDesc = extractCdata(iRawDesc)
    const cleanDescription = stripHtml(iDesc)

    const pubDateMatch = (iXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]
    const pubDate = pubDateMatch ? extractCdata(pubDateMatch) : ""
    const formattedDate = formatDate(pubDate)

    const audioMatch = iXml.match(/<enclosure[^>]+url=["'](.*?)["']/i)
    const audioUrl = audioMatch ? audioMatch[1].trim() : ""

    const durMatch = (iXml.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i) || [])[1]
    const duration = formatDuration(durMatch ? extractCdata(durMatch) : "")

    const guidMatch = (iXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]
    const id = guidMatch ? extractCdata(guidMatch) : audioUrl || `ep-${episodes.length + 1}`

    const epLinkMatch = (iXml.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]
    const epLink = epLinkMatch ? extractCdata(epLinkMatch) : undefined

    const epImageMatch = iXml.match(/<itunes:image[^>]+href=["'](.*?)["']/i)
    const epImage = epImageMatch ? epImageMatch[1].trim() : undefined

    if (audioUrl) {
      episodes.push({
        id,
        title: iTitle || `Episodio ${episodes.length + 1}`,
        description: iDesc,
        cleanDescription,
        pubDate,
        formattedDate,
        audioUrl,
        duration,
        link: epLink,
        imageUrl: epImage || imageUrl,
      })
    }
  }

  return {
    title,
    description,
    link: link || SPOTIFY_SHOW_URL,
    imageUrl,
    author,
    feedUrl,
    episodes,
  }
}

export async function fetchPodcastFeed(feedUrl = DEFAULT_PODCAST_RSS): Promise<PodcastShow> {
  const res = await fetch(feedUrl, {
    next: { revalidate: 1800 },
  })

  if (!res.ok) {
    throw new Error(`Error al consultar RSS del podcast: HTTP ${res.status}`)
  }

  const xmlText = await res.text()
  return parsePodcastRss(xmlText, feedUrl)
}
