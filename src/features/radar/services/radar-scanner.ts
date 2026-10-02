import type { RadarTopic, RadarSourceType } from "../types"
import { scoreTopicWithAI } from "./radar-scoring"
import { createHash } from "node:crypto"

interface RawCandidate {
  title: string
  url: string
  source: string
  sourceType: RadarSourceType
  snippet: string
  publishedAt: string
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Parser ligero sin dependencias externas para feeds RSS / Atom.
 */
export function parseRssItems(xmlText: string, defaultSource = "Google News"): RawCandidate[] {
  const items: RawCandidate[] = []
  const itemMatches = xmlText.match(/<item[\s>][\s\S]*?<\/item>/gi) || []

  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title[\s>]([\s\S]*?)<\/title>/i)
    const linkMatch = itemXml.match(/<link[\s>]([\s\S]*?)<\/link>/i)
    const descMatch = itemXml.match(/<description[\s>]([\s\S]*?)<\/description>/i)
    const dateMatch = itemXml.match(/<pubDate[\s>]([\s\S]*?)<\/pubDate>/i)
    const sourceMatch = itemXml.match(/<source[\s>]([\s\S]*?)<\/source>/i)

    const rawTitle = titleMatch ? titleMatch[1] : ""
    const rawLink = linkMatch ? linkMatch[1] : ""
    const rawDesc = descMatch ? descMatch[1] : ""
    const rawDate = dateMatch ? dateMatch[1] : ""
    const rawSource = sourceMatch ? sourceMatch[1] : defaultSource

    const title = cleanHtmlText(rawTitle)
    const url = cleanHtmlText(rawLink)
    const snippet = cleanHtmlText(rawDesc)
    const source = cleanHtmlText(rawSource) || defaultSource

    if (title && url) {
      items.push({
        title,
        url,
        source,
        sourceType: "GOOGLE_NEWS",
        snippet,
        publishedAt: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
      })
    }
  }

  return items
}

/**
 * Consulta Google News RSS para términos clave del sindicato y del IMSS.
 */
async function fetchGoogleNewsFeed(query: string): Promise<RawCandidate[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=MX&ceid=MX:es-419`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(7000),
    })

    if (!res.ok) return []
    const xml = await res.text()
    return parseRssItems(xml, "Google News")
  } catch (err) {
    console.warn(`[radar-scanner] Error fetching Google News query "${query}":`, err)
    return []
  }
}

/**
 * Consulta Reddit (endpoints públicos de búsqueda .json).
 */
async function fetchRedditCandidates(query: string, subreddit = "lacamiseta"): Promise<RawCandidate[]> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=5`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LaVeinteDigitalBot/1.0 (Labor Topic Radar)",
      },
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) return []
    const json = await res.json()
    const children = json?.data?.children || []
    const candidates: RawCandidate[] = []

    for (const item of children) {
      const d = item.data
      if (!d?.title) continue

      const title = cleanHtmlText(d.title)
      const snippet = cleanHtmlText(d.selftext || "")
      const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url
      const publishedAt = d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString()

      candidates.push({
        title,
        url: permalink,
        source: `Reddit r/${subreddit}`,
        sourceType: "REDDIT",
        snippet,
        publishedAt,
      })
    }

    return candidates
  } catch (err) {
    console.warn(`[radar-scanner] Error fetching Reddit r/${subreddit}:`, err)
    return []
  }
}

/**
 * Genera un ID determinista a partir de la URL o el título.
 */
export function generateTopicId(url: string, title: string): string {
  const base = url || title
  return "top_" + createHash("sha256").update(base).digest("hex").slice(0, 16)
}

/**
 * Ejecuta el escaneo de radar completo en todas las fuentes configuradas.
 */
export async function runRadarScan(): Promise<RadarTopic[]> {
  const queries = [
    "SNTSS IMSS trabajadores",
    "IMSS aumento salarial quincena",
    "Contrato Colectivo IMSS 2026",
    "Concepto 050 IMSS tarjeton",
  ]

  const rawCandidates: RawCandidate[] = []

  // 1. Ejecutar consultas a Google News
  for (const q of queries) {
    const items = await fetchGoogleNewsFeed(q)
    rawCandidates.push(...items)
  }

  // 2. Ejecutar consultas a Reddit
  const redditItems = await fetchRedditCandidates("IMSS")
  rawCandidates.push(...redditItems)

  // 3. Deduplicar candidatos crudos por URL / Título
  const seen = new Set<string>()
  const uniqueCandidates: RawCandidate[] = []

  for (const c of rawCandidates) {
    const key = (c.url || c.title).toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      uniqueCandidates.push(c)
    }
  }

  // 4. Evaluar y puntuar cada candidato con IA / Heurística
  const scoredTopics: RadarTopic[] = []
  const nowIso = new Date().toISOString()

  for (const cand of uniqueCandidates.slice(0, 15)) {
    const scoring = await scoreTopicWithAI(cand.title, cand.snippet)
    const topicId = generateTopicId(cand.url, cand.title)

    scoredTopics.push({
      id: topicId,
      title: cand.title,
      url: cand.url,
      source: cand.source,
      sourceType: cand.sourceType,
      snippet: cand.snippet,
      publishedAt: cand.publishedAt,
      detectedAt: nowIso,
      category: scoring.category,
      relevanceScore: scoring.relevanceScore,
      isRealInterest: scoring.isRealInterest,
      keyTopic: scoring.keyTopic,
      justification: scoring.justification,
      relatedClause: scoring.relatedClause,
      status: "PENDING",
    })
  }

  // Ordenar por relevancia descendente
  scoredTopics.sort((a, b) => b.relevanceScore - a.relevanceScore)

  return scoredTopics
}
