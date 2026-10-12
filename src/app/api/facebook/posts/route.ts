import { NextRequest, NextResponse } from "next/server"
import {
  fetchFacebookPosts,
  syncLatestFacebookPostsViaHttp,
} from "@/features/facebook/services/facebook-posts-service"
import type { FacebookPageKey } from "@/features/facebook/types"

export const dynamic = "force-dynamic"

let lastBackgroundSyncTime = 0
const BACKGROUND_SYNC_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutos entre verificaciones automáticas

/**
 * Dispara una sincronización en segundo plano sin bloquear la respuesta al usuario,
 * cuando el feed está vacío o la publicación más reciente tiene más de 6 horas.
 */
function maybeTriggerBackgroundRefresh(lastPublishedAt?: string | null): void {
  const now = Date.now()
  if (now - lastBackgroundSyncTime < BACKGROUND_SYNC_COOLDOWN_MS) {
    return
  }

  let needsSync = false
  if (!lastPublishedAt) {
    needsSync = true
  } else {
    const postTime = new Date(lastPublishedAt).getTime()
    const ageHours = (now - postTime) / (1000 * 60 * 60)
    if (ageHours > 6) {
      needsSync = true
    }
  }

  if (needsSync) {
    lastBackgroundSyncTime = now
    // Fire-and-forget en background sin bloquear la respuesta al cliente
    Promise.resolve().then(async () => {
      try {
        await syncLatestFacebookPostsViaHttp(["seccionxx"])
      } catch {
        // Silenciar fallos secundarios en background
      }
    })
  }
}

/**
 * GET /api/facebook/posts?page=all|seccionxx|cen&limit=20
 *
 * Endpoint de solo lectura para obtener las publicaciones públicas del SNTSS
 * sincronizadas en Supabase. Si no hay datos o falla la red, devuelve { items: [] }.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageKey: FacebookPageKey = "seccionxx"

    const rawLimit = Number(searchParams.get("limit") ?? "20")
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 40) : 20

    const items = await fetchFacebookPosts({ pageKey, limit })

    // Auto-recuperación pasiva: si no hay posts o son antiguos, programar refresco silencioso
    maybeTriggerBackgroundRefresh(items[0]?.publishedAt)

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    )
  } catch {
    return NextResponse.json(
      { items: [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  }
}
