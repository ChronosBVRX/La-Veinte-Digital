"use client"

import { useState, useCallback } from "react"
import type { PayrollIncident, PayrollIncidentType } from "../lib/types"

interface IncidentFormState {
  type: PayrollIncidentType | null
  dateFrom: string
  dateTo: string
  hours: string
  days: string
  authorized: boolean | null
  notes: string
}

const emptyForm: IncidentFormState = {
  type: null,
  dateFrom: "",
  dateTo: "",
  hours: "",
  days: "",
  authorized: null,
  notes: "",
}

export function usePayrollIncidents() {
  const [incidents, setIncidents] = useState<PayrollIncident[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<IncidentFormState>(emptyForm)

  const startAdding = useCallback(() => {
    setShowForm(true)
    setForm(emptyForm)
  }, [])

  const cancelAdding = useCallback(() => {
    setShowForm(false)
    setForm(emptyForm)
  }, [])

  const updateForm = useCallback((key: keyof IncidentFormState, value: string | boolean | PayrollIncidentType) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addIncident = useCallback(() => {
    if (!form.type || !form.dateFrom) return

    const incident: PayrollIncident = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: form.type,
      dateFrom: form.dateFrom,
      dateTo: form.dateTo || undefined,
      hours: form.hours ? parseInt(form.hours) : undefined,
      days: form.days ? parseInt(form.days) : undefined,
      notes: form.notes || undefined,
      confirmed: form.authorized === null ? false : form.authorized,
    }

    setIncidents((prev) => [...prev, incident])
    setShowForm(false)
    setForm(emptyForm)
  }, [form])

  const removeIncident = useCallback((id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clearIncidents = useCallback(() => {
    setIncidents([])
  }, [])

  return {
    incidents,
    showForm,
    form,
    startAdding,
    cancelAdding,
    updateForm,
    addIncident,
    removeIncident,
    clearIncidents,
  }
}
