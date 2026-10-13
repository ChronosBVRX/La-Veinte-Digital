import { CalendarDots, Clock, MapPin, ArrowClockwise, Info } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { DateItem } from "@/lib/caja/models"

interface CajaDatesCardProps {
  dates: DateItem[]
  loading: boolean
  onRefresh: () => void
}

export function CajaDatesCard({ dates, loading, onRefresh }: CajaDatesCardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CalendarDots size={22} color="var(--primary)" weight="bold" />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
              Citas Agendadas (Consulta)
            </h2>
          </div>

          <Button variant="outline" size="sm" onClick={onRefresh} loading={loading} leadingIcon={<ArrowClockwise size={16} />}>
            Actualizar
          </Button>
        </div>

        {/* Citas registradas */}
        <div>
          {loading ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem" }}>
              Consultando citas en Caja SNTSS...
            </div>
          ) : dates.length === 0 ? (
            <div
              style={{
                padding: "1.5rem",
                textAlign: "center",
                background: "var(--accent)",
                borderRadius: "var(--radius-md)",
                color: "var(--muted)",
                fontSize: "0.8125rem",
              }}
            >
              No tienes citas programadas registradas en este momento.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {dates.map((d, idx) => {
                const dateId = d.id ?? idx
                return (
                  <div
                    key={dateId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      padding: "0.875rem 1rem",
                      background: "var(--accent)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      width: "100%",
                      boxSizing: "border-box",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, flexWrap: "wrap" }}>
                        <Clock size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>{d.fecha || "Fecha por confirmar"} {d.hora ? `· ${d.hora}` : ""}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        <MapPin size={14} style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>{d.delegacion || "Delegación SNTSS"}</span>
                        {d.estatus && <span>· Estado: {d.estatus}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Nota informativa */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          padding: "0.875rem 1rem",
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          lineHeight: 1.45,
        }}
      >
        <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
        <span>
          <strong>Información sobre citas:</strong> Esta sección consulta tus citas de atención presencial previamente programadas ante la Caja SNTSS. Para solicitar una nueva cita o reprogramar, comunícate a la línea de atención de tu delegación sindical.
        </span>
      </div>
    </div>
  )
}
