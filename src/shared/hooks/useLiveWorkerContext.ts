"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
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
 *
 * `useWorkerContextSync` además expone `status` para distinguir "cargando" y
 * "no se pudo confirmar" de "sin tarjetón". Un fallo de red o una respuesta
 * no-ok NUNCA se interpretan como ausencia de dato.
 */

export type WorkerContextSyncStatus = "loading" | "ready" | "error"

export interface WorkerContextError {
  code: string
  message: string
  status?: number
  requestId?: string
}

export interface WorkerContextSync {
  context: WorkerContext | null
  status: WorkerContextSyncStatus
  error?: WorkerContextError | null
  retry: () => void
  isUpdating?: boolean
}

export function useWorkerContextSync(initialContext?: WorkerContext | null): WorkerContextSync {
  const [context, setContext] = useState<WorkerContext | null>(initialContext ?? null)
  const [status, setStatus] = useState<WorkerContextSyncStatus>(
    initialContext ? "ready" : "loading",
  )
  const [errorState, setErrorState] = useState<WorkerContextError | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const isMountedRef = useRef(true)
  const requestSeqRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncRef = useRef<((isManualRetry?: boolean) => void) | null>(null)

  const initialUserId = initialContext?.userId ?? initialContext?.meta?.userId ?? null
  const authUserIdRef = useRef<string | null>(initialUserId)
  const sessionSeqRef = useRef<number>(1)
  const authSessionIdRef = useRef<string>("auth-session-1")
  const contextRef = useRef<WorkerContext | null>(context)
  const pendingContextRef = useRef<WorkerContext | null>(null)

  useEffect(() => {
    contextRef.current = context
  }, [context])

  const [prevInitial, setPrevInitial] = useState(initialContext)
  if (initialContext !== prevInitial) {
    setPrevInitial(initialContext)

    const prevUserId = prevInitial?.userId ?? prevInitial?.meta?.userId ?? null
    const incomingUserId = initialContext?.userId ?? initialContext?.meta?.userId ?? null
    const isDifferentUser = Boolean(
      (prevUserId || incomingUserId) && prevUserId !== incomingUserId,
    )

    const prevId = prevInitial?.meta?.activePayslipId ?? null
    const incomingId = initialContext?.meta?.activePayslipId ?? null
    const prevRevision = prevInitial?.meta?.contextRevision ?? null
    const incomingRevision = initialContext?.meta?.contextRevision ?? null
    const prevMatricula = prevInitial?.profile?.matricula ?? null
    const incomingMatricula = initialContext?.profile?.matricula ?? null
    const prevPeriod = prevInitial?.payroll?.latestPeriod ?? null
    const incomingPeriod = initialContext?.payroll?.latestPeriod ?? null

    const prevWorker = prevMatricula ?? prevInitial?.meta?.activeEmployeeNumber ?? prevInitial?.payroll?.employeeNumber ?? null
    const incomingWorker = incomingMatricula ?? initialContext?.meta?.activeEmployeeNumber ?? initialContext?.payroll?.employeeNumber ?? null
    const isDifferentWorker = Boolean(
      (prevWorker || incomingWorker) && prevWorker !== incomingWorker,
    )

    // Al cerrar sesión o cambiar de cuenta:
    // Si cambia el usuario o el trabajador, o se pasa a null:
    // Borra el contexto anterior de inmediato antes de cualquier nueva consulta.
    if (isDifferentUser || isDifferentWorker) {
      setContext(initialContext ?? null)
      setStatus(initialContext ? "ready" : "loading")
      setErrorState(null)
    } else {
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
  }

  // Efecto para actualizar la referencia del usuario actual y abortar peticiones en vuelo del usuario previo
  const prevSyncedInitialRef = useRef(initialContext)
  useEffect(() => {
    if (initialContext === prevSyncedInitialRef.current) return
    const prev = prevSyncedInitialRef.current
    prevSyncedInitialRef.current = initialContext

    const prevUserId = prev?.userId ?? prev?.meta?.userId ?? null
    const incomingUserId = initialContext?.userId ?? initialContext?.meta?.userId ?? null
    const isDifferentUser = Boolean((prevUserId || incomingUserId) && prevUserId !== incomingUserId)

    const prevWorker = prev?.profile?.matricula ?? prev?.meta?.activeEmployeeNumber ?? prev?.payroll?.employeeNumber ?? null
    const incomingWorker = initialContext?.profile?.matricula ?? initialContext?.meta?.activeEmployeeNumber ?? initialContext?.payroll?.employeeNumber ?? null
    const isDifferentWorker = Boolean((prevWorker || incomingWorker) && prevWorker !== incomingWorker)

    if (isDifferentUser || isDifferentWorker) {
      authUserIdRef.current = incomingUserId
      sessionSeqRef.current++
      authSessionIdRef.current = `auth-${sessionSeqRef.current}-${incomingUserId ?? "anon"}`
      abortControllerRef.current?.abort()
      requestSeqRef.current++
      if (!initialContext || !incomingUserId) {
        syncRef.current?.(true)
      }
    }
  }, [initialContext])

  const syncContextFromServer = useCallback((isManualRetry = false) => {
    if (isManualRetry) {
      retryCountRef.current = 0
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const currentSeq = ++requestSeqRef.current
    const requestedUserId = authUserIdRef.current
    const requestedSessionId = authSessionIdRef.current

    console.info(
      `[useLiveWorkerContext] seq=${currentSeq} request_start requestedUser=${requestedUserId ?? "null"} sessionId=${requestedSessionId}`
    )

    queueMicrotask(() => {
      if (isMountedRef.current && currentSeq === requestSeqRef.current) {
        setIsUpdating(true)
      }
    })

    timeoutRef.current = setTimeout(() => {
      controller.abort()
    }, 10000)

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
      signal: controller.signal,
    })
      .then(async (res) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return null
        if (!res.ok) {
          let errBody: { error?: string; code?: string; requestId?: string } | null = null
          try {
            errBody = await res.json()
          } catch {
            // Cuerpo no JSON
          }
          const errCode = errBody?.code || (res.status === 401 ? "unauthorized" : res.status === 403 ? "forbidden" : "server_error")
          const errMessage = errBody?.error || (res.status === 401 ? "Tu sesión ha expirado." : `Error ${res.status} al consultar contexto laboral.`)
          const customErr = new Error(errMessage) as Error & { code: string; status: number; requestId?: string }
          customErr.code = errCode
          customErr.status = res.status
          if (errBody?.requestId) customErr.requestId = errBody.requestId
          throw customErr
        }
        return res.json() as Promise<WorkerContext>
      })
      .then((freshContext) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        if (!freshContext || !isMountedRef.current || currentSeq !== requestSeqRef.current) return

        const freshUserId = freshContext.userId ?? freshContext.meta?.userId ?? null
        const activeAuthUserId = authUserIdRef.current
        const activeSessionId = authSessionIdRef.current

        console.info(
          `[useLiveWorkerContext] seq=${currentSeq} response_received status=200 freshUser=${freshUserId ?? "null"} activeAuthUser=${activeAuthUserId ?? "null"} requestedUser=${requestedUserId ?? "null"} activeSession=${activeSessionId} requestedSession=${requestedSessionId}`
        )

        // Salvaguarda canónica:
        // Acepta un WorkerContext únicamente si su userId coincide con la cuenta
        // autenticada vigente y la petición pertenece a esa misma sesión.
        // Si falta alguno de esos identificadores o difieren:
        // NO clasifiques la cuenta como «confirmada» ni conserves un cálculo salarial anterior.
        const isSessionMatch = requestedSessionId === activeSessionId
        const isUserMatch = Boolean(
          freshUserId &&
          activeAuthUserId &&
          freshUserId === activeAuthUserId &&
          (!requestedUserId || requestedUserId === activeAuthUserId)
        )

        if (!isSessionMatch) {
          console.info(
            `[useLiveWorkerContext] seq=${currentSeq} response_discarded (stale session: req=${requestedSessionId} active=${activeSessionId})`
          )
          return
        }

        // Carrera de INITIAL_SESSION:
        // Si la petición respondió antes de que Supabase confirme la sesión (activeAuthUserId === null)
        // y la petición fue del montaje inicial (requestedUserId === null), retenemos el contexto
        // como pendiente sin emitir error destructivo. En cuanto INITIAL_SESSION confirme la identidad,
        // la tarjeta se recupera y carga el aumento de inmediato.
        if (freshUserId && !activeAuthUserId && !requestedUserId) {
          console.info(
            `[useLiveWorkerContext] seq=${currentSeq} response_pending_auth freshUser=${freshUserId} (esperando confirmación de INITIAL_SESSION)`
          )
          pendingContextRef.current = freshContext
          return
        }

        if (!isUserMatch) {
          console.warn(
            `[useLiveWorkerContext] seq=${currentSeq} response_rejected (user mismatch or missing auth identifier: fresh=${freshUserId} active=${activeAuthUserId} requested=${requestedUserId})`
          )
          pendingContextRef.current = null
          setContext(null)
          setIsUpdating(false)
          setErrorState({
            code: "account_mismatch",
            message: "Error de correspondencia de cuenta laboral.",
          })
          setStatus("error")
          return
        }

        pendingContextRef.current = null

        retryCountRef.current = 0
        setErrorState(null)
        setContext((prev) => {
          if (!prev) return freshContext

          const prevUserId = prev.userId ?? prev.meta?.userId ?? null
          const isDifferentUser = Boolean((prevUserId || freshUserId) && prevUserId !== freshUserId)

          const prevWorker = prev.profile?.matricula ?? prev.meta?.activeEmployeeNumber ?? prev.payroll?.employeeNumber ?? null
          const freshWorker = freshContext.profile?.matricula ?? freshContext.meta?.activeEmployeeNumber ?? freshContext.payroll?.employeeNumber ?? null
          const isDifferentWorker = Boolean(
            (prevWorker || freshWorker) && prevWorker !== freshWorker,
          )

          const prevRevision = prev.meta?.contextRevision ?? null
          const freshRevision = freshContext.meta?.contextRevision ?? null

          // Si el usuario/cuenta es diferente (incluso con la misma matrícula) o si el trabajador es diferente,
          // NUNCA se descarta por revisión menor: la cuenta B jamás debe mantener visible el contexto salarial de A.
          if (!isDifferentUser && !isDifferentWorker && prevRevision && freshRevision && freshRevision < prevRevision) {
            return prev
          }

          const prevId = prev.meta?.activePayslipId ?? null
          const freshId = freshContext.meta?.activePayslipId ?? null

          const prevMatricula = prev.profile?.matricula ?? null
          const freshMatricula = freshContext.profile?.matricula ?? null

          const prevPeriod = prev.payroll?.latestPeriod ?? null
          const freshPeriod = freshContext.payroll?.latestPeriod ?? null

          const hasChanged =
            isDifferentUser ||
            isDifferentWorker ||
            prevId !== freshId ||
            prevRevision !== freshRevision ||
            prevMatricula !== freshMatricula ||
            prevPeriod !== freshPeriod

          return hasChanged ? freshContext : prev
        })
        setStatus("ready")
        setIsUpdating(false)
      })
      .catch((err: unknown) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return

        const isAbort =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")

        const statusCode =
          err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
            ? (err as { status: number }).status
            : 0

        const errCode = isAbort
          ? "timeout"
          : err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
            ? (err as { code: string }).code
            : statusCode === 401
              ? "unauthorized"
              : "network_error"

        const errMessage = isAbort
          ? "Tiempo de espera agotado al consultar tu información laboral."
          : err instanceof Error
            ? err.message
            : "Error al consultar tu información laboral."

        const reqId =
          err && typeof err === "object" && "requestId" in err && typeof (err as { requestId: unknown }).requestId === "string"
            ? (err as { requestId: string }).requestId
            : undefined

        const errorInfo: WorkerContextError = {
          code: errCode,
          message: errMessage,
          status: statusCode || undefined,
          requestId: reqId,
        }
        setErrorState(errorInfo)

        // Se conserva el último cálculo tras errores de red ÚNICAMENTE mientras
        // se confirme que sigue siendo la misma cuenta. Si la cuenta cambió, si se
        // cerró sesión, o si la sesión expiró (401), se purga el contexto inmediatamente.
        const prevCtx = contextRef.current
        const prevCtxUserId = prevCtx?.userId ?? prevCtx?.meta?.userId ?? null
        const activeAuthUserId = authUserIdRef.current

        const isSameConfirmedAccount = Boolean(
          prevCtx &&
          statusCode !== 401 &&
          errCode !== "unauthorized" &&
          activeAuthUserId &&
          requestedUserId === activeAuthUserId &&
          prevCtxUserId === activeAuthUserId
        )

        console.info(
          `[useLiveWorkerContext] seq=${currentSeq} request_error code=${errCode} status=${statusCode} isSameConfirmedAccount=${isSameConfirmedAccount} activeAuthUser=${activeAuthUserId ?? "null"} requestedUser=${requestedUserId ?? "null"}`
        )

        if (!isSameConfirmedAccount) {
          setContext(null)
          setStatus("error")
        } else {
          setStatus("ready")
        }
        setIsUpdating(false)

        // Reintento acotado para fallos transitorios (red, 503, 504, timeout), máximo 2 intentos
        const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)
        const maxAutoRetries = isTestEnv ? 0 : 2
        const isTransient = !statusCode || statusCode >= 500 || isAbort
        if (isTransient && statusCode !== 401 && statusCode !== 403 && statusCode !== 404 && retryCountRef.current < maxAutoRetries) {
          retryCountRef.current += 1
          const delay = retryCountRef.current * 1000
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              syncRef.current?.(false)
            }
          }, delay)
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn("[useLiveWorkerContext] Error al consultar /api/worker-context:", err)
        }
      })
  }, [])
  useEffect(() => {
    syncRef.current = syncContextFromServer
  }, [syncContextFromServer])

  useEffect(() => {
    isMountedRef.current = true

    // 1. Inmediatamente al montar en cliente: consultar el estado real en servidor
    syncContextFromServer()

    // 2. Escuchar evento en la misma ventana
    const handlePayslipUpdated = () => {
      syncContextFromServer(true)
    }
    window.addEventListener("nomina_payslip_updated", handlePayslipUpdated)

    // 3. Escuchar reconexión online
    const handleOnline = () => {
      syncContextFromServer(true)
    }
    window.addEventListener("online", handleOnline)

    // 4. Escuchar retorno a la pestaña/aplicación
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncContextFromServer(false)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 5. Escuchar BroadcastChannel entre pestañas
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel("la20-worker-context")
      bc.onmessage = (event) => {
        if (event.data?.type === "nomina_payslip_updated") {
          syncContextFromServer(true)
        }
      }
    } catch {
      // Ignorar si el entorno o WebView no implementa BroadcastChannel
    }

    // 6. Escuchar cambios de sesión / usuario autenticado
    let authSub: { unsubscribe: () => void } | null = null
    try {
      const supabase = createClient()
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const eventUserId = session?.user?.id ?? null
        const prevAuthUserId = authUserIdRef.current

        console.info(
          `[useLiveWorkerContext] seq=${requestSeqRef.current} auth_event=${event} eventUser=${eventUserId ?? "null"} prevAuthUser=${prevAuthUserId ?? "null"} session=${authSessionIdRef.current}`
        )

        if (event === "SIGNED_OUT") {
          // Cerrar sesión explícito: borrar contexto anterior de inmediato
          pendingContextRef.current = null
          authUserIdRef.current = null
          sessionSeqRef.current++
          authSessionIdRef.current = `auth-${sessionSeqRef.current}-signed_out`
          abortControllerRef.current?.abort()
          requestSeqRef.current++
          setContext(null)
          setErrorState(null)
          setStatus("ready")
        } else if (eventUserId && prevAuthUserId && eventUserId !== prevAuthUserId) {
          // Cambio de cuenta (A -> B): borrar contexto anterior antes de solicitar el nuevo
          pendingContextRef.current = null
          authUserIdRef.current = eventUserId
          sessionSeqRef.current++
          authSessionIdRef.current = `auth-${sessionSeqRef.current}-${eventUserId}`
          abortControllerRef.current?.abort()
          requestSeqRef.current++
          setContext(null)
          setErrorState(null)
          setStatus("loading")
          syncContextFromServer(true)
        } else if (event === "SIGNED_IN" && eventUserId && !prevAuthUserId) {
          // El usuario inició sesión explícitamente tras estar como anónimo:
          pendingContextRef.current = null
          authUserIdRef.current = eventUserId
          sessionSeqRef.current++
          authSessionIdRef.current = `auth-${sessionSeqRef.current}-${eventUserId}`
          setContext(null)
          setStatus("loading")
          syncContextFromServer(true)
        } else if (event === "INITIAL_SESSION") {
          if (eventUserId) {
            authUserIdRef.current = eventUserId
            const pending = pendingContextRef.current
            if (pending) {
              const pendingUserId = pending.userId ?? pending.meta?.userId ?? null
              if (pendingUserId === eventUserId) {
                console.info(
                  `[useLiveWorkerContext] seq=${requestSeqRef.current} initial_session_resolved_pending user=${eventUserId}`
                )
                setContext(pending)
                setStatus("ready")
                setErrorState(null)
                setIsUpdating(false)
                pendingContextRef.current = null
              } else {
                console.warn(
                  `[useLiveWorkerContext] seq=${requestSeqRef.current} initial_session_mismatch_pending expected=${eventUserId} found=${pendingUserId}`
                )
                pendingContextRef.current = null
                setContext(null)
                setStatus("error")
                setErrorState({
                  code: "account_mismatch",
                  message: "Error de correspondencia de cuenta laboral.",
                })
              }
            }
          }
          console.info(
            `[useLiveWorkerContext] seq=${requestSeqRef.current} auth_event=INITIAL_SESSION user=${eventUserId ?? "null"} (distinguido de SIGNED_OUT)`
          )
        }
      })
      authSub = subscription
    } catch {
      // Ignorar si el cliente Supabase no está configurado (ej. tests unitarios)
    }

    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      abortControllerRef.current?.abort()
      window.removeEventListener("nomina_payslip_updated", handlePayslipUpdated)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (bc) {
        bc.close()
      }
      authSub?.unsubscribe()
    }
  }, [syncContextFromServer])

  const manualRetry = useCallback(() => {
    syncContextFromServer(true)
  }, [syncContextFromServer])

  return { context, status, error: errorState, retry: manualRetry, isUpdating }
}

export function useLiveWorkerContext(initialContext?: WorkerContext | null): WorkerContext | null {
  return useWorkerContextSync(initialContext).context
}
