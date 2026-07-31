"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CalculatorId, CalculatorPrefillResponse } from "@/shared/contracts/calculator-prefill"
import { fetchCalculatorPrefill } from "../services/calculator-prefill-client"

/**
 * Hook de consumo del prerrelleno.
 *
 * Solo obtiene datos de la API; no administra fórmulas ni calcula conceptos.
 * Si la API falla devuelve data=null y la calculadora sigue siendo usable.
 */
export interface UseCalculatorPrefillResult {
  data: CalculatorPrefillResponse | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCalculatorPrefill(
  calculatorId: CalculatorId,
  targetDate: string,
): UseCalculatorPrefillResult {
  const [data, setData] = useState<CalculatorPrefillResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const seqRef = useRef(0)

  useEffect(() => {
    const seq = ++seqRef.current
    let cancelled = false

    fetchCalculatorPrefill(calculatorId, targetDate).then((result) => {
      if (cancelled || seq !== seqRef.current) return
      setData(result)
      setError(result ? null : "No fue posible obtener valores sugeridos. Puedes capturar los campos manualmente.")
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [calculatorId, targetDate, attempt])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setAttempt((a) => a + 1)
  }, [])

  return { data, loading, error, reload }
}
