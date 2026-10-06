import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import {
  FACEBOOK_PAGES,
  type FacebookPageKey,
  type FacebookPost,
  type ScrapedFacebookPost,
} from "../types"
import { extractPostsFromFacebookHtml } from "../lib/relay-post-extractor"
import { classifyPostWithLocalAI } from "../lib/facebook-ai-classifier"

const STORAGE_BUCKET = "facebook-media"

const BROWSER_NAV_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
}

function getServiceOrAnonClient(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
  requireServiceRole = false,
): ReturnType<typeof createSupabaseClient<Database>> | null {
  if (customClient) return customClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = requireServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) return null

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function parseMediaUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string" && item.startsWith("http"))
}

export interface FetchFacebookPostsOptions {
  pageKey?: FacebookPageKey | "all"
  limit?: number
  customClient?: ReturnType<typeof createSupabaseClient<Database>>
}

/**
 * Obtiene las publicaciones sincronizadas de Facebook desde Supabase,
 * ordenadas desde la más reciente.
 * La fuente activa es exclusivamente la Sección XX Michoacán.
 */
export async function fetchFacebookPosts(
  options: FetchFacebookPostsOptions = {},
): Promise<FacebookPost[]> {
  try {
    const client = getServiceOrAnonClient(options.customClient, false)
    if (!client) return []

    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
    const query = client
      .from("facebook_posts")
      .select("*")
      .eq("is_visible", true)
      .eq("page_key", "seccionxx")
      .order("published_at", { ascending: false })
      .limit(limit)

    const { data, error } = await query
    if (error || !data) return []

    return data.map((row) => {
      const rawMeta =
        row.raw_metadata && typeof row.raw_metadata === "object"
          ? (row.raw_metadata as Record<string, unknown>)
          : {}
      const permalink = row.permalink_url || ""
      const isVideoFromPermalink =
        permalink.includes("/videos/") ||
        permalink.includes("/reel/") ||
        permalink.includes("/watch/") ||
        permalink.includes("fb.watch")

      const videoUrl =
        typeof rawMeta.video_url === "string" && rawMeta.video_url.startsWith("http")
          ? rawMeta.video_url
          : null

      const isVideo = Boolean(rawMeta.is_video || videoUrl || isVideoFromPermalink)

      return {
        id: row.id,
        pageKey: "seccionxx" as FacebookPageKey,
        pageName: row.page_name,
        externalPostId: row.external_post_id,
        permalinkUrl: row.permalink_url,
        contentText: row.content_text,
        mediaUrls: parseMediaUrls(row.media_urls),
        videoUrl,
        isVideo,
        category: row.category ?? null,
        summary: row.summary ?? null,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        publishedAt: row.published_at,
        syncedAt: row.synced_at,
      }
    })
  } catch {
    return []
  }
}

async function mirrorImageToSupabaseStorage(
  client: ReturnType<typeof createSupabaseClient<Database>>,
  pageKey: FacebookPageKey,
  externalPostId: string,
  imageIndex: number,
  sourceUri: string,
): Promise<string | null> {
  try {
    const response = await fetch(sourceUri, {
      headers: {
        "User-Agent": BROWSER_NAV_HEADERS["User-Agent"],
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.facebook.com/",
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg"

    const safePostId = externalPostId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
    const storagePath = `${pageKey}/${safePostId}/${imageIndex}.${ext}`

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.byteLength < 500) return null

    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      })

    if (uploadError) {
      return null
    }

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    return pub?.publicUrl ?? null
  } catch {
    return null
  }
}

export interface SyncFacebookPostsResult {
  upsertedCount: number
  mirroredImagesCount: number
  byPage: Record<FacebookPageKey, number>
  errors: string[]
}

/**
 * Descarga las imágenes de cada publicación hacia el bucket `facebook-media`
 * y hace upsert de los posts en `public.facebook_posts`.
 */
