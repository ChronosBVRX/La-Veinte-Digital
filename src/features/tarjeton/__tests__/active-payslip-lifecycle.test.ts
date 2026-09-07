// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import type { ConfirmTarjetonRequest } from "@/shared/contracts/tarjeton-import"

// Helper para crear un payload válido de tarjetón
function makeTarjetonPayload(params: {
  employeeNumber: string
  fullName: string
  periodRaw: string
  year: number
  month: number
  half: 1 | 2
  categoryName: string
  seniorityYears: number
  seniorityFortnights?: number
  seniorityDays?: number
  has054Radiation?: boolean
  porVencer?: string
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
}): ConfirmTarjetonRequest {
  const earnings = [
    {
      lineIndex: 0,
      code: "002",
      description: "SUELDO BASE",
      amount: params.totalEarnings ?? 10000,
      kind: "earning" as const,
      confidence: 1,
      confirmedByUser: true,
    },
  ]

  if (params.has054Radiation) {
    earnings.push({
      lineIndex: 1,
      code: "054",
      description: "EMANACIONES RADIACTIVAS",
      amount: 1500,
      kind: "earning" as const,
      confidence: 1,
      confirmedByUser: true,
    })
  }

  const deductions = [
    {
      lineIndex: 2,
      code: "212",
      description: "ISR",
      amount: -1200,
      kind: "deduction" as const,
      confidence: 1,
      confirmedByUser: true,
    },
  ]

  const totalEarn = earnings.reduce((acc, l) => acc + l.amount, 0)
  const totalDed = 1200
  const net = totalEarn - totalDed

  return {
    schemaVersion: "1.0",
    sourceHash: `hash_${params.employeeNumber}_${params.periodRaw}`,
    acknowledgeTotalDifference: false,
    authorizeServerStorage: true,
    profileUpdates: {
      matricula: true,
      fullName: true,
      categoria: true,
      antiguedad: true,
    },
    parsed: {
      schemaVersion: "1.0",
      document: {
        type: "imss_payroll_receipt",
        pageCount: 1,
        periodRaw: params.periodRaw,
        year: params.year,
        month: params.month,
        half: params.half,
      },
      employee: {
        employeeNumber: params.employeeNumber,
        fullName: params.fullName,
        categoryName: params.categoryName,
        categoryCode: "CAT01",
        workdayHours: 8,
        entryDate: "2015-01-16",
        seniority: {
          years: params.seniorityYears,
          fortnights: params.seniorityFortnights ?? 0,
          days: params.seniorityDays ?? 0,
          raw: `${params.seniorityYears} años`,
          reconstructedEffectiveDate: "2015-01-16",
          referenceDate: params.periodRaw,
        },
      },
      attendance: {},
      vacations: {
        porVencer: params.porVencer ?? "2026-10-15",
        dueDate: params.porVencer ?? "2026-10-15",
      },
      payroll: {
        earnings,
        deductions,
        observations: [
          {
            lineIndex: 0,
            conceptCode: "050",
            amount: 500,
            notes: "ESTIMULO DE ASISTENCIA",
          },
        ],
        totalEarnings: totalEarn,
        totalDeductions: totalDed,
        netPay: net,
        daysWorkedInYear: 180,
      },
      extraction: {
        method: "native_text",
        globalConfidence: 0.99,
        warnings: [],
        validations: {
          templateDetected: true,
          earningsTotalMatches: true,
          deductionsTotalMatches: true,
          netPayMatches: true,
          employeeMatchesProfile: true,
          categoryResolved: true,
        },
      },
    },
  }
}

/**
 * Mock Database Engine que replica fielmente el comportamiento de Postgres:
 * - profiles
 * - imported_payslips
 * - imported_payslip_lines
 * - imported_payslip_observations
 * - worker_active_context
 * - payroll_contexts
 * - vacation_profile_data
 * - RPC confirm_imported_payslip_v1
 * - RPC set_active_payslip
 */
class MockDatabase {
  profiles: Array<{
    id: string
    matricula: string | null
    full_name: string | null
    categoria: string | null
    antiguedad: string | null
    adscripcion: string | null
    updated_at: string
  }> = []

  importedPayslips: Array<{
    id: string
    user_id: string
    employee_number: string | null
    source_hash: string
    extraction_method: string
    period_raw: string | null
    period_year: number | null
    period_month: number | null
    period_half: number | null
    global_confidence: number
    employee_data: Record<string, unknown>
    vacations: Record<string, unknown>
    payroll_totals: Record<string, unknown>
    created_at: string
  }> = []

  payslipLines: Array<{
    id: string
    payslip_id: string
    line_index: number
    concept_code: string
    description: string
    amount: number
    kind: "earning" | "deduction"
    confidence: number
    confirmed_by_user: boolean
  }> = []

  payslipObservations: Array<{
    id: string
    payslip_id: string
    line_index: number
    concept_code: string
    amount: number | null
    notes: string | null
  }> = []

