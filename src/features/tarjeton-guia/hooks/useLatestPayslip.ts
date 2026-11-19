"use client"

import { useEffect, useMemo, useState } from "react"
import { getPayslips } from "@/shared/services/local-storage"
import { toGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import type { ServerPayslipSummary } from "@/features/tarjeton-guia/services/fetch-latest-payslip"
import { getLatestPayslipAnalysis } from "@/features/tarjeton/services/payslip-analysis-store"
import { syncLatestSavedPayslip } from "@/features/tarjeton/services/sync-latest-payslip"

export interface UseLatestPayslipResult {
  payslip: GuidePayslip | null
  previous: GuidePayslip | null
  source: "local" | "server"
  total: number
  allPayslips: GuidePayslip[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

/**
 * Selecciona el tarjetón activo para la Guía de mi Tarjetón y permite alternar
 * entre cualquier tarjetón guardado en el historial ("Mis documentos" / local / servidor).
 *
 * Fuente canónica primaria: PayslipAnalysis del documento guardado en "Mis documentos"
 * (Android Room / IndexedDB). Si no existe o está pendiente, dispara la sincronización
 * automática en segundo plano y fusiona con los registros existentes de localStorage/servidor.
 */
export function useLatestPayslip(
  serverPayslip: GuidePayslip | null,
  userId: string,
  initialServerPayslips?: ServerPayslipSummary[],
  initialSelectedId?: string | null
): UseLatestPayslipResult {
  const [revision, setRevision] = useState(0)
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null)
  const selectedId = userSelectedId ?? initialSelectedId ?? null

  useEffect(() => {
    // Sincronizar automáticamente el tarjetón guardado en montaje
    const canonical = getLatestPayslipAnalysis(userId)
    const needsObservations = Boolean(!canonical || !canonical.observations || canonical.observations.length === 0)
    void syncLatestSavedPayslip(userId, { force: needsObservations }).catch(() => {})

    const handler = () => setRevision((r) => r + 1)
    const handleFocus = () => {
      void syncLatestSavedPayslip(userId).catch(() => {})
    }

    window.addEventListener("storage", handler)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("nomina_payslip_updated", handler)
    window.addEventListener("tarjeton_analysis_completed", handler)
    window.addEventListener("tarjeton_analysis_state_changed", handler)
    return () => {
      window.removeEventListener("storage", handler)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("nomina_payslip_updated", handler)
      window.removeEventListener("tarjeton_analysis_completed", handler)
      window.removeEventListener("tarjeton_analysis_state_changed", handler)
    }
  }, [userId])

  return useMemo(() => {
    void revision

    // 1. Consultar el análisis persistido canónico del documento guardado
    const canonicalAnalysis = getLatestPayslipAnalysis(userId)
    const canonicalGuideSlip = canonicalAnalysis ? toGuidePayslip(canonicalAnalysis) : null

    // 2. Registros locales
    const local = getPayslips(userId)
      .map((p) => toGuidePayslip(p))
      .filter((p): p is GuidePayslip => p !== null)

    const allLocal = [...local]
    if (canonicalGuideSlip) {
      // Si ya hay un slip con el mismo ID o periodo, reemplazarlo o fusionarlo
      const matchIdx = allLocal.findIndex(
        (s) =>
          s.id === canonicalGuideSlip.id ||
          (s.periodRaw && canonicalGuideSlip.periodRaw && s.periodRaw === canonicalGuideSlip.periodRaw)
      )
      if (matchIdx >= 0) {
        allLocal[matchIdx] = mergePayslips(canonicalGuideSlip, allLocal[matchIdx])
      } else {
        allLocal.unshift(canonicalGuideSlip)
      }
    }

    const byPeriod = allLocal.sort((a, b) => {
      const pa = periodRank(a)
      const pb = periodRank(b)
      if (pa === pb) {
        const countB = (b.earnings?.length ?? 0) + (b.deductions?.length ?? 0)
        const countA = (a.earnings?.length ?? 0) + (a.deductions?.length ?? 0)
        if (countB !== countA) return countB - countA
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      }
      return pb - pa
    })

    const candidateLocal = byPeriod[0] ?? null
    const candidateServer = serverPayslip

    let latest: GuidePayslip | null
    let previousLocal: GuidePayslip | null = byPeriod[1] ?? null

    if (!candidateLocal && !candidateServer) {
      if (canonicalAnalysis && (canonicalAnalysis.status === "analyzing" || canonicalAnalysis.status === "pending")) {
        const analyzingSlip: GuidePayslip = {
          id: canonicalAnalysis.documentId,
          periodRaw: canonicalAnalysis.period,
          periodLabel: canonicalAnalysis.period,
          earnings: [],
          deductions: [],
          perceptions: [],
          observations: [],
          totalEarnings: 0,
          totalDeductions: 0,
          netPay: 0,
          netAmount: 0,
          source: "local" as const,
          analysisStatus: canonicalAnalysis.status,
        }
        return {
          payslip: analyzingSlip,
          previous: null,
          source: "local" as const,
          total: 1,
          allPayslips: [analyzingSlip],
          selectedId: analyzingSlip.id,
          setSelectedId: setUserSelectedId,
        }
      }
      return {
        payslip: null,
        previous: null,
        source: "server" as const,
        total: 0,
        allPayslips: [],
        selectedId: null,
        setSelectedId: setUserSelectedId,
      }
    }

    if (!candidateLocal) {
      latest = candidateServer
    } else if (!candidateServer) {
      latest = candidateLocal
    } else {
      const rLocal = periodRank(candidateLocal)
      const rServer = periodRank(candidateServer)
      const localCount = (candidateLocal.earnings?.length ?? 0) + (candidateLocal.deductions?.length ?? 0)
      const serverCount = (candidateServer.earnings?.length ?? 0) + (candidateServer.deductions?.length ?? 0)

      const isSamePeriodOrId =
        candidateLocal.id === candidateServer.id ||
        (rLocal > 0 && rLocal === rServer) ||
        (candidateLocal.periodRaw && candidateServer.periodRaw && candidateLocal.periodRaw === candidateServer.periodRaw)

      if (isSamePeriodOrId) {
        // Mismo periodo: fusionar dando prioridad al que tenga conceptos reales
        if (localCount >= serverCount) {
          latest = mergePayslips(candidateLocal, candidateServer)
        } else {
          latest = mergePayslips(candidateServer, candidateLocal)
        }
      } else if (rLocal > rServer) {
        latest = localCount > 0 || serverCount === 0 ? candidateLocal : candidateServer
      } else if (rServer > rLocal) {
        if (serverCount === 0 && localCount > 0) {
          latest = mergePayslips(candidateServer, candidateLocal)
        } else {
          latest = candidateServer
          previousLocal = candidateLocal
        }
      } else {
        if (localCount >= serverCount) {
          latest = mergePayslips(candidateLocal, candidateServer)
        } else {
          latest = mergePayslips(candidateServer, candidateLocal)
        }
      }
    }

    // Si tenemos un análisis canónico con conceptos listos, asegurar que el resultado los conserve
    if (latest && canonicalGuideSlip && (canonicalGuideSlip.earnings.length > 0 || canonicalGuideSlip.deductions.length > 0)) {
      const latestCount = (latest.earnings?.length ?? 0) + (latest.deductions?.length ?? 0)
      const canonicalCount = canonicalGuideSlip.earnings.length + canonicalGuideSlip.deductions.length
      if (canonicalCount > latestCount || periodRank(canonicalGuideSlip) >= periodRank(latest)) {
        latest = mergePayslips(canonicalGuideSlip, latest)
      }
    }

    // Unificar lista completa de tarjetones disponibles
    const allSlipsMap = new Map<string, GuidePayslip>()
    if (latest) allSlipsMap.set(latest.id, latest)
    for (const slip of byPeriod) {
      if (!allSlipsMap.has(slip.id)) allSlipsMap.set(slip.id, slip)
    }
    if (candidateServer && !allSlipsMap.has(candidateServer.id)) {
      allSlipsMap.set(candidateServer.id, candidateServer)
    }
    if (initialServerPayslips) {
      for (const s of initialServerPayslips) {
        if (!allSlipsMap.has(s.id)) {
          allSlipsMap.set(s.id, {
            id: s.id,
            periodRaw: s.periodRaw,
            periodLabel: s.periodLabel,
            earnings: [],
            deductions: [],
            perceptions: [],
            observations: [],
            totalEarnings: 0,
            totalDeductions: 0,
            netPay: s.netPay,
            netAmount: s.netPay,
            source: "server",
          })
        }
      }
    }

    const allPayslips = Array.from(allSlipsMap.values()).sort((a, b) => {
      const pa = periodRank(a)
      const pb = periodRank(b)
      if (pa === pb) return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      return pb - pa
    })

    // Resolver selección de usuario
    let activeSlip: GuidePayslip | null = latest
    let activePrev: GuidePayslip | null = previousLocal

    if (selectedId) {
      const foundIdx = allPayslips.findIndex((s) => s.id === selectedId)
      if (foundIdx >= 0) {
        activeSlip = allPayslips[foundIdx]
        activePrev = foundIdx + 1 < allPayslips.length ? allPayslips[foundIdx + 1] : null
      }
    }

    return {
      payslip: activeSlip,
      previous: activePrev,
      source: (activeSlip?.source ?? "local") as "local" | "server",
      total: allPayslips.length,
      allPayslips,
      selectedId: activeSlip?.id ?? null,
      setSelectedId: setUserSelectedId,
    }
  }, [serverPayslip, revision, userId, selectedId, initialServerPayslips])
}

function mergePayslips(preferred: GuidePayslip, secondary: GuidePayslip): GuidePayslip {
  const earnings = preferred.earnings.length > 0 ? preferred.earnings : secondary.earnings
  const deductions = preferred.deductions.length > 0 ? preferred.deductions : secondary.deductions
  const observations = preferred.observations.length > 0 ? preferred.observations : secondary.observations
  const perceptions = preferred.perceptions && preferred.perceptions.length > 0 ? preferred.perceptions : secondary.perceptions ?? earnings
  return {
    ...preferred,
    id: preferred.id || secondary.id,
    periodRaw: preferred.periodRaw || secondary.periodRaw,
    periodLabel: preferred.periodLabel || secondary.periodLabel,
    earnings,
    deductions,
    perceptions,
    observations,
    totalEarnings: preferred.totalEarnings ?? secondary.totalEarnings,
    totalDeductions: preferred.totalDeductions ?? secondary.totalDeductions,
    netPay: preferred.netPay ?? secondary.netPay,
    netAmount: preferred.netAmount ?? secondary.netAmount ?? preferred.netPay ?? secondary.netPay,
    analysisStatus:
      earnings.length > 0 || deductions.length > 0
        ? "ready"
        : preferred.analysisStatus ?? secondary.analysisStatus ?? "pending",
  }
}

/** Ranking inverso por periodo (entre más alto, más reciente). null = desconocido. */
function periodRank(p: GuidePayslip): number {
  const label = p.periodLabel ?? p.periodRaw ?? ""
  const year = Number(label.match(/\b20\d{2}\b/)?.[0] ?? 0)
  if (!year) return 0
  const monthMatch = label.match(
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i
  )
  const MONTHS: Record<string, number> = {
    enero: 1, ene: 1,
    febrero: 2, feb: 2,
    marzo: 3, mar: 3,
    abril: 4, abr: 4,
    mayo: 5, may: 5,
    junio: 6, jun: 6,
    julio: 7, jul: 7,
    agosto: 8, ago: 8,
    septiembre: 9, sep: 9,
    octubre: 10, oct: 10,
    noviembre: 11, nov: 11,
    diciembre: 12, dic: 12,
  }
  const month = monthMatch ? MONTHS[monthMatch[1].toLowerCase()] ?? 0 : 0
  const half = /2\s*[ª.]|2A|2\s*\.\s*Q/i.test(label) ? 2 : 1
  return year * 24 + (month - 1) * 2 + half
}
