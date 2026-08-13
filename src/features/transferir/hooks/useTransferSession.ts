"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  closeTransferSession,
  createTransferSession,
  listTransferFiles,
} from "@/features/transferir/services/transfer"
import type {
  TransferFileMeta,
  TransferSession,
} from "@/features/transferir/lib/transfer"

export type TransferStatus =
  | "idle"
  | "creating"
  | "ready"
  | "error"

const POLL_INTERVAL_MS = 1500

export function useTransferSession() {
  const [session, setSession] = useState<TransferSession | null>(null)
  const [files, setFiles] = useState<TransferFileMeta[]>([])
  const [status, setStatus] = useState<TransferStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const ownerTokenRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    const owner = ownerTokenRef.current
    if (!owner) return
    try {
      const list = await listTransferFiles(owner)
      setFiles(list)
    } catch (e) {
      const message = e instanceof Error ? e.message : ""
      if (message.includes("expired") || message.includes("invalid_session")) {
        stopPolling()
        setError("La sesión expiró. Genera un nuevo código QR.")
        setStatus("error")
      }
    }
  }, [stopPolling])

  const start = useCallback(
    async (ttlMinutes = 10) => {
      setStatus("creating")
      setError(null)
      setFiles([])
      stopPolling()
      try {
        const created = await createTransferSession(ttlMinutes)
        ownerTokenRef.current = created.ownerToken
        setSession(created)
        setStatus("ready")
        pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
      } catch {
        setStatus("error")
        setError("No se pudo iniciar la transferencia. Intenta de nuevo.")
      }
    },
    [refresh, stopPolling],
  )

  const close = useCallback(async () => {
    stopPolling()
    const owner = ownerTokenRef.current
    ownerTokenRef.current = null
    setSession(null)
    setFiles([])
    setStatus("idle")
    setError(null)
    if (owner) {
      try {
        await closeTransferSession(owner)
      } catch {
        // La sesión pudo haber expirado; no es relevante.
      }
    }
  }, [stopPolling])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return { session, files, status, error, start, refresh, close }
}
