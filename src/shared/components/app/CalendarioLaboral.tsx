"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { CaretLeft, CaretRight, Clock, MapPin, Warning, ShieldCheck, Plus, Trash, Check, Info } from "@phosphor-icons/react"
import Link from "next/link"
import { CALENDARIOS, EVENT_LABELS, EVENT_COLORS, getImssMandatoryRestDaysForMonth } from "@/shared/data/calendario"
import type { CalendarEventType } from "@/shared/data/calendario"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/shared/components/ui/Button"
import { readAllLocal, addCommitment as addLocalCommitment, deleteCommitment as deleteLocalCommitment } from "@/features/agenda-laboral/services/commitments-local"
import { useSelectedAgendaDate, useCommitmentsListener, notifyCommitmentsChanged } from "@/features/agenda-laboral/lib/agenda-bus"
import { formatLocalTime } from "@/features/agenda-laboral/lib/commitment-calendar"

const STORAGE_KEY = "calendar_filters_v2"

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"]

const PAYMENT_TYPES = new Set<CalendarEventType>(["santander", "otros", "cheque", "jubilados"])

type FilterKey =
  | "payments"
  | "interactivo"
  | "vacacional"
  | "descanso_cct"
  | "txt_substitution"
  | "overtime"
  | "shift_change"
  | "guardia_festiva"
  | "falta_injustificada"
  | "incapacidad"
  | "pase_salida"
  | "vacaciones"
  | "no_pagado"
  | "other"

const AGENDA_KEYS: FilterKey[] = [
  "txt_substitution",
  "overtime",
  "shift_change",
  "guardia_festiva",
  "falta_injustificada",
  "incapacidad",
  "pase_salida",
  "vacaciones",
  "no_pagado",
  "other",
]

const FILTER_DEFS: { key: FilterKey; label: string; color: string; group: "institucional" | "agenda" }[] = [
  { key: "payments", label: "Pagos", color: "#ef4444", group: "institucional" },
  { key: "interactivo", label: "Interactivo", color: "#eab308", group: "institucional" },
  { key: "vacacional", label: "Vacaciones", color: "#22c55e", group: "institucional" },
  { key: "descanso_cct", label: "Descanso CCT", color: "#6366f1", group: "institucional" },
  { key: "txt_substitution", label: "TxT", color: "#3b82f6", group: "agenda" },
  { key: "overtime", label: "T. extra", color: "#f97316", group: "agenda" },
  { key: "shift_change", label: "Turno", color: "#8b5cf6", group: "agenda" },
  { key: "guardia_festiva", label: "Guardia", color: "#ec4899", group: "agenda" },
  { key: "falta_injustificada", label: "Falta", color: "#f43f5e", group: "agenda" },
  { key: "incapacidad", label: "Incapacidad", color: "#14b8a6", group: "agenda" },
  { key: "pase_salida", label: "Pases", color: "#0ea5e9", group: "agenda" },
  { key: "vacaciones", label: "Mis vacaciones", color: "#84cc16", group: "agenda" },
  { key: "no_pagado", label: "No pagado", color: "#b45309", group: "agenda" },
  { key: "other", label: "Otros", color: "#64748b", group: "agenda" },
]

interface CalendarEvent {
  id: string
  date: Date
  title: string
  time?: string
  color: string
  type: FilterKey
  detail?: string
  isNightShift?: boolean
  isMandatoryRest?: boolean
  clause?: string
  legalBasis?: string
  dateStr?: string
  hasUserGuard?: boolean
  guardCommitmentId?: string
  notes?: string
  workplace?: string
  service?: string
}

function loadFilters(): FilterKey[] {
  const allKeys = FILTER_DEFS.map((f) => f.key)
  if (typeof window === "undefined" || !window.localStorage) return allKeys
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: FilterKey[] = JSON.parse(raw)
      if (!parsed.includes("descanso_cct")) {
        parsed.push("descanso_cct")
      }
      return parsed
    }
  } catch { /* ignore */ }
  return allKeys
}

function saveFilters(filters: FilterKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
}

