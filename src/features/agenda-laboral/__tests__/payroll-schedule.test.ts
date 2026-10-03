import { describe, expect, it } from "vitest"
import {
  getImssPayday,
  getOvertimePaymentSchedule,
  getClaimResolutionSchedule,
  groupOvertimeByFortnight,
  summarizeClaims,
} from "../lib/payroll-schedule"
import type { WorkerCommitment } from "../types"

describe("payroll-schedule: calendario y normativa IMSS", () => {
  it("obtiene la fecha exacta de dispersión quincenal de Santander para 2026", () => {
    // Octubre 2026: Santander [12, 27]
    expect(getImssPayday(2026, 10, 1, "santander")).toBe("2026-10-12")
    expect(getImssPayday(2026, 10, 2, "santander")).toBe("2026-10-27")

    // Noviembre 2026: Santander [10, 25]
    expect(getImssPayday(2026, 11, 1, "santander")).toBe("2026-11-10")
    expect(getImssPayday(2026, 11, 2, "santander")).toBe("2026-11-25")
  })

  it("calcula fecha de cobro de tiempo extra con desfase de 1 mes (2 quincenas) según SIAP", () => {
    // Guardia realizada el 5 de octubre de 2026 (1ª Qna de Octubre)
    // Debe pagarse en la 1ª Qna de Noviembre (2026-11-10)
    const scheduleQ1 = getOvertimePaymentSchedule("2026-10-05", "santander")
    expect(scheduleQ1.incidenceFortnightKey).toBe("2026-10-Q1")
    expect(scheduleQ1.targetFortnightKey).toBe("2026-11-Q1")
    expect(scheduleQ1.targetFortnightLabel).toContain("1ª quincena de noviembre de 2026")
    expect(scheduleQ1.targetPaymentDate).toBe("2026-11-10")
    expect(scheduleQ1.formattedPaymentDate).toBe("10 de noviembre de 2026")

    // Guardia realizada el 20 de octubre de 2026 (2ª Qna de Octubre)
    // Debe pagarse en la 2ª Qna de Noviembre (2026-11-25)
    const scheduleQ2 = getOvertimePaymentSchedule("2026-10-20", "santander")
    expect(scheduleQ2.incidenceFortnightKey).toBe("2026-10-Q2")
    expect(scheduleQ2.targetFortnightKey).toBe("2026-11-Q2")
    expect(scheduleQ2.targetPaymentDate).toBe("2026-11-25")
  })

  it("calcula cronograma de reclamaciones con hito de Cláusula 8 (15 días) y cobro a 3 quincenas (45 días)", () => {
    const claim = getClaimResolutionSchedule("2026-10-05", "santander")
    expect(claim.filedDate).toBe("2026-10-05")
    expect(claim.clausula8Deadline).toBe("2026-10-20")
    expect(claim.formattedClausula8Deadline).toBe("20 de octubre de 2026")

    // 10-05 es 2026-10-Q1. Avanza 3 quincenas: Q2 Octubre, Q1 Noviembre, Q2 Noviembre.
    expect(claim.targetFortnightKey).toBe("2026-11-Q2")
    expect(claim.targetPaymentDate).toBe("2026-11-25")
    expect(claim.formattedPaymentDate).toBe("25 de noviembre de 2026")
  })

  it("agrupa tiempos extra por quincena, suma horas y dinero, y alerta si excede 20 hrs (Proc. 1A74-003-031)", () => {
    const mockCommitments: WorkerCommitment[] = [
      {
        id: "te-1",
        userId: "u-1",
        type: "overtime",
        title: "Tiempo extra",
        startAt: "2026-10-02T16:00:00",
        endAt: "2026-10-02T20:00:00",
        workplace: "HGZ 83",
        service: "Urgencias",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-02T20:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          hoursCalculated: 4,
          estimatedEarnings: 900,
        },
      },
      {
        id: "te-2",
        userId: "u-1",
        type: "overtime",
        title: "Tiempo extra",
        startAt: "2026-10-08T08:00:00",
        endAt: "2026-10-08T16:00:00",
        workplace: "HGZ 83",
        service: "Urgencias",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-08T16:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          hoursCalculated: 8,
          estimatedEarnings: 1800,
        },
      },
      {
        id: "te-3",
        userId: "u-1",
        type: "overtime",
        title: "Tiempo extra",
        startAt: "2026-10-12T08:00:00",
        endAt: "2026-10-12T17:00:00",
        workplace: "HGZ 83",
        service: "Urgencias",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-12T17:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          hoursCalculated: 9, // Total 4+8+9 = 21 hrs (>20h tope)
          estimatedEarnings: 2100,
        },
      },
      {
        id: "te-4",
        userId: "u-1",
        type: "overtime",
        title: "Tiempo extra",
        startAt: "2026-10-22T14:00:00",
        endAt: "2026-10-22T20:00:00",
        workplace: "HGZ 83",
        service: "Urgencias",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-22T20:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          hoursCalculated: 6,
          estimatedEarnings: 1350,
        },
      },
    ]

    const grouped = groupOvertimeByFortnight(mockCommitments, "santander")
    expect(grouped.length).toBe(2)

    // La quincena más reciente primero (2026-10-Q2)
    const q2 = grouped[0]
    expect(q2.periodKey).toBe("2026-10-Q2")
    expect(q2.totalHours).toBe(6)
    expect(q2.totalEstimatedEarnings).toBe(1350)
    expect(q2.exceedsLimit20h).toBe(false)
    expect(q2.paymentSchedule.targetPaymentDate).toBe("2026-11-25")

    // Quincena 1 (2026-10-Q1)
    const q1 = grouped[1]
    expect(q1.periodKey).toBe("2026-10-Q1")
    expect(q1.totalHours).toBe(21)
    expect(q1.totalEstimatedEarnings).toBe(4800)
    expect(q1.exceedsLimit20h).toBe(true) // 21 > 20
    expect(q1.paymentSchedule.targetPaymentDate).toBe("2026-11-10")
  })

  it("resume reclamaciones pendientes y totaliza dinero esperado", () => {
    const mockClaims: WorkerCommitment[] = [
      {
        id: "c-1",
        userId: "u-1",
        type: "no_pagado",
        title: "Reclamación de Tiempo Extra",
        startAt: "2026-10-05T08:00:00",
        endAt: "2026-10-05T09:00:00",
        workplace: "HGZ 83",
        service: "",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-05T08:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          claimStatus: "en_seguimiento",
          estimatedClaimAmount: 2500,
          claimedConcepts: ["037"],
        },
      },
      {
        id: "c-2",
        userId: "u-1",
        type: "no_pagado",
        title: "Reclamación de Estímulo Puntualidad",
        startAt: "2026-10-10T08:00:00",
        endAt: "2026-10-10T09:00:00",
        workplace: "HGZ 83",
        service: "",
        substituteWorkerName: "",
        notes: "",
        status: "active",
        createdAt: "2026-10-10T08:00:00",
        reminder: { dayBefore: false, hoursBefore: false, atStart: false },
        details: {
          claimStatus: "pendiente",
          estimatedClaimAmount: 1100,
          claimedConcepts: ["033"],
        },
      },
    ]

    const summary = summarizeClaims(mockClaims)
    expect(summary.totalCount).toBe(2)
    expect(summary.pendingCount).toBe(2)
    expect(summary.totalClaimedAmount).toBe(3600)
  })
})
