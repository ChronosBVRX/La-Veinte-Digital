import {
  FACEBOOK_PAGES,
  type FacebookPageKey,
  type ScrapedFacebookImage,
  type ScrapedFacebookPost,
} from "../types"

interface RawPostAccumulator {
  postId: string
  url: string | null
  text: string | null
  creationTime: number | null
  imagesByAssetKey: Map<string, ScrapedFacebookImage>
  videoUrl?: string | null
  isVideo?: boolean
}

/**
 * Extrae una clave estable de activo para una URL de imagen de Facebook (`scontent...`),
 * ignorando parámetros de tamaño (`stp=...`) y firmas temporales (`oh=...&oe=...`)
 * para no duplicar la misma foto en múltiples resoluciones.
 */
export function normalizeImageAssetKey(uri: string): string {
  try {
    const parsed = new URL(uri)
    const fileMatch = parsed.pathname.match(/\/([^/]+\.(?:jpg|jpeg|png|webp))$/i)
    if (fileMatch) {
      return fileMatch[1].toLowerCase()
    }
    return parsed.pathname.toLowerCase()
  } catch {
    return uri.split("?")[0]
  }
}

/**
 * Limpia una URL de publicación de Facebook eliminando parámetros de rastreo (`__cft__`, `__tn__`, `comment_id`).
 */
export function sanitizeFacebookPermalink(rawUrl: string, fallbackPageUrl: string): string {
  try {
    const parsed = new URL(rawUrl, fallbackPageUrl)
    // Si es un comentario individual, descartar como permalink principal
    if (parsed.searchParams.has("comment_id") && !parsed.pathname.includes("/posts/")) {
      return `${parsed.origin}${parsed.pathname}`
    }
    // Conservar solo story_fbid e id si es permalink.php
    if (parsed.pathname.includes("permalink.php") || parsed.pathname.includes("story.php")) {
      const clean = new URL(`${parsed.origin}${parsed.pathname}`)
      const storyFbid = parsed.searchParams.get("story_fbid")
      const id = parsed.searchParams.get("id")
      if (storyFbid) clean.searchParams.set("story_fbid", storyFbid)
      if (id) clean.searchParams.set("id", id)
      return clean.toString()
    }
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return rawUrl.split("?")[0] || fallbackPageUrl
  }
}

function walkNode(
  node: unknown,
  visitor: (obj: Record<string, unknown>) => boolean | void,
): void {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) {
      walkNode(item, visitor)
    }
    return
  }

  const record = node as Record<string, unknown>
  const shouldSkipChildren = visitor(record)
  if (shouldSkipChildren === true) return

  for (const [key, val] of Object.entries(record)) {
    // Evitar extraer historias adjuntas (compartidas) como publicaciones independientes de nivel superior
    if (key === "attached_story" && record.comet_sections) {
      continue
    }
    walkNode(val, visitor)
  }
}

function addCandidateImage(
  map: Map<string, ScrapedFacebookImage>,
  uri: string,
  width: number,
  height: number,
): void {
  if (!uri || !uri.startsWith("http")) return
  // Ignorar emojis, iconos estáticos y avatares pequeños
  if (uri.includes("static.xx.fbcdn.net") || uri.includes("/rsrc.php")) return
  if (width > 0 && height > 0 && width < 200 && height < 200) return

  const assetKey = normalizeImageAssetKey(uri)
  const existing = map.get(assetKey)
  const area = (width || 600) * (height || 600)
  const existingArea = existing ? existing.width * existing.height : -1

  if (!existing || area > existingArea) {
    map.set(assetKey, {
      uri,
      assetKey,
      width: width || 600,
      height: height || 600,
    })
  }
}

