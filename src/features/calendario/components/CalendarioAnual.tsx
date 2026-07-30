import { CALENDARIO_2026, getDayEvents, EVENT_COLORS, EVENT_LABELS, type CalendarEventType } from "@/features/calendario/services/calendarioData"

const DAYS_OF_WEEK = ["L", "M", "M", "J", "V", "S", "D"]

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
        {days.map(({ day, events }) => (
          <div
            key={day}
            style={{
              textAlign: "center", padding: "0.125rem 0",
              borderRadius: "2px", fontSize: "0.625rem",
              fontWeight: 500,
              background: events.length > 0 ? "var(--accent)" : "transparent",
            }}
          >
            {day}
            {events.length > 0 && (
              <div style={{
                display: "flex", justifyContent: "center", gap: "1px",
                marginTop: "1px",
              }}>
                {events.slice(0, 3).map((e, i) => (
                  <span
                    key={i}
                    title={e.label}
                    style={{
                      display: "inline-block", width: 4, height: 4,
                      borderRadius: "50%", background: EVENT_COLORS[e.type],
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
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
              <span style={{
                display: "inline-block", width: 12, height: 12,
                borderRadius: "3px", background: EVENT_COLORS[type],
              }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