  workerActiveContext: Array<{
    user_id: string
    employee_number: string | null
    active_payslip_id: string | null
    selection_mode: "AUTO_LATEST" | "PINNED"
    updated_at: string
  }> = []

  payrollContexts: Array<{
    user_id: string
    category_name: string | null
    recurring_concepts: unknown[]
    payroll_facts: unknown[]
  }> = []

  vacationProfileData: Array<{
    user_id: string
    employee_number: string | null
    radiological_exposure: string | null
    radiological_exposure_source: string | null
    effective_seniority_years: number | null
  }> = []

  workerPreferences: Array<{
    user_id: string
    onboarding_state: "unconfigured" | "basic" | "configured"
    preferred_worker_mode: "manual" | "payslip" | null
    updated_at: string
  }> = []

  // Inicializar usuario
  initUser(userId: string, matricula?: string, fullName?: string) {
    this.profiles.push({
      id: userId,
      matricula: matricula ?? null,
      full_name: fullName ?? null,
      categoria: null,
      antiguedad: null,
      adscripcion: null,
      updated_at: new Date().toISOString(),
    })
    this.workerPreferences.push({
      user_id: userId,
      onboarding_state: "configured",
      preferred_worker_mode: "payslip",
      updated_at: new Date().toISOString(),
    })
  }

