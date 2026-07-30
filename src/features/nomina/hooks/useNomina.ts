"use client"

import { useState, useCallback, useEffect } from "react"
import type {
  EmployeePayrollProfile,
  ResolvedSalaryCategory,
  PayPeriod,
  SeniorityResult,
  PayrollProjection,
  PayrollIncident,
  RecurringConceptOverride,
  OccupationalCondition,
} from "../lib/types"
import { calculateSeniority, reconstructEffectiveDate } from "../lib/seniority"
import { getCurrentPayPeriod } from "../lib/periods"
import { calculateProjection } from "../lib/engine"
import { resolveSalaryCategoryByName } from "../lib/categories"
import {
  getProfile,
  saveProfile,
  hasConsent,
  saveConsent,
  deleteAllData,
  getProjections,
  saveProjection,
  deleteProfile,
} from "../services/storage"

export type NominaStep =
  | "consent"
  | "profile"
  | "category"
  | "seniority"
  | "conditions"
  | "ready"
  | "projection"

interface NominaState {
  consented: boolean
  profile: EmployeePayrollProfile | null
  projections: PayrollProjection[]
  step: NominaStep
  loading: boolean
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
  const [category, setCategoryState] = useState<ResolvedSalaryCategory | null>(null)
  const [seniority, setSeniority] = useState<SeniorityResult | null>(null)
  const [period, setPeriod] = useState<PayPeriod | null>(null)
  const [projection, setProjection] = useState<PayrollProjection | null>(null)
  const [hydrating, setHydrating] = useState(false)

  useEffect(() => {
    if (!s.consented || !s.profile) return
    let cancelled = false

    async function hydrate() {
      setHydrating(true)
      const p = s.profile!

      if (p.categoryName && !category) {
        const cat = await resolveSalaryCategoryByName(
          p.categoryName,
          new Date().toISOString().slice(0, 10)
        )
        if (!cancelled && cat) setCategoryState(cat)
      }

      if (p.displayedSeniorityAtLastPayslip && !seniority) {
        const effectiveDate = reconstructEffectiveDate(
          p.displayedSeniorityAtLastPayslip,
          p.displayedSeniorityAtLastPayslip.referenceDate
        )
        const today = new Date().toISOString().slice(0, 10)
        if (!cancelled) {
          setSeniority(calculateSeniority(effectiveDate, today))
          setPeriod(getCurrentPayPeriod(today))
        }
      }

      if (!cancelled) setHydrating(false)
    }

    hydrate()
    return () => { cancelled = true }
  }, [])

  const patch = useCallback((patch: Partial<NominaState>) => {
    setS((prev) => ({ ...prev, ...patch }))
  }, [])

  const giveConsent = useCallback(() => {
    saveConsent(true)
    patch({ consented: true, step: "profile" })
  }, [patch])

  const revokeConsent = useCallback(() => {
    deleteAllData()
    setCategoryState(null)
    setSeniority(null)
    setPeriod(null)
    setProjection(null)
    patch({ consented: false, profile: null, projections: [], step: "consent" })
  }, [patch])

  const updateProfile = useCallback((p: EmployeePayrollProfile) => {
    saveProfile(p)
    saveConsent(true)

    if (p.displayedSeniorityAtLastPayslip) {
      const effectiveDate = reconstructEffectiveDate(
        p.displayedSeniorityAtLastPayslip,
        p.displayedSeniorityAtLastPayslip.referenceDate
      )
      const today = new Date().toISOString().slice(0, 10)
      const sr = calculateSeniority(effectiveDate, today)
      setSeniority(sr)
      setPeriod(getCurrentPayPeriod(today))
    }

    if (p.categoryName) {
      resolveSalaryCategoryByName(p.categoryName, new Date().toISOString().slice(0, 10)).then((cat) => {
        if (cat) setCategoryState(cat)
      })
    }

    const step: NominaStep = p.occupationalConditions.length > 0 ? "ready" : "conditions"
    patch({ consented: true, profile: p, step })
  }, [patch])

  const updateConditions = useCallback(
    (conditions: OccupationalCondition[]) => {
      const p = s.profile
      if (!p) return
      const updated = { ...p, occupationalConditions: conditions }
      saveProfile(updated)
      patch({ profile: updated, step: "ready" })
    },
    [s.profile, patch]
  )

  const generateProjection = useCallback(
    (incidents?: PayrollIncident[], recurring?: RecurringConceptOverride[]) => {
      const p = s.profile
      if (!p || !category || !period || !seniority) return null

      const proj = calculateProjection(p, category, period, seniority, incidents ?? [], recurring ?? [])
      setProjection(proj)
      saveProjection(proj)
      const updated = [...s.projections.filter((x) => x.id !== proj.id), proj]
      patch({ projections: updated, step: "projection" })
      return proj
    },
    [s.profile, s.projections, category, period, seniority, patch]
  )

  const resetProfile = useCallback(() => {
    deleteProfile()
    setCategoryState(null)
    setSeniority(null)
    setPeriod(null)
    setProjection(null)
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

  return {
    consented: s.consented,
    profile: s.profile,
    category,
    seniority,
    period,
    projection,
    projections: s.projections,
    step: s.step,
    loading: s.loading,
    hydrating,
    giveConsent,
    revokeConsent,
    updateProfile,
    updateConditions,
    generateProjection,
    resetProfile,
    setStep,
    selectProjection,
  }
}
