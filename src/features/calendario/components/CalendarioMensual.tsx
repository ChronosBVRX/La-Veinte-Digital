"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Calendar } from "lucide-react"
import { getMonthData, getDayEvents, EVENT_COLORS, EVENT_LABELS, type CalendarEventType, CALENDARIOS } from "@/features/calendario/services/calendarioData"
import { CalendarioExportButton } from "@/features/calendario/components/CalendarioExportButton"

const DAYS_OF_WEEK = ["L", "M", "M", "J", "V", "S", "D"]

const EVENT_ABBR: Record<CalendarEventType, string> = {
  interactivo: "",
  vacacional: "V",
  santander: "S",
  otros: "B",
  cheque: "C",
  jubilados: "J",
}

export function CalendarioMensual() {
  const now = useMemo(() => new Date(), [])
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const yearData = CALENDARIOS[year] ?? CALENDARIOS[2026]
  const displayYear = yearData ? year : 2026
  const monthData = getMonthData(displayYear, monthIndex)

  const firstDayOfMonth = new Date(displayYear, monthIndex, 1).getDay()
  const daysInMonth = new Date(displayYear, monthIndex + 1, 0).getDate()
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  if (!monthData) return null

  const days: { day: number; events: ReturnType<typeof getDayEvents> }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, events: getDayEvents(displayYear, monthIndex, d) })
  }

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "1.25rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={18} style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            {monthData.month} {displayYear}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CalendarioExportButton year={displayYear} monthIndex={monthIndex} label="Exportar" />
          <Link
            href="/calendario"
            style={{
              fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none",
              display: "flex", alignItems: "center", gap: "0.25rem",
            }}
          >
            Ver completo
            <span style={{ fontSize: "1rem" }}>→</span>
          </Link>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px",
        marginBottom: "2px",
      }}>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} style={{
            textAlign: "center", fontSize: "0.6875rem", fontWeight: 600,
            color: "var(--muted)", padding: "0.25rem 0", textTransform: "uppercase",
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px",
      }}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(({ day, events }) => {
          const hasInteractivo = events.some((e) => e.type === "interactivo")
          const otherEvents = events.filter((e) => e.type !== "interactivo")

          return (
            <div
              key={day}
              title={events.length > 0 ? events.map((e) => e.label).join(", ") : undefined}
              style={{
                textAlign: "center", padding: "0.375rem 0.125rem",
                borderRadius: "var(--radius-sm)", fontSize: "0.8125rem",
                fontWeight: hasInteractivo ? 600 : 500,
                background: hasInteractivo ? EVENT_COLORS.interactivo : events.length > 0 ? "var(--accent)" : "transparent",
                color: hasInteractivo ? "#0f172a" : undefined,
              }}
            >
              <span style={{ lineHeight: 1.5 }}>{day}</span>
              {otherEvents.length > 0 && (
                <div style={{
                  display: "flex", justifyContent: "center", gap: "2px",
                  marginTop: "2px", flexWrap: "wrap",
                }}>
                  {otherEvents.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      title={e.label}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 14, height: 14, borderRadius: "3px",
                        background: EVENT_COLORS[e.type],
                        color: "#fff", fontSize: "0.5rem", fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {EVENT_ABBR[e.type]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.375rem 0.75rem",
        marginTop: "0.75rem", paddingTop: "0.75rem",
        borderTop: "1px solid var(--border)",
      }}>
        {(Object.entries(EVENT_LABELS) as [CalendarEventType, string][]).map(([type, label]) => (
          <div key={type} style={{
            display: "flex", alignItems: "center", gap: "0.25rem",
            fontSize: "0.6875rem", color: "var(--muted)",
          }}>
            {type === "interactivo" ? (
              <span style={{
                display: "inline-block", width: 10, height: 10,
                borderRadius: "2px", background: EVENT_COLORS[type],
              }} />
            ) : (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 12, height: 12, borderRadius: "2px",
                background: EVENT_COLORS[type],
                color: "#fff", fontSize: "0.4375rem", fontWeight: 700,
              }}>
                {EVENT_ABBR[type]}
              </span>
            )}
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