function getInstitutionalEvents(year: number, month: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // 1. Eventos institucionales del calendario oficial (pagos, interactivo, periodos vacacionales)
  const yearData = CALENDARIOS[year]
  if (yearData) {
    const monthData = yearData[month]
    if (monthData) {
      for (const [type, days] of Object.entries(monthData.events)) {
        if (!days) continue
        for (const d of days) {
          const t = type as CalendarEventType
          const filterType: FilterKey = PAYMENT_TYPES.has(t) ? "payments" : (t as FilterKey)
          events.push({
            id: `inst-${year}-${month}-${d}-${t}`,
            date: new Date(year, month, d),
            title: EVENT_LABELS[t],
            color: EVENT_COLORS[t] ?? "#64748b",
            type: filterType,
          })
        }
      }
    }
  }

  // 2. Días de Descanso Obligatorio contractuales del IMSS (CCT Cláusula 46 Fracción III)
  // Generados mediante reglas para cualquier año
  const mandatoryRestDays = getImssMandatoryRestDaysForMonth(year, month)
  for (const rd of mandatoryRestDays) {
    events.push({
      id: rd.id,
      date: new Date(rd.year, rd.month, rd.day),
      title: rd.title,
      color: "#6366f1",
      type: "descanso_cct",
      detail: rd.description,
      isMandatoryRest: true,
      clause: rd.clause,
      legalBasis: rd.legalBasis,
      dateStr: rd.date,
    })
  }

  return events
}

interface CalendarioLaboralProps {
  fullPage?: boolean
}

