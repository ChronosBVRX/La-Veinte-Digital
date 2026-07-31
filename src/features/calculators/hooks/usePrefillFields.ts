"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CalculatorPrefillFields, CalculatorPrefillResponse } from "@/shared/contracts/calculator-prefill"
import { formatCurrency } from "../lib/money"

/**
 * Protección de campos editados + aplicación del prerrelleno.
 *
 * Distingue campo vacío, prerrellenado, modificado manualmente y restaurado:
 *  1. El prerrelleno solo se aplica si el campo está vacío.
 *  2. Un campo modificado nunca se sobrescribe.
 *  3. Una respuesta tardía no reemplaza lo escrito (usa marca "dirty").
 *  4. restore() vuelve a aplicar los valores sugeridos (botón dedicado).
 *  5. Limpiar conserva el comportamiento actual y NO vuelve a prerrellenar
 *     automáticamente (el prerrelleno solo se aplica una vez por respuesta).
 */

type FieldMap<T extends Record<string, string>> = Partial<Record<keyof T, keyof CalculatorPrefillFields>>

export function formatSuggestedValue(value: number | string): string {
  return typeof value === "number" ? formatCurrency(value) : value
}

export interface UsePrefillFieldsOptions<T extends Record<string, string>> {
  fields: T
  setField: (key: keyof T, value: string) => void
  fieldMap: FieldMap<T>
  data: CalculatorPrefillResponse | null
  /** Formateador por campo; por defecto formatea números como moneda. */
  formatValue?: (contractKey: keyof CalculatorPrefillFields, value: string | number) => string
}

export interface UsePrefillFieldsResult<T extends Record<string, string>> {
  /** Marca el campo como modificado por el usuario. */
  markDirty: (key: keyof T) => void
  /** Resetea las marcas (usar al limpiar). */
  clearDirty: () => void
  /** Re-aplica los valores sugeridos a todos los campos (botón Restaurar). */
  restore: () => void
  dirty: Partial<Record<keyof T, boolean>>
  hasSuggestions: boolean
}

export function usePrefillFields<T extends Record<string, string>>(
  options: UsePrefillFieldsOptions<T>,
): UsePrefillFieldsResult<T> {
  const { fields, setField, fieldMap, data, formatValue } = options

  const [dirty, setDirty] = useState<Partial<Record<keyof T, boolean>>>({})
  const dirtyRef = useRef<Partial<Record<keyof T, boolean>>>({})
  const appliedRef = useRef<string | null>(null)
  const fieldsRef = useRef(fields)

  useEffect(() => {
    fieldsRef.current = fields
  })

  const markDirty = useCallback((key: keyof T) => {
    dirtyRef.current[key] = true
    setDirty({ ...dirtyRef.current })
  }, [])

  const clearDirty = useCallback(() => {
    dirtyRef.current = {}
    setDirty({})
  }, [])

  const collectSuggestions = useCallback(
    (overwrite: boolean): Partial<Record<keyof T, string>> => {
      const updates: Partial<Record<keyof T, string>> = {}
      const current = fieldsRef.current
      if (!data) return updates

      for (const key of Object.keys(current) as (keyof T)[]) {
        const contractKey = fieldMap[key]
        if (!contractKey) continue
        const suggested = data.fields[contractKey]
        if (!suggested) continue
        if (!overwrite && (dirtyRef.current[key] || current[key].trim() !== "")) continue
        updates[key] = (formatValue
          ? formatValue(contractKey, suggested.value)
          : formatSuggestedValue(suggested.value)) as T[keyof T]
      }
      return updates
    },
    [data, fieldMap, formatValue],
  )

  useEffect(() => {
    if (!data) return
    if (appliedRef.current === data.generatedAt) return
    appliedRef.current = data.generatedAt

    const updates = collectSuggestions(false)
    for (const key of Object.keys(updates) as (keyof T)[]) {
      setField(key, updates[key]!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const restore = useCallback(() => {
    if (!data) return
    appliedRef.current = data.generatedAt
    dirtyRef.current = {}
    setDirty({})
    const updates = collectSuggestions(true)
    for (const key of Object.keys(updates) as (keyof T)[]) {
      setField(key, updates[key]!)
    }
  }, [data, collectSuggestions, setField])

  const hasSuggestions =
    data !== null && Object.values(data.fields).some((f) => f !== undefined)

  return { markDirty, clearDirty, restore, dirty, hasSuggestions }
}
