"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { shouldPrefetchRoute } from "@/shared/components/app/navigation"
import { getPayslips } from "@/shared/services/local-storage"
import {
  isNativePdfShareSupported,
  setNativeDocsOwner,
} from "@/shared/services/pdfShareBridge"
import {
  buildOfflineWorkerSnapshot,
  syncOfflineSnapshotToNative,
  type CommitmentSnapshotInput,
  type WorkerContextSnapshotInput,
} from "@/shared/services/offline-snapshot-sync"

const SAFE_IDLE_WARMUP_ROUTES = [
  "/calendario",
  "/bitacora",
  "/escritos",
  "/asistente",
  "/profile",
  "/informacion-y-fuentes",
] as const

interface NativeRuntimeEnhancerProps {
  userId: string
}

async function loadCommitmentsForSnapshot(
  userId: string,
): Promise<CommitmentSnapshotInput[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("worker_commitments")
      .select("id, title, type, start_at, status, notes")
      .eq("user_id", userId)
      .order("start_at", { ascending: true })
      .limit(40)

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        startAt: row.start_at,
        status: row.status,
        notes: row.notes,
      }))
    }
  } catch {
    // Fallback a almacenamiento local si falla la consulta
  }

  try {
    const raw = window.localStorage.getItem("worker_commitments")
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{
      id?: string
      userId?: string
      title?: string
      type?: string
      startAt?: string
      status?: string
      notes?: string
    }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c) => c && c.userId === userId && c.id && c.title && c.startAt)
      .slice(0, 40)
      .map((c) => ({
        id: String(c.id),
        title: String(c.title),
        type: c.type ?? "general_reminder",
        startAt: String(c.startAt),
        status: c.status ?? "pending",
        notes: c.notes ?? null,
      }))
  } catch {
    return []
  }
}

/**
 * Orquestador silencioso para sesión autenticada:
 * 1. Pre-calienta en segundo plano (`requestIdleCallback`) únicamente las rutas estáticas
 *    permitidas por `shouldPrefetchRoute`, sin tocar `ACTIVE_WORKER_DATA_ROUTES` para
 *    garantizar cero datos obsoletos en Router Cache.
 * 2. En la app híbrida Android, sincroniza el propietario de sesión y el snapshot
 *    de solo lectura (Mi Quincena con 002+011, Perfil, Vacaciones y Mi Agenda) al montar
 *    y cada vez que el trabajador actualiza su tarjetón, perfil o agenda.
 */
export function NativeRuntimeEnhancer({ userId }: NativeRuntimeEnhancerProps) {
  const router = useRouter()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warmedUpRef = useRef(false)

  useEffect(() => {
    if (!userId || typeof window === "undefined") return

    // 1. Pre-calentamiento de rutas estáticas en tiempo ocioso (una vez por sesión)
    if (!warmedUpRef.current) {
      warmedUpRef.current = true
      const warmRoutes = () => {
        for (const href of SAFE_IDLE_WARMUP_ROUTES) {
          if (shouldPrefetchRoute(href)) {
            try {
              router.prefetch(href)
            } catch {
              // Ignorar fallos de red transitorios en prefetch
            }
          }
        }
      }

      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }
      if (typeof win.requestIdleCallback === "function") {
        win.requestIdleCallback(warmRoutes, { timeout: 2500 })
      } else {
        setTimeout(warmRoutes, 600)
      }
    }

    // 2. Sincronización nativa para modo offline (solo en APK de Android)
    const runNativeSync = async () => {
      if (!isNativePdfShareSupported()) return
      setNativeDocsOwner(userId)

      try {
        const res = await fetch("/api/worker-context", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        const workerContext: WorkerContextSnapshotInput | null = res.ok
          ? ((await res.json()) as WorkerContextSnapshotInput)
          : null

        const localPayslips = getPayslips(userId)
        const latestLocalPayslip =
          localPayslips.length > 0 ? localPayslips[localPayslips.length - 1] : null

        const commitments = await loadCommitmentsForSnapshot(userId)

        const snapshot = buildOfflineWorkerSnapshot({
          ownerId: userId,
          workerContext,
          localPayslip: latestLocalPayslip,
          commitments,
        })

        syncOfflineSnapshotToNative(snapshot)
      } catch {
        // Best-effort: nunca interrumpir la sesión
      }
    }

    const scheduleSync = (delayMs = 350) => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
      syncTimerRef.current = setTimeout(() => {
        void runNativeSync()
      }, delayMs)
    }

    // Sincronización inicial tras hidratar
    scheduleSync(500)

    const onDataMutated = () => scheduleSync(250)
    window.addEventListener("nomina_payslip_updated", onDataMutated)
    window.addEventListener("nomina_profile_updated", onDataMutated)
    window.addEventListener("lvd:commitments-updated", onDataMutated)
    window.addEventListener("laveinte:native-ready", onDataMutated)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
      window.removeEventListener("nomina_payslip_updated", onDataMutated)
      window.removeEventListener("nomina_profile_updated", onDataMutated)
      window.removeEventListener("lvd:commitments-updated", onDataMutated)
      window.removeEventListener("laveinte:native-ready", onDataMutated)
    }
  }, [userId, router])

  return null
}
