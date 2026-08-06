"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { CaretLeft, CaretRight, Clock, MapPin, Warning } from "@phosphor-icons/react"
import Link from "next/link"
import { CALENDARIOS, EVENT_LABELS, EVENT_COLORS } from "@/shared/data/calendario"
import type { CalendarEventType } from "@/shared/data/calendario"
import { createClient } from "@/lib/supabase/client"
import { CalendarioExportButton } from "@/features/calendario/components/CalendarioExportButton"

const STORAGE_KEY = "calendar_filters_v1"

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"]

const PAYMENT_TYPES = new Set<CalendarEventType>(["santander", "otros", "cheque", "jubilados"])

type FilterKey = "payments" | "interactivo" | "vacacional" | "txt_substitution" | "overtime" | "shift_change" | "other"

const AGENDA_KEYS: FilterKey[] = ["txt_substitution", "overtime", "shift_change", "other"]

const FILTER_DEFS: { key: FilterKey; label: string; color: string; group: "institucional" | "agenda" }[] = [
  { key: "payments", label: "Pagos", color: "#ef4444", group: "institucional" },
  { key: "interactivo", label: "Interactivo", color: "#eab308", group: "institucional" },
  { key: "vacacional", label: "Vacaciones", color: "#22c55e", group: "institucional" },
  { key: "txt_substitution", label: "TxT", color: "#3b82f6", group: "agenda" },
  { key: "overtime", label: "T. extra", color: "#f97316", group: "agenda" },
  { key: "shift_change", label: "Turno", color: "#8b5cf6", group: "agenda" },
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
}

function loadFilters(): FilterKey[] {
  if (typeof window === "undefined") return FILTER_DEFS.map((f) => f.key)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return FILTER_DEFS.map((f) => f.key)
}

function saveFilters(filters: FilterKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
}

function getInstitutionalEvents(year: number, month: number): CalendarEvent[] {
  const yearData = CALENDARIOS[year]
  if (!yearData) return []
  const monthData = yearData[month]
  if (!monthData) return []

  const events: CalendarEvent[] = []
  for (const [type, days] of Object.entries(monthData.events)) {
    if (!days) continue
    for (const d of days) {
      const t = type as CalendarEventType
      const filterType: FilterKey = PAYMENT_TYPES.has(t) ? "payments" : (t as FilterKey)
      events.push({
        id: `inst-${year}-${month}-${d}-${t}`,
        date: new Date(year, month, d),
        title: EVENT_LABELS[t],
        color: EVENT_COLORS[t],
        type: filterType,
      })
    }
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
  const [loadingAgenda, setLoadingAgenda] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(fullPage ? now.getDate() : null)
  const [showAgendaFilters, setShowAgendaFilters] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingAgenda(false); return }
      supabase
        .from("worker_commitments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .then(({ data, error }) => {
          if (error) {
            setAgendaError(error.message)
          } else if (data) {
            setCommitments(data.map((c) => {
              const start = new Date(c.start_at)
              const end = new Date(c.end_at)
              const isNightShift = start.getDate() !== end.getDate() && end.getHours() < start.getHours()
              const typeMap: Record<string, FilterKey> = {
                txt_substitution: "txt_substitution",
                overtime: "overtime",
                shift_change: "shift_change",
                other: "other",
              }
              const agendaType = typeMap[c.type] ?? "other"
              const color = FILTER_DEFS.find((f) => f.key === agendaType)?.color ?? "#64748b"
              return {
                id: `agenda-${c.id}`,
                date: start,
                title: c.title,
                time: `${start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`,
                color,
                type: agendaType,
                detail: [c.service, c.substitute_worker_name ? `Cubres a ${c.substitute_worker_name}` : null, c.workplace].filter(Boolean).join(" · "),
                isNightShift,
              }
            }))
          }
          setLoadingAgenda(false)
        })
    })
  }, [])

  const toggleFilter = useCallback((key: FilterKey) => {
    setFilters((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      saveFilters(next)
      return next
    })
  }, [])

  const toggleAgendaFilters = useCallback(() => {
    setShowAgendaFilters((prev) => !prev)
  }, [])

  const toggleAll = useCallback(() => {
    setFilters((prev) => {
      const all = FILTER_DEFS.map((f) => f.key)
      const next = prev.length === all.length ? [] : all
      saveFilters(next)
      return next
    })
  }, [])

  const agendaActive = useMemo(() => AGENDA_KEYS.some((key) => filters.includes(key)), [filters])

  const allEvents = useMemo(() => {
    const inst = getInstitutionalEvents(year, month)
    const agenda = commitments.filter((c) => c.date.getMonth() === month && c.date.getFullYear() === year)
    const merged = [...inst, ...agenda]
      .filter((e) => filters.includes(e.type))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    return merged
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
        <CalendarGrid year={year} month={month} prevMonth={prevMonth} nextMonth={nextMonth} startOffset={startOffset} daysInMonth={daysInMonth} dayEvents={dayEvents} selectedDay={selectedDay} setSelectedDay={setSelectedDay} isToday={isToday} />
        <DayDetail events={selectedEvents} />
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
        display: "flex", gap: "1rem",
      }}>
        <div style={{ flex: "3", minWidth: 0 }}>
          <CalendarGrid year={year} month={month} prevMonth={prevMonth} nextMonth={nextMonth} startOffset={startOffset} daysInMonth={daysInMonth} dayEvents={dayEvents} selectedDay={selectedDay} setSelectedDay={setSelectedDay} isToday={isToday} compact />
        </div>
        <div style={{ flex: "2", minWidth: 180 }}>
          <DayDetail events={selectedEvents} compact />
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
        {DAY_HEADERS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", padding: "0.25rem 0", textTransform: "uppercase" }}>
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
          const active = selectedDay === d

          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              aria-label={`${d} de ${MONTH_NAMES[month]}, ${events.length} eventos`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "1px",
                aspectRatio: "1", minHeight: compact ? 36 : 44,
                background: hasInteractivo ? EVENT_COLORS.interactivo : active ? "var(--accent)" : "transparent",
                border: today ? "2px solid var(--primary)" : active ? "1px solid var(--border)" : "none",
                borderRadius: "var(--radius-sm)", cursor: "pointer",
                color: hasInteractivo ? "#0f172a" : "var(--fg)",
                fontFamily: "inherit", fontSize: compact ? "0.75rem" : "0.8125rem",
                fontWeight: today ? 700 : 400,
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

function DayDetail({ events, compact }: { events: CalendarEvent[]; compact?: boolean }) {
  if (events.length === 0)
    return (
      <div style={{ padding: "var(--space-4)", color: "var(--muted)", fontSize: compact ? "var(--text-xs)" : "var(--text-sm)", textAlign: "center", background: compact ? "none" : "var(--card)", border: compact ? "none" : "1px solid var(--border)", borderRadius: "var(--radius-lg)", marginTop: compact ? 0 : "var(--space-4)" }}>
        {compact ? "Selecciona un día" : "Selecciona un día para ver sus eventos"}
      </div>
    )

  const ref = events[0]
  const dateLabel = ref.date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()

  return (
    <div style={{ marginTop: compact ? 0 : "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
        {dateLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {events.map((e) => (
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
