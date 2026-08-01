import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildCalculatorPrefill } from "@/features/nomina/services/build-calculator-prefill"
import { parseCalculatorPrefillQuery } from "@/features/nomina/lib/calculator-prefill-query"

/**
 * GET /api/calculator-prefill?calculator=<id>&targetDate=<YYYY-MM-DD>
 *
 * Endpoint interno de SOLO LECTURA para el prerrelleno normativo de las
 * calculadoras. No acepta userId desde el cliente: el usuario se obtiene de
 * la sesión. Nunca actualiza datos ni llama a APIs externas.
 *
 * El parámetro `date` se acepta únicamente como legado temporal (ver
 * docs/CALCULATOR_PREFILL.md); el cliente nuevo debe usar `targetDate`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = parseCalculatorPrefillQuery(
    searchParams.get("calculator"),
    searchParams.get("date"),
    searchParams.get("targetDate"),
  )
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    const response = await buildCalculatorPrefill({
      calculatorId: parsed.value.calculatorId,
      userId: user.id,
      targetDate: parsed.value.targetDate,
    })

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[calculator-prefill]", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "No fue posible generar el prerrelleno" },
      { status: 500 },
    )
  }
}