export async function persistScrapedPostsToSupabase(
  posts: ScrapedFacebookPost[],
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<SyncFacebookPostsResult> {
  const result: SyncFacebookPostsResult = {
    upsertedCount: 0,
    mirroredImagesCount: 0,
    byPage: { seccionxx: 0 },
    errors: [],
  }

  const client = getServiceOrAnonClient(customClient, true)
  if (!client) {
    result.errors.push("SUPABASE_SERVICE_ROLE_KEY no configurada para persistir publicaciones.")
    return result
  }

  for (const post of posts) {
    try {
      // Verificar si el post ya tiene imágenes guardadas en Supabase Storage para no re-subirlas innecesariamente
      const { data: existingRow } = await client
        .from("facebook_posts")
        .select("media_urls")
        .eq("page_key", post.pageKey)
        .eq("external_post_id", post.externalPostId)
        .maybeSingle()

      const existingUrls = existingRow ? parseMediaUrls(existingRow.media_urls) : []
      const hasMirroredStorageUrls =
        existingUrls.length > 0 &&
        existingUrls.every((u) => u.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`))

      const finalMediaUrls: string[] = []

      if (hasMirroredStorageUrls && existingUrls.length >= post.images.length) {
        finalMediaUrls.push(...existingUrls)
      } else {
        for (let i = 0; i < post.images.length; i++) {
          const img = post.images[i]
          const storedUrl = await mirrorImageToSupabaseStorage(
            client,
            post.pageKey,
            post.externalPostId,
            i,
            img.uri,
          )
          if (storedUrl) {
            finalMediaUrls.push(storedUrl)
            result.mirroredImagesCount++
          }
        }
      }

      const classification = await classifyPostWithLocalAI(post.contentText)

      const nowIso = new Date().toISOString()
      const { error } = await client.from("facebook_posts").upsert(
        {
          page_key: post.pageKey,
          page_name: post.pageName,
          external_post_id: post.externalPostId,
          permalink_url: post.permalinkUrl,
          content_text: post.contentText,
          media_urls: finalMediaUrls,
          category: classification.category,
          summary: classification.summary,
          tags: classification.tags,
          ai_processed: classification.source === "ollama",
          published_at: post.publishedAt,
          is_visible: true,
          raw_metadata: {
            original_image_count: post.images.length,
            ai_source: classification.source,
            is_video: Boolean(post.isVideo || post.videoUrl),
            video_url: post.videoUrl ?? null,
          },
          synced_at: nowIso,
          updated_at: nowIso,
        },
        {
          onConflict: "page_key,external_post_id",
        },
      )

      if (error) {
        result.errors.push(`${post.pageKey}/${post.externalPostId}: ${error.message}`)
      } else {
        result.upsertedCount++
        result.byPage[post.pageKey]++
      }
    } catch (err) {
      result.errors.push(
        `${post.pageKey}/${post.externalPostId}: ${err instanceof Error ? err.message : "Error desconocido"}`,
      )
    }
  }

  return result
}

/**
 * Sincronización ligera vía HTTP SSR (sin navegador).
 * Descarga el HTML inicial de las páginas públicas de Facebook y extrae las
 * publicaciones recientes incluidas en los bloques Relay JSON.
 */
export async function syncLatestFacebookPostsViaHttp(
  pageKeys: FacebookPageKey[] = ["seccionxx"],
): Promise<SyncFacebookPostsResult> {
  const allScraped: ScrapedFacebookPost[] = []
  const fetchErrors: string[] = []

  for (const key of pageKeys) {
    const cfg = FACEBOOK_PAGES[key]
    try {
      const response = await fetch(cfg.url, {
        headers: BROWSER_NAV_HEADERS,
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        fetchErrors.push(`${key}: HTTP ${response.status}`)
        continue
      }
      const html = await response.text()
      const extracted = extractPostsFromFacebookHtml(key, html)
      allScraped.push(...extracted)
    } catch (err) {
      fetchErrors.push(
        `${key}: ${err instanceof Error ? err.message : "Error de red al consultar Facebook"}`,
      )
    }
  }

  const persistResult = await persistScrapedPostsToSupabase(allScraped)
  return {
    ...persistResult,
    errors: [...fetchErrors, ...persistResult.errors],
  }
}
