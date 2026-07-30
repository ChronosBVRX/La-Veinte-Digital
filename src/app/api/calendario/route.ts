import { NextRequest } from "next/server"
import { generateICS } from "@/features/calendario/services/calendarioData"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mesParam = searchParams.get("mes")
  const yearParam = searchParams.get("anio")
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const monthIndex = mesParam !== null ? parseInt(mesParam) : undefined

  const content = generateICS(year, monthIndex)

  const filename = monthIndex !== undefined
    ? `calendario-imss-${year}-${String(monthIndex + 1).padStart(2, "0")}.ics`
    : `calendario-imss-${year}.ics`

  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
