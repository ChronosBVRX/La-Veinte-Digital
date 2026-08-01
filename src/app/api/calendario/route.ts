import { NextRequest, NextResponse } from "next/server"
import { generateICS, hasCalendar, isValidMonthIndex } from "@/features/calendario/services/calendarioData"
import { institutionalToday } from "@/shared/lib/dates"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mesParam = searchParams.get("mes")
  const yearParam = searchParams.get("anio")

  const year = yearParam !== null ? Number(yearParam) : institutionalToday().getFullYear()

  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    return NextResponse.json({ error: "El parámetro 'anio' debe ser un año numérico válido." }, { status: 400 })
  }

  let monthIndex: number | undefined
  if (mesParam !== null) {
    monthIndex = Number(mesParam)
    if (!Number.isInteger(monthIndex) || !isValidMonthIndex(monthIndex)) {
      return NextResponse.json({ error: "El parámetro 'mes' debe ser un número entre 0 y 11." }, { status: 400 })
    }
  }

  if (!hasCalendar(year)) {
    return NextResponse.json(
      { error: `No hay calendario publicado para el año ${year}.` },
      { status: 404 }
    )
  }

  const content = generateICS(year, monthIndex)
  if (!content.trim()) {
    return NextResponse.json({ error: "El calendario solicitado está vacío." }, { status: 404 })
  }

  const filename = monthIndex !== undefined
    ? `calendario-imss-${year}-${String(monthIndex + 1).padStart(2, "0")}.ics`
    : `calendario-imss-${year}.ics`

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
