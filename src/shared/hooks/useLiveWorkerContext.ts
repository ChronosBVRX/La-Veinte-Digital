"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

/**
 * Hook canónico para consumir el WorkerContext vivo e inmune al Router Cache de Next.js.
 *
 * PROTOCOLO DE SINCRONIZACIÓN:
 * 1. Inicializa inmediatamente con `initialContext` para permitir SSR e hidratación sin parpadeos.
 * 2. Inmediatamente al montar en el cliente, consulta `GET /api/worker-context` con `cache: "no-store"`
 *    para detectar si Next.js entregó un RSC prefetched viejo o si el contexto cambió.
 * 3. Si la revisión canónica (`contextRevision`), el tarjetón activo (`activePayslipId`) o la
 *    matrícula difieren de lo que se muestra actualmente, sustituye el contexto atómicamente.
 * 4. Escucha el evento global `nomina_payslip_updated` (misma ventana).
 * 5. Escucha `BroadcastChannel("la20-worker-context")` para sincronización en tiempo real entre pestañas.
 */
export function useLiveWorkerContext(initialContext?: WorkerContext | null): WorkerContext | null {
  const [context, setContext] = useState<WorkerContext | null>(initialContext ?? null)
  const isMountedRef = useRef(true)

  const [prevInitial, setPrevInitial] = useState(initialContext)
  if (initialContext !== prevInitial) {
    setPrevInitial(initialContext)
    const prevId = context?.meta?.activePayslipId ?? null
    const incomingId = initialContext?.meta?.activePayslipId ?? null
    const prevRevision = context?.meta?.contextRevision ?? null
    const incomingRevision = initialContext?.meta?.contextRevision ?? null
    const prevMatricula = context?.profile?.matricula ?? null
    const incomingMatricula = initialContext?.profile?.matricula ?? null
    const prevPeriod = context?.payroll?.latestPeriod ?? null
    const incomingPeriod = initialContext?.payroll?.latestPeriod ?? null

    const hasMeta = Boolean(incomingId || prevId || incomingRevision || prevRevision)
    const isStaleRevision = Boolean(prevRevision && incomingRevision && incomingRevision < prevRevision)

    if (!isStaleRevision) {
      const hasChanged = hasMeta
        ? (incomingId !== prevId ||
           incomingRevision !== prevRevision ||
           incomingMatricula !== prevMatricula ||
           incomingPeriod !== prevPeriod)
        : initialContext !== context

      if (hasChanged) {
        setContext(initialContext ?? null)
      }
    }
  }

  const syncContextFromServer = useCallback(() => {
    const endpoint =
      typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
        ? `${window.location.origin}/api/worker-context`
        : "/api/worker-context"

    fetch(endpoint, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })
      .then((res) => {
        if (!res.ok || !isMountedRef.current) return null
        return res.json() as Promise<WorkerContext>
      })
      .then((freshContext) => {
        if (!freshContext || !isMountedRef.current) return
        setContext((prev) => {
          if (!prev) return freshContext

          const prevId = prev.meta?.activePayslipId ?? null
          const freshId = freshContext.meta?.activePayslipId ?? null

          const prevRevision = prev.meta?.contextRevision ?? null
          const freshRevision = freshContext.meta?.contextRevision ?? null

          const prevMatricula = prev.profile?.matricula ?? null
          const freshMatricula = freshContext.profile?.matricula ?? null

          const prevPeriod = prev.payroll?.latestPeriod ?? null
          const freshPeriod = freshContext.payroll?.latestPeriod ?? null

          const hasChanged =
            prevId !== freshId ||
            prevRevision !== freshRevision ||
            prevMatricula !== freshMatricula ||
            prevPeriod !== freshPeriod

          return hasChanged ? freshContext : prev
        })
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useLiveWorkerContext] Error al consultar /api/worker-context:", err)
        }
      })
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    // 1. Inmediatamente al montar en cliente: consultar el estado real en servidor
    syncContextFromServer()

    // 2. Escuchar evento en la misma ventana
    const handlePayslipUpdated = () => {
      syncContextFromServer()
    }
    window.addEventListener("nomina_payslip_updated", handlePayslipUpdated)

    // 3. Escuchar BroadcastChannel entre pestañas
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel("la20-worker-context")
      bc.onmessage = (event) => {
        if (event.data?.type === "nomina_payslip_updated") {
          syncContextFromServer()
        }
      }
    } catch {
      // Ignorar si el entorno o WebView no implementa BroadcastChannel
    }

    return () => {
      isMountedRef.current = false
      window.removeEventListener("nomina_payslip_updated", handlePayslipUpdated)
      if (bc) {
        bc.close()
      }
    }
  }, [syncContextFromServer])

  return context
}
