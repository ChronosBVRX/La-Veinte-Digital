import { NextRequest } from "next/server"
import { generateICS } from "@/features/calendario/services/calendarioData"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mesParam = searchParams.get("mes")
  const monthIndex = mesParam !== null ? parseInt(mesParam) : undefined

  const content = generateICS(2026, monthIndex)

  const filename = monthIndex !== undefined
    ? `calendario-imss-2026-${String(monthIndex + 1).padStart(2, "0")}.ics`
    : "calendario-imss-2026.ics"

  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