  // Ejecución fiel del RPC confirm_imported_payslip_v1
  confirmImportedPayslip(
    userId: string,
    req: ConfirmTarjetonRequest
  ) {
    const profile = this.profiles.find((p) => p.id === userId)
    if (!profile) throw new Error("unauthorized")

    const newMatricula = req.parsed.employee.employeeNumber?.trim() || null
    const oldMatricula = profile.matricula?.trim() || null

    const sameWorker = !oldMatricula || !newMatricula || oldMatricula === newMatricula
    const workerReplacement = !!oldMatricula && !!newMatricula && oldMatricula !== newMatricula && req.profileUpdates.matricula === true

    if (!sameWorker && !workerReplacement) {
      throw new Error("matricula_mismatch")
    }

    // Comprobar si es duplicado
    let payslip = this.importedPayslips.find((p) => p.user_id === userId && p.source_hash === req.sourceHash)
    let isDuplicate = false

    if (payslip) {
      isDuplicate = true
    } else {
      const id = `payslip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      payslip = {
        id,
        user_id: userId,
        employee_number: newMatricula,
        source_hash: req.sourceHash,
        extraction_method: req.parsed.extraction.method,
        period_raw: req.parsed.document.periodRaw,
        period_year: req.parsed.document.year ?? null,
        period_month: req.parsed.document.month ?? null,
        period_half: req.parsed.document.half ?? null,
        global_confidence: req.parsed.extraction.globalConfidence,
        employee_data: req.parsed.employee as Record<string, unknown>,
        vacations: req.parsed.vacations as Record<string, unknown>,
        payroll_totals: {
          totalEarnings: req.parsed.payroll.totalEarnings,
          totalDeductions: req.parsed.payroll.totalDeductions,
          netPay: req.parsed.payroll.netPay,
        },
        created_at: new Date().toISOString(),
      }
      this.importedPayslips.push(payslip)

      // Insertar líneas
      let idx = 0
      for (const e of req.parsed.payroll.earnings) {
        this.payslipLines.push({
          id: `line_${idx++}`,
          payslip_id: id,
          line_index: e.lineIndex,
          concept_code: e.code || "",
          description: e.description,
          amount: e.amount,
          kind: "earning",
          confidence: e.confidence,
          confirmed_by_user: e.confirmedByUser,
        })
      }
      for (const d of req.parsed.payroll.deductions) {
        this.payslipLines.push({
          id: `line_${idx++}`,
          payslip_id: id,
          line_index: d.lineIndex,
          concept_code: d.code || "",
          description: d.description,
          amount: d.amount,
          kind: "deduction",
          confidence: d.confidence,
          confirmed_by_user: d.confirmedByUser,
        })
      }
      for (const obs of req.parsed.payroll.observations) {
        this.payslipObservations.push({
          id: `obs_${idx++}`,
          payslip_id: id,
          line_index: obs.lineIndex,
          concept_code: obs.conceptCode,
          amount: obs.amount ?? null,
          notes: obs.notes ?? null,
        })
      }
    }

    const has054 = (req.parsed.payroll.earnings || []).some(
      (e) => (e.code === "054" || (e as unknown as { concept_code?: string }).concept_code === "054") && e.amount > 0
    )

    // Reconciliación atómica de identidad
    if (workerReplacement) {
      profile.matricula = newMatricula
      profile.full_name = req.parsed.employee.fullName?.trim() || profile.full_name
      profile.categoria = req.parsed.employee.categoryName || profile.categoria
      profile.antiguedad = req.parsed.employee.seniority?.raw || profile.antiguedad
      profile.updated_at = new Date().toISOString()

      // Resetear payroll_contexts
      this.payrollContexts = this.payrollContexts.filter((c) => c.user_id !== userId)
      this.payrollContexts.push({
        user_id: userId,
        category_name: req.parsed.employee.categoryName || null,
        recurring_concepts: [],
        payroll_facts: [],
      })

      // Resetear / upsert vacation_profile_data
      this.vacationProfileData = this.vacationProfileData.filter((v) => v.user_id !== userId)
      this.vacationProfileData.push({
        user_id: userId,
        employee_number: newMatricula,
        radiological_exposure: has054 ? "YES" : "NO",
        radiological_exposure_source: "ACTIVE_PAYSLIP",
        effective_seniority_years: req.parsed.employee.seniority?.years ?? null,
      })

      // worker_active_context pasa al nuevo trabajador
      const existingWac = this.workerActiveContext.find((w) => w.user_id === userId)
      if (existingWac) {
        existingWac.employee_number = newMatricula
        existingWac.active_payslip_id = payslip.id
        existingWac.selection_mode = "AUTO_LATEST"
        existingWac.updated_at = new Date().toISOString()
      } else {
        this.workerActiveContext.push({
          user_id: userId,
          employee_number: newMatricula,
          active_payslip_id: payslip.id,
          selection_mode: "AUTO_LATEST",
          updated_at: new Date().toISOString(),
        })
      }
    } else {
      // Mismo trabajador: actualizar campos individuales
      if (req.profileUpdates.fullName && req.parsed.employee.fullName) {
        profile.full_name = req.parsed.employee.fullName
      }
      if (req.profileUpdates.matricula && newMatricula) {
        profile.matricula = newMatricula
      }
      if (req.profileUpdates.categoria && req.parsed.employee.categoryName) {
        profile.categoria = req.parsed.employee.categoryName
      }
      if (req.profileUpdates.antiguedad && req.parsed.employee.seniority?.raw) {
        profile.antiguedad = req.parsed.employee.seniority.raw
      }

      // Sincronizar vacaciones
      const existingVac = this.vacationProfileData.find((v) => v.user_id === userId)
      if (existingVac) {
        if (existingVac.radiological_exposure_source !== "USER_CONFIRMED") {
          existingVac.radiological_exposure = has054 ? "YES" : "NO"
          existingVac.radiological_exposure_source = "ACTIVE_PAYSLIP"
        }
        existingVac.effective_seniority_years = req.parsed.employee.seniority?.years ?? existingVac.effective_seniority_years
      } else {
        this.vacationProfileData.push({
          user_id: userId,
          employee_number: newMatricula,
          radiological_exposure: has054 ? "YES" : "NO",
          radiological_exposure_source: "ACTIVE_PAYSLIP",
          effective_seniority_years: req.parsed.employee.seniority?.years ?? null,
        })
      }

      // Determinar si este payslip es el más reciente de este trabajador
      const payslipsOfWorker = this.importedPayslips.filter(
        (p) => p.user_id === userId && p.employee_number === (newMatricula || oldMatricula)
      )
      const isLatest = payslipsOfWorker.every((other) => {
        if (other.id === payslip!.id) return true
        const y1 = payslip!.period_year ?? 0
        const y2 = other.period_year ?? 0
        if (y2 > y1) return false
        if (y2 === y1) {
          const m1 = payslip!.period_month ?? 0
          const m2 = other.period_month ?? 0
          if (m2 > m1) return false
          if (m2 === m1) {
            const h1 = payslip!.period_half ?? 0
            const h2 = other.period_half ?? 0
            if (h2 > h1) return false
          }
        }
        return true
      })

      const existingWac = this.workerActiveContext.find((w) => w.user_id === userId)
      if (existingWac) {
        existingWac.employee_number = newMatricula || oldMatricula
        if (existingWac.selection_mode === "AUTO_LATEST" && isLatest) {
          existingWac.active_payslip_id = payslip.id
        } else if (!existingWac.active_payslip_id) {
          existingWac.active_payslip_id = payslip.id
        }
        existingWac.updated_at = new Date().toISOString()
      } else {
        this.workerActiveContext.push({
          user_id: userId,
          employee_number: newMatricula || oldMatricula,
          active_payslip_id: payslip.id,
          selection_mode: "AUTO_LATEST",
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Reconstruir o actualizar payroll_contexts
    const existingCtxIdx = this.payrollContexts.findIndex((c) => c.user_id === userId)
    const ctxData = {
      user_id: userId,
      category_name: req.parsed.employee.categoryName || profile.categoria || null,
      recurring_concepts: [],
      payroll_facts: [],
    }
    if (existingCtxIdx >= 0) {
      this.payrollContexts[existingCtxIdx] = ctxData
    } else {
      this.payrollContexts.push(ctxData)
    }

    const pref = this.workerPreferences.find((w) => w.user_id === userId)
    if (pref) {
      pref.onboarding_state = "configured"
      pref.preferred_worker_mode = "payslip"
      pref.updated_at = new Date().toISOString()
    }

    return {
      id: payslip.id,
      duplicate: isDuplicate,
      profileUpdated: true,
      payrollContextUpdated: true,
    }
  }

  // Ejecución fiel del RPC set_active_payslip (actualizado con transición atómica)
  setActivePayslip(
    userId: string,
    payslipId: string | null,
    selectionMode: "AUTO_LATEST" | "PINNED"
  ) {
    const profile = this.profiles.find((p) => p.id === userId)
    if (!profile) throw new Error("unauthorized")

    const activeMatricula = profile.matricula?.trim() || null

    if (selectionMode === "AUTO_LATEST") {
      // Buscar el más reciente de la matrícula activa
      const workerSlips = this.importedPayslips.filter(
        (p) => p.user_id === userId && (!activeMatricula || p.employee_number === activeMatricula)
      )
      const sorted = [...workerSlips].sort((a, b) => {
        if ((b.period_year ?? 0) !== (a.period_year ?? 0)) return (b.period_year ?? 0) - (a.period_year ?? 0)
        if ((b.period_month ?? 0) !== (a.period_month ?? 0)) return (b.period_month ?? 0) - (a.period_month ?? 0)
        if ((b.period_half ?? 0) !== (a.period_half ?? 0)) return (b.period_half ?? 0) - (a.period_half ?? 0)
        return b.created_at.localeCompare(a.created_at)
      })
      const latest = sorted[0]

      const existingWac = this.workerActiveContext.find((w) => w.user_id === userId)
      if (existingWac) {
        existingWac.selection_mode = "AUTO_LATEST"
        existingWac.active_payslip_id = latest?.id ?? null
        existingWac.employee_number = activeMatricula
        existingWac.updated_at = new Date().toISOString()
      } else {
        this.workerActiveContext.push({
          user_id: userId,
          employee_number: activeMatricula,
          active_payslip_id: latest?.id ?? null,
          selection_mode: "AUTO_LATEST",
          updated_at: new Date().toISOString(),
        })
      }

      // Sincronizar 054
      if (latest) {
        const has054 = this.payslipLines.some(
          (l) => l.payslip_id === latest.id && l.concept_code === "054" && l.kind === "earning" && l.amount > 0
        )
        const vac = this.vacationProfileData.find((v) => v.user_id === userId)
        if (vac && vac.radiological_exposure_source !== "USER_CONFIRMED") {
          vac.radiological_exposure = has054 ? "YES" : "NO"
          vac.radiological_exposure_source = "ACTIVE_PAYSLIP"
        }
      }

      return { ok: true, selectionMode: "AUTO_LATEST", activePayslipId: latest?.id ?? null }
    }

    // PINNED mode
    const payslip = this.importedPayslips.find((p) => p.id === payslipId && p.user_id === userId)
    if (!payslip) throw new Error("payslip_not_found_or_not_owned")

    const isWorkerChange = !!payslip.employee_number && (!activeMatricula || payslip.employee_number !== activeMatricula)

    const has054 = this.payslipLines.some(
      (l) => l.payslip_id === payslip.id && l.concept_code === "054" && l.kind === "earning" && l.amount > 0
    )

    const empData = payslip.employee_data as { fullName?: string; categoryName?: string; seniority?: { raw?: string; years?: number } }

    if (isWorkerChange) {
      profile.matricula = payslip.employee_number
      profile.full_name = empData.fullName ?? profile.full_name
      profile.categoria = empData.categoryName ?? profile.categoria
      profile.antiguedad = empData.seniority?.raw ?? profile.antiguedad
      profile.updated_at = new Date().toISOString()

      this.vacationProfileData = this.vacationProfileData.filter((v) => v.user_id !== userId)
      this.vacationProfileData.push({
        user_id: userId,
        employee_number: payslip.employee_number,
        radiological_exposure: has054 ? "YES" : "NO",
        radiological_exposure_source: "ACTIVE_PAYSLIP",
        effective_seniority_years: empData.seniority?.years ?? null,
      })
    } else {
      const vac = this.vacationProfileData.find((v) => v.user_id === userId)
      if (vac && vac.radiological_exposure_source !== "USER_CONFIRMED") {
        vac.radiological_exposure = has054 ? "YES" : "NO"
        vac.radiological_exposure_source = "ACTIVE_PAYSLIP"
      }
    }

    // Reconstruir SIEMPRE payroll_contexts a partir del tarjetón activo
    const recurring = this.payslipLines
      .filter((l) => l.payslip_id === payslip.id && l.kind === "earning" && l.amount > 0 && l.confirmed_by_user)
      .map((l) => ({
        conceptCode: l.concept_code,
        appearsNormally: true,
        lastAmount: l.amount,
        source: "payslip_import",
        lastSeenAt: payslip.period_raw,
        confirmed: l.confirmed_by_user,
      }))

    this.payrollContexts = this.payrollContexts.filter((c) => c.user_id !== userId)
    this.payrollContexts.push({
      user_id: userId,
      category_name: empData.categoryName || null,
      recurring_concepts: recurring,
      payroll_facts: [],
    })

    const pref = this.workerPreferences.find((w) => w.user_id === userId)
    if (pref) {
      pref.onboarding_state = "configured"
      pref.preferred_worker_mode = "payslip"
      pref.updated_at = new Date().toISOString()
    }

    const existingWac = this.workerActiveContext.find((w) => w.user_id === userId)
    if (existingWac) {
      existingWac.employee_number = payslip.employee_number
      existingWac.active_payslip_id = payslip.id
      existingWac.selection_mode = "PINNED"
      existingWac.updated_at = new Date().toISOString()
    } else {
      this.workerActiveContext.push({
        user_id: userId,
        employee_number: payslip.employee_number,
        active_payslip_id: payslip.id,
        selection_mode: "PINNED",
        updated_at: new Date().toISOString(),
      })
    }

    return { ok: true, selectionMode: "PINNED", activePayslipId: payslip.id }
  }

  // Resolver en base a la lógica canónica de resolveActivePayslip
  resolveActive(userId: string) {
    const profile = this.profiles.find((p) => p.id === userId)
    const activeMatricula = profile?.matricula?.trim() || null

    const wac = this.workerActiveContext.find((w) => w.user_id === userId)
    const selectionMode = wac?.selection_mode ?? "AUTO_LATEST"

    if (wac?.active_payslip_id) {
      const pinned = this.importedPayslips.find((p) => p.id === wac.active_payslip_id && p.user_id === userId)
      if (pinned) {
        const matchesMatricula = !activeMatricula || !pinned.employee_number || pinned.employee_number === activeMatricula
        if (matchesMatricula) {
          return { payslip: pinned, activePayslipId: pinned.id, selectionMode }
        }
      }
    }

    // Fallback AUTO_LATEST
    const matching = this.importedPayslips.filter(
      (p) => p.user_id === userId && (!activeMatricula || p.employee_number === activeMatricula)
    )
    const sorted = [...matching].sort((a, b) => {
      if ((b.period_year ?? 0) !== (a.period_year ?? 0)) return (b.period_year ?? 0) - (a.period_year ?? 0)
      if ((b.period_month ?? 0) !== (a.period_month ?? 0)) return (b.period_month ?? 0) - (a.period_month ?? 0)
      if ((b.period_half ?? 0) !== (a.period_half ?? 0)) return (b.period_half ?? 0) - (a.period_half ?? 0)
      return b.created_at.localeCompare(a.created_at)
    })
    const latest = sorted[0] ?? null

    return { payslip: latest, activePayslipId: latest?.id ?? null, selectionMode: "AUTO_LATEST" as const }
  }
}

describe("Arquitectura de Tarjetón Activo y Reemplazo Atómico de Identidad", () => {
  const USER_ID = "test-user-uuid"

  it("CASO A: A Q10 activo. Usuario importa A Q8 -> Q10 continúa activo, Q8 va al historial", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    // Importar A Q10 (2026-05-2)
    const slipAQ10 = makeTarjetonPayload({
      employeeNumber: "MAT_A",
      fullName: "ALICIA RAMIREZ",
      periodRaw: "2A-MAY-2026",
      year: 2026,
      month: 5,
      half: 2,
      categoryName: "ENFERMERA GENERAL",
      seniorityYears: 8,
    })
    const resQ10 = db.confirmImportedPayslip(USER_ID, slipAQ10)

    // Q10 es activo
    let resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resQ10.id)
    expect(resolved.selectionMode).toBe("AUTO_LATEST")

    // Ahora importar A Q8 (2026-04-2) más antiguo
    const slipAQ8 = makeTarjetonPayload({
      employeeNumber: "MAT_A",
      fullName: "ALICIA RAMIREZ",
      periodRaw: "2A-ABR-2026",
      year: 2026,
      month: 4,
      half: 2,
      categoryName: "ENFERMERA GENERAL",
      seniorityYears: 8,
    })
    const _resQ8 = db.confirmImportedPayslip(USER_ID, slipAQ8)

    // Q10 sigue siendo el activo porque Q8 es anterior cronológicamente
    resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resQ10.id)
    expect(resolved.payslip?.period_raw).toBe("2A-MAY-2026")

    // Ambos están en el historial
    expect(db.importedPayslips.filter((p) => p.user_id === USER_ID)).toHaveLength(2)
  })

  it("CASO B: Usuario selecciona A Q8 desde el historial ('Usar este tarjetón') -> Q8 activo en todas las herramientas", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))
    const resQ8 = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-ABR-2026", year: 2026, month: 4, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))

    // Usuario activa Q8
    db.setActivePayslip(USER_ID, resQ8.id, "PINNED")

    const resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resQ8.id)
    expect(resolved.selectionMode).toBe("PINNED")
    expect(resolved.payslip?.period_raw).toBe("2A-ABR-2026")
  })

  it("CASO C: Usuario pulsa 'Volver al más reciente' -> el sistema vuelve a Q10 (AUTO_LATEST)", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const resQ10 = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))
    const resQ8 = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-ABR-2026", year: 2026, month: 4, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))

    // Activar Q8
    db.setActivePayslip(USER_ID, resQ8.id, "PINNED")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resQ8.id)

    // Restablecer a AUTO_LATEST
    db.setActivePayslip(USER_ID, null, "AUTO_LATEST")
    const resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resQ10.id)
    expect(resolved.selectionMode).toBe("AUTO_LATEST")
    expect(resolved.payslip?.period_raw).toBe("2A-MAY-2026")
  })

  it("CASO D: Trabajador A activo -> Usuario importa B con sustitución autorizada -> Transición atómica a B", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))

    // Importar B autorizando sustitución
    const slipB = makeTarjetonPayload({
      employeeNumber: "MAT_B",
      fullName: "BERNARDO SOTO",
      periodRaw: "1A-JUN-2026",
      year: 2026,
      month: 6,
      half: 1,
      categoryName: "MEDICO NO FAMILIAR",
      seniorityYears: 15,
    })
    const resB = db.confirmImportedPayslip(USER_ID, slipB)

    const profile = db.profiles.find((p) => p.id === USER_ID)!
    expect(profile.matricula).toBe("MAT_B")
    expect(profile.full_name).toBe("BERNARDO SOTO")
    expect(profile.categoria).toBe("MEDICO NO FAMILIAR")

    const wac = db.workerActiveContext.find((w) => w.user_id === USER_ID)!
    expect(wac.employee_number).toBe("MAT_B")
    expect(wac.active_payslip_id).toBe(resB.id)

    const resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resB.id)
    expect(resolved.payslip?.employee_number).toBe("MAT_B")
  })

  it("CASO E: Trabajador B activo -> Usuario re-importa tarjetón de A (duplicado) con sustitución -> Activa A sin duplicar fila", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const slipA = makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    })
    const resA = db.confirmImportedPayslip(USER_ID, slipA)

    // Cambiar a B
    const slipB = makeTarjetonPayload({
      employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO NO FAMILIAR", seniorityYears: 15,
    })
    db.confirmImportedPayslip(USER_ID, slipB)

    const payslipsCountBefore = db.importedPayslips.length
    expect(payslipsCountBefore).toBe(2)

    // Re-importar A con el mismo sourceHash
    const resReimportA = db.confirmImportedPayslip(USER_ID, slipA)
    expect(resReimportA.duplicate).toBe(true)
    expect(resReimportA.id).toBe(resA.id)

    // No se duplicó la fila en imported_payslips
    expect(db.importedPayslips.length).toBe(2)

    // Perfil y contexto activo volvieron a A atómicamente
    const profile = db.profiles.find((p) => p.id === USER_ID)!
    expect(profile.matricula).toBe("MAT_A")
    expect(profile.full_name).toBe("ALICIA RAMIREZ")

    const resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resA.id)
    expect(resolved.payslip?.employee_number).toBe("MAT_A")
  })

  it("CASO F: Ciclo de Exposición Radiológica 054 (A con 054 -> B sin 054 -> A con 054 -> B sin 054)", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    // A tiene concepto 054
    const slipA = makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "TECNICO RADIOLOGO", seniorityYears: 5, has054Radiation: true,
    })
    const resA = db.confirmImportedPayslip(USER_ID, slipA)
    let vac = db.vacationProfileData.find((v) => v.user_id === USER_ID)!
    expect(vac.radiological_exposure).toBe("YES")

    // B NO tiene concepto 054
    const slipB = makeTarjetonPayload({
      employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO GENERAL", seniorityYears: 10, has054Radiation: false,
    })
    const resB = db.confirmImportedPayslip(USER_ID, slipB)
    vac = db.vacationProfileData.find((v) => v.user_id === USER_ID)!
    expect(vac.radiological_exposure).toBe("NO")

    // Volver a A via setActivePayslip desde historial
    db.setActivePayslip(USER_ID, resA.id, "PINNED")
    vac = db.vacationProfileData.find((v) => v.user_id === USER_ID)!
    expect(vac.radiological_exposure).toBe("YES")

    // Volver a B via setActivePayslip desde historial
    db.setActivePayslip(USER_ID, resB.id, "PINNED")
    vac = db.vacationProfileData.find((v) => v.user_id === USER_ID)!
    expect(vac.radiological_exposure).toBe("NO")
  })

  it("CASO G: Ciclo de Período Vacacional (vencimiento exacto cambia con cada trabajador)", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const resA = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8, porVencer: "2026-08-31",
    }))

    let resolved = db.resolveActive(USER_ID)
    expect((resolved.payslip?.vacations as { dueDate?: string })?.dueDate).toBe("2026-08-31")

    // Cambiar a B
    db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO GENERAL", seniorityYears: 12, porVencer: "2026-11-15",
    }))

    resolved = db.resolveActive(USER_ID)
    expect((resolved.payslip?.vacations as { dueDate?: string })?.dueDate).toBe("2026-11-15")

    // Volver a A
    db.setActivePayslip(USER_ID, resA.id, "PINNED")
    resolved = db.resolveActive(USER_ID)
    expect((resolved.payslip?.vacations as { dueDate?: string })?.dueDate).toBe("2026-08-31")
  })

  it("CASO H: Integridad de Nombre en BD (A -> B -> A -> B -> A) sin mezclas matricula_B + nombre_A", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const slipA = makeTarjetonPayload({ employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8 })
    const slipB = makeTarjetonPayload({ employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO GENERAL", seniorityYears: 12 })

    const resA = db.confirmImportedPayslip(USER_ID, slipA)
    let p = db.profiles.find((u) => u.id === USER_ID)!
    expect(p.matricula).toBe("MAT_A")
    expect(p.full_name).toBe("ALICIA RAMIREZ")

    const resB = db.confirmImportedPayslip(USER_ID, slipB)
    p = db.profiles.find((u) => u.id === USER_ID)!
    expect(p.matricula).toBe("MAT_B")
    expect(p.full_name).toBe("BERNARDO SOTO")

    // Re-importar A
    db.confirmImportedPayslip(USER_ID, slipA)
    p = db.profiles.find((u) => u.id === USER_ID)!
    expect(p.matricula).toBe("MAT_A")
    expect(p.full_name).toBe("ALICIA RAMIREZ")

    // Cambiar a B via historial
    db.setActivePayslip(USER_ID, resB.id, "PINNED")
    p = db.profiles.find((u) => u.id === USER_ID)!
    expect(p.matricula).toBe("MAT_B")
    expect(p.full_name).toBe("BERNARDO SOTO")

    // Cambiar a A via historial
    db.setActivePayslip(USER_ID, resA.id, "PINNED")
    p = db.profiles.find((u) => u.id === USER_ID)!
    expect(p.matricula).toBe("MAT_A")
    expect(p.full_name).toBe("ALICIA RAMIREZ")
  })

  it("CASO J: Selección directa desde el Historial sin re-parsear PDF (A -> B -> A)", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const resA = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8,
    }))
    const resB = db.confirmImportedPayslip(USER_ID, makeTarjetonPayload({
      employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO GENERAL", seniorityYears: 12,
    }))

    // Actualmente activo es B
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resB.id)

    // Usuario hace clic en "Usar este tarjetón" en A desde el historial
    const actResA = db.setActivePayslip(USER_ID, resA.id, "PINNED")
    expect(actResA.ok).toBe(true)

    let resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resA.id)
    let profile = db.profiles.find((p) => p.id === USER_ID)!
    expect(profile.matricula).toBe("MAT_A")
    expect(profile.full_name).toBe("ALICIA RAMIREZ")

    // Usuario hace clic en "Usar este tarjetón" en B desde el historial
    const actResB = db.setActivePayslip(USER_ID, resB.id, "PINNED")
    expect(actResB.ok).toBe(true)

    resolved = db.resolveActive(USER_ID)
    expect(resolved.activePayslipId).toBe(resB.id)
    profile = db.profiles.find((p) => p.id === USER_ID)!
    expect(profile.matricula).toBe("MAT_B")
    expect(profile.full_name).toBe("BERNARDO SOTO")
  })

  it("Ciclo completo A -> B -> A -> B -> A con verificación de todas las fuentes de verdad", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const slipA = makeTarjetonPayload({
      employeeNumber: "MAT_A", fullName: "ALICIA RAMIREZ", periodRaw: "2A-MAY-2026", year: 2026, month: 5, half: 2, categoryName: "ENFERMERA GENERAL", seniorityYears: 8, has054Radiation: true, porVencer: "2026-08-31",
    })
    const slipB = makeTarjetonPayload({
      employeeNumber: "MAT_B", fullName: "BERNARDO SOTO", periodRaw: "1A-JUN-2026", year: 2026, month: 6, half: 1, categoryName: "MEDICO GENERAL", seniorityYears: 12, has054Radiation: false, porVencer: "2026-11-15",
    })

    // 1. Iniciar en A
    const resA = db.confirmImportedPayslip(USER_ID, slipA)
    expect(db.profiles[0].matricula).toBe("MAT_A")
    expect(db.profiles[0].full_name).toBe("ALICIA RAMIREZ")
    expect(db.vacationProfileData[0].radiological_exposure).toBe("YES")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resA.id)

    // 2. Transición a B (importación con reemplazo)
    const resB = db.confirmImportedPayslip(USER_ID, slipB)
    expect(db.profiles[0].matricula).toBe("MAT_B")
    expect(db.profiles[0].full_name).toBe("BERNARDO SOTO")
    expect(db.vacationProfileData[0].radiological_exposure).toBe("NO")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resB.id)

    // 3. Volver a A (selección desde historial)
    db.setActivePayslip(USER_ID, resA.id, "PINNED")
    expect(db.profiles[0].matricula).toBe("MAT_A")
    expect(db.profiles[0].full_name).toBe("ALICIA RAMIREZ")
    expect(db.vacationProfileData[0].radiological_exposure).toBe("YES")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resA.id)

    // 4. Volver a B (selección desde historial)
    db.setActivePayslip(USER_ID, resB.id, "PINNED")
    expect(db.profiles[0].matricula).toBe("MAT_B")
    expect(db.profiles[0].full_name).toBe("BERNARDO SOTO")
    expect(db.vacationProfileData[0].radiological_exposure).toBe("NO")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resB.id)

    // 5. Volver a A (re-importación de archivo existente)
    const reimportResA = db.confirmImportedPayslip(USER_ID, slipA)
    expect(reimportResA.duplicate).toBe(true)
    expect(db.profiles[0].matricula).toBe("MAT_A")
    expect(db.profiles[0].full_name).toBe("ALICIA RAMIREZ")
    expect(db.vacationProfileData[0].radiological_exposure).toBe("YES")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resA.id)
  })

  it("CASO K: Invariante P0 — Transición A -> B -> A mantiene configured/payslip y payroll_contexts sin degradar a basic ni vaciar contexto", () => {
    const db = new MockDatabase()
    db.initUser(USER_ID, "MAT_A", "ALICIA RAMIREZ")

    const slipA = makeTarjetonPayload({
      employeeNumber: "MAT_A",
      fullName: "ALICIA RAMIREZ",
      periodRaw: "2A-MAY-2026",
      year: 2026,
      month: 5,
      half: 2,
      categoryName: "ENFERMERA GENERAL",
      seniorityYears: 8,
      has054Radiation: true,
    })
    const slipB = makeTarjetonPayload({
      employeeNumber: "MAT_B",
      fullName: "BERNARDO SOTO",
      periodRaw: "1A-JUN-2026",
      year: 2026,
      month: 6,
      half: 1,
      categoryName: "MEDICO GENERAL",
      seniorityYears: 12,
      has054Radiation: false,
    })

    // 1. Estado inicial: Usuario A configurado
    const resA = db.confirmImportedPayslip(USER_ID, slipA)
    const prefInit = db.workerPreferences.find((w) => w.user_id === USER_ID)!
    expect(prefInit.onboarding_state).toBe("configured")
    expect(prefInit.preferred_worker_mode).toBe("payslip")
    const ctxInit = db.payrollContexts.find((c) => c.user_id === USER_ID)!
    expect(ctxInit).toBeDefined()
    expect(ctxInit.category_name).toBe("ENFERMERA GENERAL")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resA.id)

    // 2. Acción: Importa y confirma tarjetón B permitido por el flujo
    const resB = db.confirmImportedPayslip(USER_ID, slipB)

    // 3. Resultado esperado: worker_preferences = configured/payslip, payroll_contexts = B, tarjetón B activo
    // NUNCA worker_preferences = basic, NUNCA payroll_contexts = null
    const prefB = db.workerPreferences.find((w) => w.user_id === USER_ID)!
    expect(prefB.onboarding_state).toBe("configured")
    expect(prefB.preferred_worker_mode).toBe("payslip")
    const ctxB = db.payrollContexts.find((c) => c.user_id === USER_ID)!
    expect(ctxB).toBeDefined()
    expect(ctxB.category_name).toBe("MEDICO GENERAL")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resB.id)

    // 4. Volver a seleccionar A desde el historial
    const actA = db.setActivePayslip(USER_ID, resA.id, "PINNED")
    expect(actA.ok).toBe(true)

    // 5. Debe quedar nuevamente configured/payslip y payroll_contexts = A, sin perder históricos
    const prefBackA = db.workerPreferences.find((w) => w.user_id === USER_ID)!
    expect(prefBackA.onboarding_state).toBe("configured")
    expect(prefBackA.preferred_worker_mode).toBe("payslip")
    const ctxBackA = db.payrollContexts.find((c) => c.user_id === USER_ID)!
    expect(ctxBackA).toBeDefined()
    expect(ctxBackA.category_name).toBe("ENFERMERA GENERAL")
    expect(db.resolveActive(USER_ID).activePayslipId).toBe(resA.id)

    // Históricos intactos: ambos tarjetones deben existir en imported_payslips
    const allSlips = db.importedPayslips.filter((p) => p.user_id === USER_ID)
    expect(allSlips.length).toBe(2)
    expect(allSlips.some((p) => p.id === resA.id)).toBe(true)
    expect(allSlips.some((p) => p.id === resB.id)).toBe(true)
  })
})