export function CalendarioLaboral({ fullPage = false }: CalendarioLaboralProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [filters, setFilters] = useState<FilterKey[]>(loadFilters)
  const [commitments, setCommitments] = useState<CalendarEvent[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingAgenda, setLoadingAgenda] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [selectedAgendaDate, setSelectedAgendaDate] = useSelectedAgendaDate()
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    if (selectedAgendaDate) {
      const [y, m, d] = selectedAgendaDate.split("-").map(Number)
      if (y === now.getFullYear() && m - 1 === now.getMonth()) return d
    }
    return fullPage ? now.getDate() : null
  })
  const [showAgendaFilters, setShowAgendaFilters] = useState(false)
  const [guardSubmitting, setGuardSubmitting] = useState(false)

  const handleSelectDay = useCallback((d: number) => {
    setSelectedDay(d)
    const padM = String(month + 1).padStart(2, "0")
    const padD = String(d).padStart(2, "0")
    setSelectedAgendaDate(`${year}-${padM}-${padD}`)
  }, [year, month, setSelectedAgendaDate])

  useEffect(() => {
    if (!selectedAgendaDate) return
    const [y, m, d] = selectedAgendaDate.split("-").map(Number)
    if (y === year && m - 1 === month) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external date selection
      setSelectedDay(d)
    }
  }, [selectedAgendaDate, year, month])

  const reloadCommitments = useCallback(async (uid: string | null) => {
    if (uid) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("worker_commitments")
        .select("*")
        .eq("user_id", uid)
        .eq("status", "active")

      if (error) {
        setAgendaError(error.message)
      } else if (data) {
        setCommitments(data.map((c) => {
          const start = new Date(c.start_at)
          const end = new Date(c.end_at)
          const isNightShift = start.getDate() !== end.getDate() && end.getHours() < start.getHours()
          const agendaType = (AGENDA_KEYS as string[]).includes(c.type) ? (c.type as FilterKey) : "other"
          const color = FILTER_DEFS.find((f) => f.key === agendaType)?.color ?? "#64748b"
          return {
            id: `agenda-${c.id}`,
            date: start,
            title: c.title,
            time: `${formatLocalTime(c.start_at)}–${formatLocalTime(c.end_at)}`,
            color,
            type: agendaType,
            detail: [c.service, c.substitute_worker_name ? `Cubres a ${c.substitute_worker_name}` : null, c.workplace].filter(Boolean).join(" · "),
            isNightShift,
            workplace: c.workplace ?? undefined,
            service: c.service ?? undefined,
            notes: c.notes ?? undefined,
          }
        }))
      }
    } else {
      // Local fallback
      const local = readAllLocal().filter((c) => c.status === "active")
      setCommitments(local.map((c) => {
        const start = new Date(c.startAt)
        const end = new Date(c.endAt)
        const isNightShift = start.getDate() !== end.getDate() && end.getHours() < start.getHours()
        const agendaType = (AGENDA_KEYS as string[]).includes(c.type) ? (c.type as FilterKey) : "other"
        const color = FILTER_DEFS.find((f) => f.key === agendaType)?.color ?? "#64748b"
        return {
          id: `agenda-${c.id}`,
          date: start,
          title: c.title,
          time: `${formatLocalTime(c.startAt)}–${formatLocalTime(c.endAt)}`,
          color,
          type: agendaType,
          detail: [c.service, c.substituteWorkerName ? `Cubres a ${c.substituteWorkerName}` : null, c.workplace].filter(Boolean).join(" · "),
          isNightShift,
          workplace: c.workplace,
          service: c.service,
          notes: c.notes,
        }
      }))
    }
    setLoadingAgenda(false)
  }, [setAgendaError, setCommitments, setLoadingAgenda])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null
      setUserId(uid)
      reloadCommitments(uid)
    })
  }, [reloadCommitments])

  const onCommitmentsUpdated = useCallback(() => {
    reloadCommitments(userId)
  }, [reloadCommitments, userId])

  useCommitmentsListener(onCommitmentsUpdated)

  const toggleFilter = (key: FilterKey) => {
    setFilters((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      saveFilters(next)
      return next
    })
  }

  const toggleAgendaFilters = () => {
    setShowAgendaFilters((prev) => !prev)
  }

  const toggleAll = () => {
    setFilters((prev) => {
      const all = FILTER_DEFS.map((f) => f.key)
      const next = prev.length === all.length ? [] : all
      saveFilters(next)
      return next
    })
  }

  const handleSaveGuard = async (params: {
    date: Date
    title: string
    startHour: string
    endHour: string
    service?: string
    workplace?: string
    notes?: string
    isNightShift?: boolean
  }) => {
    setGuardSubmitting(true)
    try {
      const y = params.date.getFullYear()
      const m = params.date.getMonth()
      const d = params.date.getDate()

      const [sH, sM] = params.startHour.split(":").map(Number)
      const [eH, eM] = params.endHour.split(":").map(Number)

      const startAt = new Date(y, m, d, sH || 7, sM || 0, 0).toISOString()
      const endDate = params.isNightShift ? new Date(y, m, d + 1, eH || 8, eM || 0, 0) : new Date(y, m, d, eH || 15, eM || 0, 0)
      const endAt = endDate.toISOString()

      if (userId) {
        const supabase = createClient()
        await supabase.from("worker_commitments").insert({
          user_id: userId,
          type: "guardia_festiva",
          title: `Guardia: ${params.title}`,
          start_at: startAt,
          end_at: endAt,
          service: params.service || "Guardia CCT Cl. 45",
          workplace: params.workplace || undefined,
          notes: params.notes || undefined,
          status: "active",
          reminder_day_before: true,
          reminder_hours_before: true,
          reminder_at_start: true,
        })
      } else {
        addLocalCommitment({
          userId: "local-user",
          type: "guardia_festiva",
          title: `Guardia: ${params.title}`,
          startAt,
          endAt,
          service: params.service || "Guardia CCT Cl. 45",
          workplace: params.workplace || "",
          substituteWorkerName: "",
          notes: params.notes || "",
          reminder: { dayBefore: true, hoursBefore: true, atStart: true },
          status: "active",
        })
      }
      await reloadCommitments(userId)
      notifyCommitmentsChanged()
    } finally {
      setGuardSubmitting(false)
    }
  }

  const handleRemoveGuard = async (commitmentId: string) => {
    setGuardSubmitting(true)
    try {
      const rawId = commitmentId.replace("agenda-", "")
      if (userId) {
        const supabase = createClient()
        await supabase.from("worker_commitments").delete().eq("id", rawId)
      } else {
        deleteLocalCommitment(rawId)
      }
      await reloadCommitments(userId)
      notifyCommitmentsChanged()
    } finally {
      setGuardSubmitting(false)
    }
  }

  const agendaActive = useMemo(() => AGENDA_KEYS.some((key) => filters.includes(key)), [filters])

  const allEvents = useMemo(() => {
    const inst = getInstitutionalEvents(year, month)
    const agenda = commitments.filter((c) => c.date.getMonth() === month && c.date.getFullYear() === year)

    // Fusionar y verificar si un descanso contractual tiene guardia asignada
    const merged: CalendarEvent[] = []

    for (const item of inst) {
      if (item.type === "descanso_cct") {
        const matchingGuard = agenda.find(
          (a) => a.type === "guardia_festiva" && a.date.getDate() === item.date.getDate()
        )
        if (matchingGuard) {
          item.hasUserGuard = true
          item.guardCommitmentId = matchingGuard.id
        }
      }
      merged.push(item)
    }

    for (const item of agenda) {
      merged.push(item)
    }

    return merged
      .filter((e) => filters.includes(e.type))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [year, month, commitments, filters])

  const selectedEvents = selectedDay
    ? allEvents.filter((e) => e.date.getDate() === selectedDay)
    : []

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = new Date(year, month, 1).getDay() === 0 ? 6 : new Date(year, month, 1).getDay() - 1

  const dayEvents = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (const e of allEvents) {
      const d = e.date.getDate()
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return map
  }, [allEvents])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }

  const isToday = (d: number) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear()

  const allFilterKeys = FILTER_DEFS.map((f) => f.key)
  const allActive = filters.length === allFilterKeys.length

  const renderFilters = (compact?: boolean) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: compact ? 0 : "var(--space-4)" }}>
      <FilterChip active={allActive} onClick={toggleAll} color="var(--primary)" compact={compact}>
        Todos
      </FilterChip>
      {FILTER_DEFS.filter((f) => f.group === "institucional").map((f) => (
        <FilterChip key={f.key} active={filters.includes(f.key)} onClick={() => toggleFilter(f.key)} color={f.color} compact={compact}>
          {f.label}
        </FilterChip>
      ))}
      <FilterChip
        active={agendaActive}
        onClick={toggleAgendaFilters}
        onCaretClick={() => setShowAgendaFilters(!showAgendaFilters)}
        color="var(--brand-cyan)"
        aria-expanded={showAgendaFilters}
        compact={compact}
        hasSubmenu
      >
        Mi agenda
      </FilterChip>
      {showAgendaFilters && FILTER_DEFS.filter((f) => f.group === "agenda").map((f) => (
        <FilterChip key={f.key} active={filters.includes(f.key)} onClick={() => toggleFilter(f.key)} color={f.color} compact={compact}>
          {f.label}
        </FilterChip>
      ))}
      {loadingAgenda && <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", alignSelf: "center" }}>Cargando...</span>}
      {agendaError && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", alignSelf: "center", display: "flex", alignItems: "center", gap: "0.25rem" }}><Warning size={12} /> Agenda no disponible</span>}
    </div>
  )

  if (fullPage) {
    return (
      <div>
        {renderFilters()}
        <CalendarGrid year={year} month={month} prevMonth={prevMonth} nextMonth={nextMonth} startOffset={startOffset} daysInMonth={daysInMonth} dayEvents={dayEvents} selectedDay={selectedDay} setSelectedDay={handleSelectDay} isToday={isToday} />
        <DayDetail
          year={year}
          month={month}
          day={selectedDay}
          events={selectedEvents}
          onSaveGuard={handleSaveGuard}
          onRemoveGuard={handleRemoveGuard}
          submitting={guardSubmitting}
        />
      </div>
    )
  }

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem",
      }}>
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--muted)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Calendario laboral
        </span>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {FILTER_DEFS.filter((f) => f.group === "institucional").map((f) => (
            <FilterChip key={f.key} active={filters.includes(f.key)} onClick={() => toggleFilter(f.key)} color={f.color} compact>
              {f.label}
            </FilterChip>
          ))}
          <FilterChip
            active={agendaActive}
            onClick={toggleAgendaFilters}
            color="var(--brand-cyan)"
            aria-expanded={showAgendaFilters}
            compact
            hasSubmenu
          >
            Agenda
          </FilterChip>
          {showAgendaFilters && FILTER_DEFS.filter((f) => f.group === "agenda").map((f) => (
            <FilterChip key={f.key} active={filters.includes(f.key)} onClick={() => toggleFilter(f.key)} color={f.color} compact>
              {f.label}
            </FilterChip>
          ))}
          <Link href="/calendario" style={{ fontSize: "var(--text-xs)", color: "var(--primary)", textDecoration: "none", marginLeft: "0.25rem" }}>
            Ver completo
          </Link>
        </div>
      </div>

      <div className="calendario-dashboard-grid" style={{
        display: "flex", gap: "1rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
      }}>
        <div style={{ flex: "3", minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <CalendarGrid year={year} month={month} prevMonth={prevMonth} nextMonth={nextMonth} startOffset={startOffset} daysInMonth={daysInMonth} dayEvents={dayEvents} selectedDay={selectedDay} setSelectedDay={handleSelectDay} isToday={isToday} compact />
        </div>
        <div style={{ flex: "2", minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <DayDetail
            year={year}
            month={month}
            day={selectedDay}
            events={selectedEvents}
            onSaveGuard={handleSaveGuard}
            onRemoveGuard={handleRemoveGuard}
            submitting={guardSubmitting}
            compact
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .calendario-dashboard-grid { flex-direction: column; }
        }
      `}</style>
    </div>
  )
}

function FilterChip({ active, onClick, onCaretClick, color, children, compact, hasSubmenu, "aria-expanded": ariaExpanded }: {
  active: boolean; onClick: () => void; onCaretClick?: () => void; color: string; children: React.ReactNode;
  compact?: boolean; hasSubmenu?: boolean; "aria-expanded"?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-pill)", border: `1.5px solid ${active ? color : "var(--border)"}`, background: active ? `${color}15` : "var(--card)" }}>
      <button
        onClick={onClick}
        aria-pressed={active}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.25rem",
          padding: compact ? "0.25rem 0.5rem" : "0.375rem 0.75rem",
          border: "none", background: "none",
          color: active ? color : "var(--muted)",
          fontSize: "var(--text-xs)", fontWeight: active ? 600 : 400,
          cursor: "pointer", fontFamily: "inherit",
          borderRadius: "var(--radius-pill)", whiteSpace: "nowrap",
        }}
      >
        {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />}
        {children}
      </button>
      {hasSubmenu && (
        <button
          onClick={onCaretClick}
          aria-expanded={ariaExpanded}
          aria-label={ariaExpanded ? "Ocultar subfiltros" : "Mostrar subfiltros"}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "none", background: "none", cursor: "pointer", padding: "0 0.375rem 0 0.125rem",
            color: "var(--muted)", fontSize: "0.625rem",
          }}
        >
          {ariaExpanded ? <CaretLeft size={10} style={{ transform: "rotate(90deg)" }} /> : <CaretLeft size={10} style={{ transform: "rotate(-90deg)" }} />}
        </button>
      )}
    </span>
  )
}

function CalendarGrid({ year, month, prevMonth, nextMonth, startOffset, daysInMonth, dayEvents, selectedDay, setSelectedDay, isToday, compact }: {
  year: number; month: number; prevMonth: () => void; nextMonth: () => void;
  startOffset: number; daysInMonth: number; dayEvents: Map<number, CalendarEvent[]>;
  selectedDay: number | null; setSelectedDay: (d: number) => void; isToday: (d: number) => boolean; compact?: boolean;
}) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: compact ? "0.75rem" : "1.25rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <button onClick={prevMonth} aria-label="Mes anterior" style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem", borderRadius: "var(--radius-sm)", color: "var(--fg)" }}>
          <CaretLeft size={18} />
        </button>
        <span style={{ fontSize: compact ? "0.875rem" : "1rem", fontWeight: 700 }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} aria-label="Mes siguiente" style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem", borderRadius: "var(--radius-sm)", color: "var(--fg)" }}>
          <CaretRight size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "2px" }}>
        {DAY_HEADERS.map((d, idx) => (
          <div key={`day-${idx}`} style={{ textAlign: "center", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", padding: "0.25rem 0", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} style={{ aspectRatio: "1", minHeight: compact ? 36 : 44 }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const events = dayEvents.get(d) ?? []
          const today = isToday(d)
          const hasInteractivo = events.some((e) => e.type === "interactivo")
          const hasMandatoryRest = events.some((e) => e.type === "descanso_cct")
          const hasGuard = events.some((e) => e.type === "guardia_festiva" || e.hasUserGuard)
          const active = selectedDay === d

          let bg = "transparent"
          if (hasInteractivo) bg = EVENT_COLORS.interactivo
          else if (active) bg = "var(--accent)"

          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              aria-label={`${d} de ${MONTH_NAMES[month]}, ${events.length} eventos`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "1px",
                aspectRatio: "1", minHeight: compact ? 36 : 44,
                background: bg,
                border: today ? "2px solid var(--primary)" : hasGuard ? "2px dashed #ec4899" : hasMandatoryRest ? "1px solid #818cf8" : active ? "1px solid var(--border)" : "none",
                borderRadius: "var(--radius-sm)", cursor: "pointer",
                color: hasInteractivo ? "#0f172a" : "var(--fg)",
                fontFamily: "inherit", fontSize: compact ? "0.75rem" : "0.8125rem",
                fontWeight: today || hasMandatoryRest ? 700 : 400,
                position: "relative",
              }}
            >
              <span>{d}</span>
              {events.length > 0 && !hasInteractivo && (
                <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
                  {events.slice(0, 3).map((e, j) => (
                    <span key={j} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: e.color, display: "inline-block",
                    }} />
                  ))}
                  {events.length > 3 && <span style={{ fontSize: "0.5rem", color: "var(--muted)" }}>+{events.length - 3}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayDetail({
  year,
  month,
  day,
  events,
  onSaveGuard,
  onRemoveGuard,
  submitting,
  compact,
}: {
  year: number
  month: number
  day: number | null
  events: CalendarEvent[]
  onSaveGuard: (params: {
    date: Date
    title: string
    startHour: string
    endHour: string
    service?: string
    workplace?: string
    notes?: string
    isNightShift?: boolean
  }) => Promise<void>
  onRemoveGuard: (id: string) => Promise<void>
  submitting: boolean
  compact?: boolean
}) {
  const [showGuardForm, setShowGuardForm] = useState(false)
  const [selectedShift, setSelectedShift] = useState<"matutino" | "vespertino" | "nocturno" | "custom">("matutino")
  const [startHour, setStartHour] = useState("07:00")
  const [endHour, setEndHour] = useState("15:00")
  const [service, setService] = useState("")

  if (!day || events.length === 0) {
    return (
      <div style={{
        padding: "var(--space-4)", color: "var(--muted)", fontSize: compact ? "var(--text-xs)" : "var(--text-sm)",
        textAlign: "center", background: compact ? "none" : "var(--card)",
        border: compact ? "none" : "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        marginTop: compact ? 0 : "var(--space-4)",
      }}>
        {compact ? "Selecciona un día" : "Selecciona un día para ver sus eventos"}
      </div>
    )
  }

  const selectedDate = new Date(year, month, day)
  const dateLabel = selectedDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()

  const mandatoryRestEvent = events.find((e) => e.type === "descanso_cct")
  const guardEvent = events.find((e) => e.type === "guardia_festiva" || e.hasUserGuard)

  const handleShiftChange = (shift: "matutino" | "vespertino" | "nocturno" | "custom") => {
    setSelectedShift(shift)
    if (shift === "matutino") {
      setStartHour("07:00")
      setEndHour("15:00")
    } else if (shift === "vespertino") {
      setStartHour("14:00")
      setEndHour("21:30")
    } else if (shift === "nocturno") {
      setStartHour("21:00")
      setEndHour("08:00")
    }
  }

  const handleConfirmGuard = async () => {
    if (!mandatoryRestEvent) return
    await onSaveGuard({
      date: selectedDate,
      title: mandatoryRestEvent.title,
      startHour,
      endHour,
      service,
      notes: undefined,
      isNightShift: selectedShift === "nocturno",
    })
    setShowGuardForm(false)
  }

  return (
    <div style={{ marginTop: compact ? 0 : "var(--space-4)", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
        {dateLabel}
      </div>

      {/* Tarjeta de Descanso Obligatorio CCT si aplica */}
      {mandatoryRestEvent && (
        <div style={{
          padding: compact ? "0.75rem" : "1rem",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02))",
          border: "1.5px solid #818cf8",
          borderRadius: "var(--radius-md)",
          marginBottom: "0.75rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.375rem" }}>
            <span style={{
              fontSize: "0.6875rem", fontWeight: 700, color: "#4f46e5",
              background: "#e0e7ff", padding: "0.125rem 0.5rem", borderRadius: "9999px",
              display: "inline-flex", alignItems: "center", gap: "0.25rem",
            }}>
              <ShieldCheck size={13} weight="bold" /> Descanso CCT (Cláusula 46-III)
            </span>
            {guardEvent && (
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700, color: "#be185d",
                background: "#fce7f3", padding: "0.125rem 0.5rem", borderRadius: "9999px",
                display: "inline-flex", alignItems: "center", gap: "0.25rem",
              }}>
                <Check size={12} weight="bold" /> Mi guardia confirmada
              </span>
            )}
          </div>

          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
            {mandatoryRestEvent.title}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: "0.5rem", lineHeight: 1.4 }}>
            {mandatoryRestEvent.detail}
          </div>

          {/* Ficha normativa de derechos contractuales */}
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "0.5rem 0.625rem",
            fontSize: "0.6875rem", color: "var(--muted)", marginBottom: "0.75rem",
            display: "flex", flexDirection: "column", gap: "0.25rem",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.375rem" }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: "var(--primary)" }} />
              <span><strong>Cláusula 45 CCT:</strong> Los roles de guardia deben formularse de común acuerdo y comunicarse al trabajador con al menos 45 días de anticipación.</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.375rem" }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: "#16a34a" }} />
              <span><strong>Cláusula 33 CCT:</strong> Pago de salario triple si se labora el descanso obligatorio (salario cuádruple si coincide con el descanso semanal).</span>
            </div>
          </div>

          {/* Control de Guardia Personal */}
          {!guardEvent && !showGuardForm && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowGuardForm(true)}
              style={{ width: "100%", justifyContent: "center", borderColor: "#818cf8", color: "#4f46e5" }}
            >
              <Plus size={14} />
              Tengo guardia asignada este día
            </Button>
          )}

          {/* Formulario de registro de guardia */}
          {showGuardForm && !guardEvent && (
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: "0.75rem",
              marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem",
            }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--fg)" }}>
                Registrar horario de guardia
              </div>

              {/* Selector de turno rápido */}
              <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                {(["matutino", "vespertino", "nocturno", "custom"] as const).map((shift) => (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => handleShiftChange(shift)}
                    style={{
                      flex: "1 1 60px",
                      padding: "0.25rem 0.375rem",
                      fontSize: "0.6875rem",
                      fontWeight: selectedShift === shift ? 700 : 500,
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${selectedShift === shift ? "var(--primary)" : "var(--border)"}`,
                      background: selectedShift === shift ? "var(--accent)" : "transparent",
                      color: selectedShift === shift ? "var(--primary)" : "var(--fg)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {shift === "custom" ? "Personalizado" : shift}
                  </button>
                ))}
              </div>

              {/* Horario */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ fontSize: "0.625rem", color: "var(--muted)", display: "block", marginBottom: 2 }}>Entrada</label>
                  <input
                    type="time"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    style={{
                      width: "100%", padding: "0.375rem", fontSize: "var(--text-xs)",
                      borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                      background: "var(--bg)", color: "var(--fg)", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.625rem", color: "var(--muted)", display: "block", marginBottom: 2 }}>Salida</label>
                  <input
                    type="time"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    style={{
                      width: "100%", padding: "0.375rem", fontSize: "var(--text-xs)",
                      borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                      background: "var(--bg)", color: "var(--fg)", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Servicio o Notas */}
              <div>
                <label style={{ fontSize: "0.625rem", color: "var(--muted)", display: "block", marginBottom: 2 }}>Servicio o Adscripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Urgencias, Piso 3, Triage..."
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  style={{
                    width: "100%", padding: "0.375rem", fontSize: "var(--text-xs)",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                    background: "var(--bg)", color: "var(--fg)", boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
                <Button
                  size="sm"
                  loading={submitting}
                  onClick={handleConfirmGuard}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  Confirmar mi guardia
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGuardForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Desmarcar guardia si ya existe */}
          {guardEvent && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
              <Button
                variant="ghost"
                size="sm"
                loading={submitting}
                onClick={() => onRemoveGuard(guardEvent.guardCommitmentId || guardEvent.id)}
                style={{ color: "var(--error)", fontSize: "0.6875rem" }}
              >
                <Trash size={12} />
                Desmarcar guardia (conservar día de descanso)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lista de eventos del día */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {events
          .filter((e) => e.type !== "descanso_cct") // Ya mostrado arriba de forma destacada
          .map((e) => (
            <div key={e.id} style={{
              padding: compact ? "0.5rem 0.75rem" : "0.625rem 0.875rem",
              background: "var(--card)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${e.color}`,
              borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.125rem" }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: e.color, display: "inline-block", flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600 }}>{e.title}</span>
              </div>
              {e.time && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  <Clock size={11} />
                  {e.time}
                  {e.isNightShift && " (nocturno)"}
                </div>
              )}
              {e.detail && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  <MapPin size={11} />
                  <span>{e.detail}</span>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
