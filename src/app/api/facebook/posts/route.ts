import { NextRequest, NextResponse } from "next/server"
import { fetchFacebookPosts } from "@/features/facebook/services/facebook-posts-service"
import type { FacebookPageKey } from "@/features/facebook/types"

export const dynamic = "force-dynamic"

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
