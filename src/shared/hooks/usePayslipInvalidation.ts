"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export interface UsePayslipInvalidationOptions {
  /**
   * Si es true, invoca router.refresh() al recibir `nomina_payslip_updated`.
   * @default false
   */
  refreshRouter?: boolean
  /**
   * Callback cliente a ejecutar cuando el tarjetón cambie.
   */
  onInvalidate?: () => void
  /**
   * Ventana de debounce en milisegundos para evitar múltiples refresh simultáneos.
   * @default 150
   */
  debounceMs?: number
}

/**
 * Hook canónico de invalidación y reactividad tras actualizar/confirmar un tarjetón.
 *
 * Escucha el evento global `nomina_payslip_updated` emitido cuando un tarjetón
 * se confirma en el servidor o se sincroniza localmente.
 *
 * Permite ejecutar un callback cliente y/o invocar `router.refresh()` para que
 * los Server Components de Next.js App Router vuelvan a consultar su fuente canónica.
 */
export function usePayslipInvalidation(options: UsePayslipInvalidationOptions = {}) {
  const { refreshRouter = false, onInvalidate, debounceMs = 150 } = options
  let router: ReturnType<typeof useRouter> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    router = null
  }
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onInvalidateRef = useRef(onInvalidate)

  useEffect(() => {
    onInvalidateRef.current = onInvalidate
  }, [onInvalidate])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleEvent = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        if (onInvalidateRef.current) {
          onInvalidateRef.current()
        }
        if (refreshRouter && router) {
          router.refresh()
        }
      }, debounceMs)
    }

    window.addEventListener("nomina_payslip_updated", handleEvent)
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      window.removeEventListener("nomina_payslip_updated", handleEvent)
    }
  }, [router, refreshRouter, debounceMs])
}
