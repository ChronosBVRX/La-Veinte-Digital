"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { todayForQueryParam } from "@/shared/lib/dates"
import type {
  EmployeePayrollProfile,
  ResolvedSalaryCategory,
  PayPeriod,
  SeniorityResult,
  PayrollProjection,
  PayrollIncident,
  RecurringConceptOverride,
  OccupationalCondition,
  PayrollFact,
  PayrollFactKey,
  PayrollFactValue,
  ProjectionMode,
} from "../lib/types"
import { calculateSeniority, reconstructEffectiveDate } from "../lib/seniority"
import { getCurrentPayPeriod } from "../lib/periods"
import { calculateProjection, type PayrollProjectionResult } from "../lib/engine"
import { validateProjectionTotals } from "../lib/totals"
import { resolveCategory, type CategoryMatch } from "../lib/category-resolver"
import type { ConditionalPayrollQuestion } from "../lib/question-engine"
import {
  getProfile,
  saveProfile,
  hasConsent,
  saveConsent,
  deleteAllData,
  getProjections,
  saveProjection,
  deleteProjection,
  deleteProfile,
} from "@/shared/services/local-storage"
import {
  grantPayrollConsent,
  revokePayrollConsent,
  deletePayrollDataRemote,
  savePayrollProfileRemote,
} from "@/shared/services/payroll-consent"

export type NominaStep =
  | "consent"
  | "profile"
  | "category"
  | "seniority"
  | "conditions"
  | "questions"
  | "ready"
  | "projection"

export type CategoryResolutionState =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "resolved"; category: ResolvedSalaryCategory; method: string }
  | { status: "ambiguous"; matches: CategoryMatch[] }
  | { status: "not_found"; originalValue?: string }
  | { status: "error"; message: string }

interface NominaState {
  consented: boolean
  profile: EmployeePayrollProfile | null
  projections: PayrollProjection[]
  step: NominaStep
  loading: boolean
}

interface PayrollQuestionAnswer {
  factKey: PayrollFactKey
  value: PayrollFactValue
}

function initState(): NominaState {
  const c = hasConsent()
  if (c) {
    const p = getProfile()
    return {
      consented: true,
      profile: p,
      projections: getProjections(),
      step: p ? "ready" : "profile",
      loading: false,
    }
  }
  return {
    consented: false,
    profile: null,
    projections: [],
    step: "consent",
    loading: false,
  }
}

