"use client"

import { useState, useCallback } from "react"
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
import { calculateSeniority } from "../lib/seniority"
import { getCurrentPayPeriod } from "../lib/periods"
import { resolveSalaryCategory } from "../lib/categories"
import { calculateProjection } from "../lib/engine"
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
    let step: NominaStep = "category"
    if (p.categoryId && p.effectiveSeniorityDate) {
      step = "ready"
    } else if (p.categoryId) {
      step = "seniority"
    }
    patch({ consented: true, profile: p, step })
  }, [patch])

  const selectCategory = useCallback(
    async (categoryId: string) => {
      const p = s.profile
      if (!p) return
      const resolved = await resolveSalaryCategory(categoryId, new Date().toISOString().slice(0, 10))
      if (resolved) {
        setCategoryState(resolved)
        const updated = { ...p, categoryId: resolved.categoryId, categoryName: resolved.categoryName }
        saveProfile(updated)
        patch({ profile: updated, step: "seniority" })
      }
    },
    [s.profile, patch]
  )

  const updateSeniorityDate = useCallback(
    (effectiveDate: string) => {
      const p = s.profile
      if (!p) return
      const today = new Date().toISOString().slice(0, 10)
      const sr = calculateSeniority(effectiveDate, today)
      setSeniority(sr)
      setPeriod(getCurrentPayPeriod(today))
      const updated = { ...p, effectiveSeniorityDate: effectiveDate }
      saveProfile(updated)
      patch({ profile: updated, step: "conditions" })
    },
    [s.profile, patch]
  )

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
    giveConsent,
    revokeConsent,
    updateProfile,
    selectCategory,
    updateSeniorityDate,
    updateConditions,
    generateProjection,
    resetProfile,
    setStep,
  }
}
