import { CALENDARIO_2026, getDayEvents, EVENT_COLORS, EVENT_LABELS, type CalendarEventType } from "@/features/calendario/services/calendarioData"

const DAYS_OF_WEEK = ["L", "M", "M", "J", "V", "S", "D"]

const EVENT_ABBR: Record<CalendarEventType, string> = {
  interactivo: "",
  vacacional: "V",
  santander: "S",
  otros: "B",
  cheque: "C",
  jubilados: "J",
}

function MonthCalendar({ monthIndex }: { monthIndex: number }) {
  const year = 2026
  const monthData = CALENDARIO_2026[monthIndex]
  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const days: { day: number; events: ReturnType<typeof getDayEvents> }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, events: getDayEvents(monthIndex, d) })
  }

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "0.75rem",
    }}>
      <h3 style={{
        fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.5rem",
        textAlign: "center", color: "var(--primary)",
      }}>
        {monthData.month}
      </h3>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px",
        marginBottom: "2px",
      }}>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} style={{
            textAlign: "center", fontSize: "0.5625rem", fontWeight: 600,
            color: "var(--muted)", padding: "0.125rem 0", textTransform: "uppercase",
          }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px",
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
                textAlign: "center", padding: "0.125rem 0",
                borderRadius: "2px", fontSize: "0.625rem",
                fontWeight: hasInteractivo ? 700 : 500,
                background: hasInteractivo ? EVENT_COLORS.interactivo : events.length > 0 ? "var(--accent)" : "transparent",
                color: hasInteractivo ? "#0f172a" : undefined,
              }}
            >
              {day}
              {otherEvents.length > 0 && (
                <div style={{
                  display: "flex", justifyContent: "center", gap: "1px",
                  marginTop: "1px",
                }}>
                  {otherEvents.slice(0, 2).map((e, i) => (
                    <span
                      key={i}
                      title={e.label}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 10, height: 10, borderRadius: "2px",
                        background: EVENT_COLORS[e.type],
                        color: "#fff", fontSize: "0.4375rem", fontWeight: 700,
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
    </div>
  )
}

export function CalendarioAnual() {
  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: "1rem",
      }}>
        {CALENDARIO_2026.map((_, i) => (
          <MonthCalendar key={i} monthIndex={i} />
        ))}
      </div>

      <div style={{
        marginTop: "1.5rem", padding: "1rem",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
          Calendario IMSS 2026 — Código de colores
        </h3>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.75rem 1.5rem",
        }}>
          {(Object.entries(EVENT_LABELS) as [CalendarEventType, string][]).map(([type, label]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem" }}>
              {type === "interactivo" ? (
                <span style={{
                  display: "inline-block", width: 14, height: 14,
                  borderRadius: "3px", background: EVENT_COLORS[type],
                }} />
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, height: 16, borderRadius: "3px",
                  background: EVENT_COLORS[type],
                  color: "#fff", fontSize: "0.5625rem", fontWeight: 700,
                }}>
                  {EVENT_ABBR[type]}
                </span>
              )}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
