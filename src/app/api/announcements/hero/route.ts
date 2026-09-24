import { NextResponse } from "next/server"
import { fetchPublishedHeroAnnouncements } from "@/features/announcements/services/home-hero-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/announcements/hero
 *
 * Endpoint público de solo lectura para obtener los avisos, novedades y herramientas
 * configurados para el banner destacado / carrusel del Inicio.
 * Si no hay avisos remotos o falla la BD, retorna { items: [] } de modo que
 * el cliente mantenga con total seguridad los destacados locales del sistema.
 */
export async function GET() {
  try {
    const items = await fetchPublishedHeroAnnouncements()
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
