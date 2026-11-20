import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { fetchPodcastFeed, DEFAULT_PODCAST_RSS } from "@/features/radio/services/podcast-rss"

export const runtime = "nodejs"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    const show = await fetchPodcastFeed(DEFAULT_PODCAST_RSS)
    return privateJson(show)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener episodios del podcast"
    return privateJsonError(500, message, crypto.randomUUID(), "internal_error")
  }
}
