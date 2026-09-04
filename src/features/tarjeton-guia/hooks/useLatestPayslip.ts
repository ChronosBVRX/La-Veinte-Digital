"use client"

import { useEffect, useMemo, useState } from "react"
import { getPayslips } from "@/shared/services/local-storage"
import { toGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"

/**
 * Selecciona el tarjetón más reciente para la Guía de mi Tarjetón.
 *
 * Prioridad: el que tenga fecha de periodo más reciente entre localStorage
 * (fuente completa del flujo de import) y el servidor (última fila confirmada).
 */
export function useLatestPayslip(serverPayslip: GuidePayslip | null) {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const handler = () => setRevision((r) => r + 1)
    window.addEventListener("storage", handler)
    window.addEventListener("nomina_payslip_updated", handler)
    return () => {
      window.removeEventListener("storage", handler)
      window.removeEventListener("nomina_payslip_updated", handler)
    }
  }, [])

  return useMemo(() => {
    const local = getPayslips()
      .map((p) => toGuidePayslip(p))
      .filter((p): p is GuidePayslip => p !== null)

    const byPeriod = local.sort((a, b) => {
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

    if (!candidateLocal && !candidateServer) return { payslip: null, previous: null, source: ("server" as const), total: 0 }

    if (!candidateLocal) {
      latest = candidateServer
    } else if (!candidateServer) {
      latest = candidateLocal
    } else {
      const rLocal = periodRank(candidateLocal)
      const rServer = periodRank(candidateServer)
      if (rLocal > rServer) {
        latest = candidateLocal
      } else if (rServer > rLocal) {
        latest = candidateServer
        previousLocal = candidateLocal
      } else {
        // Mismo periodo: desempatar por presencia de conceptos
        const localCount = (candidateLocal.earnings?.length ?? 0) + (candidateLocal.deductions?.length ?? 0)
        const serverCount = (candidateServer.earnings?.length ?? 0) + (candidateServer.deductions?.length ?? 0)
        if (localCount >= serverCount) {
          latest = candidateLocal
        } else {
          latest = candidateServer
        }
      }
    }

    const total = local.length + (candidateServer ? 1 : 0)
    return { payslip: latest, previous: previousLocal, source: ("local" as const), total }
  }, [serverPayslip])
}

/** Ranking inverso por periodo (entre más alto, más reciente). null = desconocido. */
function periodRank(p: GuidePayslip): number {
  const label = p.periodLabel ?? p.periodRaw ?? ""
  const year = Number(label.match(/\b20\d{2}\b/)?.[0] ?? 0)
  if (!year) return 0
  const monthMatch = label.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i)
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