function inspectStoryObject(
  storyObj: Record<string, unknown>,
  postsById: Map<string, RawPostAccumulator>,
  pageUrl: string,
): void {
  const state: {
    postId: string | null
    url: string | null
    primaryText: string | null
    attachedText: string | null
    creationTime: number | null
    videoUrl: string | null
    isVideo: boolean
  } = {
    postId: typeof storyObj.post_id === "string" ? storyObj.post_id : null,
    url:
      typeof storyObj.wwwURL === "string"
        ? storyObj.wwwURL
        : typeof storyObj.url === "string"
          ? storyObj.url
          : null,
    primaryText: null,
    attachedText: null,
    creationTime: null,
    videoUrl: null,
    isVideo: false,
  }
  const candidateImages = new Map<string, ScrapedFacebookImage>()

  const tryExtractImage = (imgObj: unknown, defaultW = 800, defaultH = 800) => {
    if (!imgObj || typeof imgObj !== "object") return
    const rec = imgObj as Record<string, unknown>
    const uri = typeof rec.uri === "string" ? rec.uri : typeof rec.url === "string" ? rec.url : null
    if (uri && (uri.includes("scontent") || uri.startsWith("http"))) {
      const w = typeof rec.width === "number" ? rec.width : defaultW
      const h = typeof rec.height === "number" ? rec.height : defaultH
      if (w >= 180 || h >= 180 || !rec.width) {
        addCandidateImage(candidateImages, uri, w, h)
      }
    }
  }

  const scanSubtree = (root: unknown, isAttachedStory: boolean) => {
    if (!root || typeof root !== "object") return
    if (Array.isArray(root)) {
      for (const item of root) scanSubtree(item, isAttachedStory)
      return
    }
    const sub = root as Record<string, unknown>

    if (!isAttachedStory && !state.postId && typeof sub.post_id === "string") {
      state.postId = sub.post_id
    }

    if (sub.message && typeof sub.message === "object") {
      const msg = sub.message as Record<string, unknown>
      if (typeof msg.text === "string" && msg.text.trim()) {
        if (isAttachedStory) {
          if (!state.attachedText || msg.text.length > state.attachedText.length) {
            state.attachedText = msg.text.trim()
          }
        } else {
          if (!state.primaryText || msg.text.length > state.primaryText.length) {
            state.primaryText = msg.text.trim()
          }
        }
      }
    }

    if (
      !isAttachedStory &&
      !state.creationTime &&
      typeof sub.creation_time === "number" &&
      sub.creation_time > 1500000000
    ) {
      state.creationTime = sub.creation_time
    }

    const candidateUrl =
      typeof sub.wwwURL === "string"
        ? sub.wwwURL
        : typeof sub.url === "string"
          ? sub.url
          : null

    if (
      !isAttachedStory &&
      !state.url &&
      candidateUrl &&
      (candidateUrl.includes("/posts/") ||
        candidateUrl.includes("/videos/") ||
        candidateUrl.includes("/reel/") ||
        candidateUrl.includes("/watch/") ||
        candidateUrl.includes("story_fbid")) &&
      !candidateUrl.includes("comment_id=")
    ) {
      state.url = candidateUrl
    }

    if (
      candidateUrl &&
      (candidateUrl.includes("/videos/") ||
        candidateUrl.includes("/reel/") ||
        candidateUrl.includes("/watch/") ||
        candidateUrl.includes("fb.watch"))
    ) {
      state.isVideo = true
    }

    // Detectar fuentes de video directo o URLs reproducibles
    if (!state.videoUrl) {
      if (typeof sub.playable_url === "string" && sub.playable_url.startsWith("http")) {
        state.videoUrl = sub.playable_url
        state.isVideo = true
      } else if (
        typeof sub.playable_url_quality_hd === "string" &&
        sub.playable_url_quality_hd.startsWith("http")
      ) {
        state.videoUrl = sub.playable_url_quality_hd
        state.isVideo = true
      } else if (sub.video && typeof sub.video === "object") {
        const v = sub.video as Record<string, unknown>
        if (typeof v.playable_url === "string" && v.playable_url.startsWith("http")) {
          state.videoUrl = v.playable_url
          state.isVideo = true
        } else if (
          typeof v.playable_url_quality_hd === "string" &&
          v.playable_url_quality_hd.startsWith("http")
        ) {
          state.videoUrl = v.playable_url_quality_hd
          state.isVideo = true
        }
      }
    }

    if (sub.is_video === true || sub.__typename === "Video" || sub.video != null) {
      state.isVideo = true
    }

    // Extracción de imágenes estándar
    if (sub.photo_image && typeof sub.photo_image === "object") {
      tryExtractImage(sub.photo_image)
    } else if (sub.image && typeof sub.image === "object") {
      tryExtractImage(sub.image)
    }

    // Extraer también miniaturas de video / reels
    if (sub.preferred_thumbnail && typeof sub.preferred_thumbnail === "object") {
      const pt = sub.preferred_thumbnail as Record<string, unknown>
      tryExtractImage(pt.image || pt)
    }
    if (sub.thumbnailImage && typeof sub.thumbnailImage === "object") {
      tryExtractImage(sub.thumbnailImage)
    }
    if (sub.video_preview_image && typeof sub.video_preview_image === "object") {
      tryExtractImage(sub.video_preview_image)
    }
    if (sub.large_share_media && typeof sub.large_share_media === "object") {
      const lsm = sub.large_share_media as Record<string, unknown>
      tryExtractImage(lsm.image || lsm)
    }
    if (sub.video && typeof sub.video === "object") {
      const v = sub.video as Record<string, unknown>
      if (v.preferred_thumbnail) {
        const pt = v.preferred_thumbnail as Record<string, unknown>
        tryExtractImage(pt.image || pt)
      }
      if (v.thumbnailImage) tryExtractImage(v.thumbnailImage)
    }

    for (const [k, v] of Object.entries(sub)) {
      scanSubtree(v, isAttachedStory || k === "attached_story")
    }
  }

  scanSubtree(storyObj, false)

  const finalText = state.primaryText || state.attachedText || null

  if (!state.postId && state.url) {
    const match = state.url.match(/\/(?:posts|videos|reel|watch)\/([^/?#]+)/)
    if (match) state.postId = match[1]
  }

  if (state.url && !state.isVideo) {
    if (
      state.url.includes("/videos/") ||
      state.url.includes("/reel/") ||
      state.url.includes("/watch/") ||
      state.url.includes("fb.watch")
    ) {
      state.isVideo = true
    }
  }

  // Ignorar nodos vacíos o que son únicamente metadatos de reacciones
  if (!state.postId) return
  if (!finalText && candidateImages.size === 0 && !state.isVideo && !state.videoUrl) return

  const existing: RawPostAccumulator = postsById.get(state.postId) ?? {
    postId: state.postId,
    url: null,
    text: null,
    creationTime: null,
    imagesByAssetKey: new Map<string, ScrapedFacebookImage>(),
    videoUrl: null,
    isVideo: false,
  }

  if (state.url && !existing.url) {
    existing.url = sanitizeFacebookPermalink(state.url, pageUrl)
  }
  if (finalText && (!existing.text || finalText.length > existing.text.length)) {
    existing.text = finalText
  }
  if (state.creationTime && !existing.creationTime) {
    existing.creationTime = state.creationTime
  }
  if (state.videoUrl && !existing.videoUrl) {
    existing.videoUrl = state.videoUrl
  }
  if (state.isVideo) {
    existing.isVideo = true
  }
  for (const img of candidateImages.values()) {
    addCandidateImage(existing.imagesByAssetKey, img.uri, img.width, img.height)
  }

  postsById.set(state.postId, existing)
}

export function extractRawPostsFromJsonTree(
  root: unknown,
  postsById: Map<string, RawPostAccumulator>,
  pageUrl: string,
): void {
  walkNode(root, (obj) => {
    if (obj.comet_sections && typeof obj.comet_sections === "object") {
      inspectStoryObject(obj, postsById, pageUrl)
      return true
    }
  })
}

export function finalizeScrapedPosts(
  pageKey: FacebookPageKey,
  postsById: Map<string, RawPostAccumulator>,
): ScrapedFacebookPost[] {
  const pageConfig = FACEBOOK_PAGES[pageKey]
  const rawList: ScrapedFacebookPost[] = []

  for (const item of postsById.values()) {
    const contentText = (item.text ?? "").trim()
    const images = [...item.imagesByAssetKey.values()].slice(0, 6)

    const isVideo = Boolean(
      item.isVideo ||
      item.videoUrl ||
      (item.url &&
        (item.url.includes("/videos/") ||
          item.url.includes("/reel/") ||
          item.url.includes("/watch/") ||
          item.url.includes("fb.watch"))),
    )

    // Exigir que tenga texto o al menos una imagen/video Y una fecha de publicación real
    if (!contentText && images.length === 0 && !isVideo) continue
    if (!item.creationTime) continue

    const permalinkUrl = item.url
      ? sanitizeFacebookPermalink(item.url, pageConfig.url)
      : `${pageConfig.url}/posts/${item.postId}`

    rawList.push({
      pageKey,
      pageName: pageConfig.name,
      externalPostId: item.postId,
      permalinkUrl,
      contentText,
      images,
      videoUrl: item.videoUrl ?? null,
      isVideo,
      publishedAt: new Date(item.creationTime * 1000).toISOString(),
    })
  }

  return deduplicateScrapedPosts(rawList)
}

/**
 * Deduplica publicaciones por `externalPostId`, `permalinkUrl` o texto idéntico
 * (p. ej. cuando Facebook devuelve una publicación re-editada con dos post_id cercanos).
 */
export function deduplicateScrapedPosts(posts: ScrapedFacebookPost[]): ScrapedFacebookPost[] {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )

  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()
  const seenTextSignatures = new Set<string>()
  const result: ScrapedFacebookPost[] = []

  for (const post of sorted) {
    const idKey = `${post.pageKey}:${post.externalPostId}`
    const urlKey = `${post.pageKey}:${post.permalinkUrl}`
    const normalizedText = post.contentText.replace(/\s+/g, " ").trim().toLowerCase()
    const textSig =
      normalizedText.length >= 40 ? `${post.pageKey}:${normalizedText.slice(0, 160)}` : null

    if (seenIds.has(idKey) || seenUrls.has(urlKey)) continue
    if (textSig && seenTextSignatures.has(textSig)) continue

    seenIds.add(idKey)
    seenUrls.add(urlKey)
    if (textSig) seenTextSignatures.add(textSig)
    result.push(post)
  }

  return result
}

/**
 * Extrae publicaciones desde el HTML SSR de una página pública de Facebook
 * buscando bloques `<script type="application/json">`.
 */
export function extractPostsFromFacebookHtml(
  pageKey: FacebookPageKey,
  html: string,
): ScrapedFacebookPost[] {
  const pageConfig = FACEBOOK_PAGES[pageKey]
  const postsById = new Map<string, RawPostAccumulator>()

  const scriptRegex = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]
    if (!rawJson.includes("comet_sections")) continue
    try {
      const parsed = JSON.parse(rawJson)
      extractRawPostsFromJsonTree(parsed, postsById, pageConfig.url)
    } catch {
      // Ignorar bloques JSON malformados
    }
  }

  return finalizeScrapedPosts(pageKey, postsById)
}

/**
 * Extrae publicaciones acumulando tanto el HTML inicial como múltiples respuestas
 * de `/api/graphql/` (JSON Lines) capturadas durante el scroll.
 */
export function extractPostsFromHtmlAndGraphqlChunks(
  pageKey: FacebookPageKey,
  htmlChunks: string[],
  graphqlBodies: string[],
): ScrapedFacebookPost[] {
  const pageConfig = FACEBOOK_PAGES[pageKey]
  const postsById = new Map<string, RawPostAccumulator>()

  for (const html of htmlChunks) {
    const scriptRegex = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
    let match: RegExpExecArray | null
    while ((match = scriptRegex.exec(html)) !== null) {
      const rawJson = match[1]
      if (!rawJson.includes("comet_sections")) continue
      try {
        extractRawPostsFromJsonTree(JSON.parse(rawJson), postsById, pageConfig.url)
      } catch {
        // Ignorar
      }
    }
  }

  for (const body of graphqlBodies) {
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim() || !line.includes("comet_sections")) continue
      try {
        extractRawPostsFromJsonTree(JSON.parse(line), postsById, pageConfig.url)
      } catch {
        // Ignorar
      }
    }
  }

  return finalizeScrapedPosts(pageKey, postsById)
}