export function useNomina() {
  const [s, setS] = useState<NominaState>(initState)
  const [categoryState, setCategoryState] = useState<CategoryResolutionState>({ status: "idle" })
  const [seniority, setSeniority] = useState<SeniorityResult | null>(null)
  const [period, setPeriod] = useState<PayPeriod | null>(null)
  const [projection, setProjection] = useState<PayrollProjection | null>(null)
  const [projectionResult, setProjectionResult] = useState<PayrollProjectionResult | null>(null)
  const [pendingQuestions, setPendingQuestions] = useState<ConditionalPayrollQuestion[]>([])
  const [questionAnswers, setQuestionAnswers] = useState<PayrollQuestionAnswer[]>([])
  const [hydrating, setHydrating] = useState(false)
  const hydratingRef = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  useEffect(() => {
    if (!s.consented || !s.profile || hydratingRef.current) return
    hydratingRef.current = true

    async function hydrate() {
      setHydrating(true)
      const p = s.profile!

      if (p.categoryName && categoryState.status === "idle") {
        setCategoryState({ status: "resolving" })
        const result = resolveCategory(p.categoryName, todayForQueryParam())
        if (result.resolved && result.category) {
          setCategoryState({
            status: "resolved",
            category: result.category,
            method: result.resolutionMethod ?? "unknown",
          })
        } else if (result.status === "ambiguous") {
          setCategoryState({ status: "ambiguous", matches: result.matches ?? [] })
        } else {
          setCategoryState({ status: "not_found", originalValue: p.categoryName })
        }
      }

      if (p.displayedSeniorityAtLastPayslip && !seniority) {
        const effectiveDate = reconstructEffectiveDate(
          p.displayedSeniorityAtLastPayslip,
          p.displayedSeniorityAtLastPayslip.referenceDate
        )
        const today = todayForQueryParam()
        setSeniority(calculateSeniority(effectiveDate, today))
        setPeriod(getCurrentPayPeriod(today))
      }

      setHydrating(false)
    }

    hydrate()
  }, [
    s.consented,
    s.profile,
    s.profile?.id,
    s.profile?.categoryName,
    s.profile?.categoryId,
    s.profile?.updatedAt,
    s.profile?.displayedSeniorityAtLastPayslip?.years,
    s.profile?.displayedSeniorityAtLastPayslip?.months,
    s.profile?.displayedSeniorityAtLastPayslip?.days,
    s.profile?.displayedSeniorityAtLastPayslip?.referenceDate,
    categoryState.status,
    seniority,
  ])

  const patch = useCallback((patch: Partial<NominaState>) => {
    setS((prev) => ({ ...prev, ...patch }))
  }, [])

  const syncProfileToServer = useCallback((profile: EmployeePayrollProfile) => {
    savePayrollProfileRemote(profile).catch((err) => {
      console.warn("[nomina] no se pudo sincronizar el perfil al servidor:", err)
    })
  }, [])

  const giveConsent = useCallback(() => {
    saveConsent(true)
    patch({ consented: true, step: "profile" })
    grantPayrollConsent().catch((err) => {
      console.warn("[nomina] no se pudo registrar el consentimiento en el servidor:", err)
    })
  }, [patch])

  const revokeConsent = useCallback(() => {
    deleteAllData()
    setCategoryState({ status: "idle" })
    setSeniority(null)
    setPeriod(null)
    setProjection(null)
    setProjectionResult(null)
    setPendingQuestions([])
    setQuestionAnswers([])
    patch({ consented: false, profile: null, projections: [], step: "consent" })
    revokePayrollConsent().catch((err) => {
      console.warn("[nomina] no se pudo revocar el consentimiento en el servidor:", err)
    })
  }, [patch])

  const deleteDataPermanently = useCallback(async () => {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeletionError(null)
    try {
      await deletePayrollDataRemote()
      deleteAllData()
      setCategoryState({ status: "idle" })
      setSeniority(null)
      setPeriod(null)
      setProjection(null)
      setProjectionResult(null)
      setPendingQuestions([])
      setQuestionAnswers([])
      patch({ consented: false, profile: null, projections: [], step: "consent" })
    } catch (err) {
      console.error("[nomina] no se pudo borrar la información en el servidor:", err)
      setDeletionError(
        "No se pudo borrar la información en el servidor. Tus datos locales se conservan; inténtalo de nuevo más tarde."
      )
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }, [patch])

  const updateProfile = useCallback(async (p: EmployeePayrollProfile) => {
    saveProfile(p)
    saveConsent(true)
    syncProfileToServer(p)
    grantPayrollConsent().catch((err) => {
      console.warn("[nomina] no se pudo registrar el consentimiento en el servidor:", err)
    })

    if (p.displayedSeniorityAtLastPayslip) {
      const effectiveDate = reconstructEffectiveDate(
        p.displayedSeniorityAtLastPayslip,
        p.displayedSeniorityAtLastPayslip.referenceDate
      )
      const today = todayForQueryParam()
      const sr = calculateSeniority(effectiveDate, today)
      setSeniority(sr)
      setPeriod(getCurrentPayPeriod(today))
    }

    if (p.categoryName) {
      setCategoryState({ status: "resolving" })
      const result = resolveCategory(p.categoryName, todayForQueryParam())
      if (result.resolved && result.category) {
        setCategoryState({
          status: "resolved",
          category: result.category,
          method: result.resolutionMethod ?? "unknown",
        })
      } else if (result.status === "ambiguous") {
        setCategoryState({ status: "ambiguous", matches: result.matches ?? [] })
      } else {
        setCategoryState({ status: "not_found", originalValue: p.categoryName })
      }
    }

    const step: NominaStep = p.occupationalConditions.length > 0 ? "ready" : "conditions"
    patch({ consented: true, profile: p, step })
  }, [patch, syncProfileToServer])

  const resolveAmbiguousCategory = useCallback((category: ResolvedSalaryCategory) => {
    setCategoryState({ status: "resolved", category, method: "manual" })
    patch({ step: "ready" })
  }, [patch])

  const updateConditions = useCallback(
    (conditions: OccupationalCondition[]) => {
      const p = s.profile
      if (!p) return
      const updated = { ...p, occupationalConditions: conditions }
      saveProfile(updated)
      syncProfileToServer(updated)
      patch({ profile: updated, step: "ready" })
    },
    [s.profile, patch, syncProfileToServer]
  )

  const answerQuestion = useCallback(
    (factKey: PayrollFactKey, value: PayrollFactValue) => {
      setQuestionAnswers((prev) => {
        const existing = prev.findIndex((a) => a.factKey === factKey)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { factKey, value }
          return updated
        }
        return [...prev, { factKey, value }]
      })

      const p = s.profile
      if (!p) return

      const fact: PayrollFact = {
        key: factKey,
        value,
        source: "user",
        confidence: value === null ? 0.3 : 0.8,
        updatedAt: new Date().toISOString(),
      }

      const existingFacts = (p.facts ?? []).filter((f) => f.key !== factKey)
      const updatedProfile = { ...p, facts: [...existingFacts, fact] }
      saveProfile(updatedProfile)
      syncProfileToServer(updatedProfile)
      patch({ profile: updatedProfile })
    },
    [s.profile, patch, syncProfileToServer]
  )

  const setAllFacts = useCallback(
    (facts: PayrollFact[]) => {
      const p = s.profile
      if (!p) return
      const updated = { ...p, facts }
      saveProfile(updated)
      syncProfileToServer(updated)
      patch({ profile: updated })
    },
    [s.profile, patch, syncProfileToServer]
  )

  const generateProjection = useCallback(
    (
      mode: ProjectionMode = "assisted",
      incidents?: PayrollIncident[],
      recurring?: RecurringConceptOverride[],
    ) => {
      const p = s.profile
      const catState = categoryState
      if (!p || catState.status !== "resolved" || !period || !seniority) return null

      const input = {
        profile: p,
        category: catState.category,
        period,
        seniority,
        incidents: incidents ?? [],
        recurringConcepts: recurring ?? [],
        mode,
      }

      const result = calculateProjection(input)
      setProjection(result.projection)
      setProjectionResult(result)
      setPendingQuestions(result.questions)
      if (validateProjectionTotals(result.projection.totals)) {
        saveProjection(result.projection)
      }

      const updated = [...s.projections.filter((x) => x.id !== result.projection.id), result.projection]
      patch({ projections: updated, step: "projection" })
      return result
    },
    [s.profile, s.projections, categoryState, period, seniority, patch]
  )

  const removeProjection = useCallback((projectionId: string) => {
    deleteProjection(projectionId)
    const updated = s.projections.filter((p) => p.id !== projectionId)
    patch({ projections: updated })
    if (projection?.id === projectionId) {
      setProjection(null)
      setProjectionResult(null)
    }
  }, [s.projections, projection, patch])

  const resetProfile = useCallback(() => {
    deleteProfile()
    setCategoryState({ status: "idle" })
    setSeniority(null)
    setPeriod(null)
    setProjection(null)
    setProjectionResult(null)
    setPendingQuestions([])
    setQuestionAnswers([])
    patch({ profile: null, step: "profile" })
  }, [patch])

  const setStep = useCallback((step: NominaStep) => {
    patch({ step })
  }, [patch])

  const selectProjection = useCallback((projectionId: string) => {
    const found = s.projections.find((p) => p.id === projectionId)
    if (found) {
      setProjection(found)
      patch({ step: "projection" })
    }
  }, [s.projections, patch])

  const category = categoryState.status === "resolved" ? categoryState.category : null

  return {
    consented: s.consented,
    profile: s.profile,
    category,
    categoryState,
    seniority,
    period,
    projection,
    projectionResult,
    pendingQuestions,
    questionAnswers,
    projections: s.projections,
    step: s.step,
    loading: s.loading,
    hydrating,
    deleting,
    deletionError,
    giveConsent,
    revokeConsent,
    deleteDataPermanently,
    updateProfile,
    resolveAmbiguousCategory,
    updateConditions,
    answerQuestion,
    setAllFacts,
    generateProjection,
    resetProfile,
    setStep,
    selectProjection,
    removeProjection,
  }
}
