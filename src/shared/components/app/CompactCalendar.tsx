"use client"

import { CalendarDots } from "@phosphor-icons/react"
import Link from "next/link"
import { CALENDARIOS, EVENT_LABELS, EVENT_COLORS } from "@/shared/data/calendario"
import type { CalendarEventType } from "@/shared/data/calendario"

interface CompactEvent {
  date: Date
  label: string
  type: CalendarEventType
}

function getUpcomingEvents(limit = 3): CompactEvent[] {
  const now = new Date()
  const year = now.getFullYear()
  const yearData = CALENDARIOS[year]
  if (!yearData) return []

  const candidates: CompactEvent[] = []

  const relevant: CalendarEventType[] = ["santander", "interactivo", "vacacional"]

  for (let mi = now.getMonth(); mi < yearData.length && candidates.length < limit; mi++) {
    const m = yearData[mi]
    for (const type of relevant) {
      const days = m.events[type]
      if (!days) continue
      for (const d of days) {
        const date = new Date(year, mi, d)
        if (date >= now) {
          candidates.push({ date, label: EVENT_LABELS[type], type })
          if (candidates.length >= limit) return candidates
        }
      }
    }
  }

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates.slice(0, limit)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

export function CompactCalendar() {
  const events = getUpcomingEvents(4)

  if (events.length === 0) return null

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <span style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          Próximas fechas
        </span>
        <Link
          href="/calendario"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          Ver calendario completo
        </Link>
      </div>

      <div style={{
        display: "flex",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}>
        {events.map((ev, i) => (
          <div
            key={i}
            style={{
              flex: "1 1 auto",
              minWidth: 140,
              padding: "0.625rem 0.875rem",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CalendarDots size={18} weight="fill" color={EVENT_COLORS[ev.type]} />
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--fg)" }}>
                {formatDate(ev.date)}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                {ev.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
