import { NextResponse } from "next/server"
import { fetchPublishedBarItems } from "@/features/announcements/services/mobile-bar-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/announcements/bar
 *
 * Endpoint público de solo lectura para obtener los avisos, tips y herramientas
 * activos en la barra informativa móvil.
 * Si no hay avisos remotos o falla la BD, retorna { items: [] } de modo que
 * el cliente mantenga con total seguridad el catálogo local estático.
 */
export async function GET() {
  try {
    const items = await fetchPublishedBarItems()
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
