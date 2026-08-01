import { CalendarioAnual } from "@/features/calendario/components/CalendarioAnual"
import { CalendarioExportButton } from "@/features/calendario/components/CalendarioExportButton"
import { CALENDARIOS } from "@/features/calendario/services/calendarioData"
import { institutionalToday } from "@/shared/lib/dates"

export default function CalendarioPage() {
  const year = institutionalToday().getFullYear()
  const hasCalendar = CALENDARIOS[year] !== undefined

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{
        marginBottom: "1.5rem", display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Calendario IMSS {year}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Fechas de pago, periodos de interactivo y vacacional
          </p>
        </div>
        {hasCalendar && <CalendarioExportButton year={year} label="Exportar año completo" />}
      </div>
      {hasCalendar ? (
        <CalendarioAnual />
      ) : (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem", textAlign: "center",
        }}>
          <p style={{ margin: 0, color: "var(--fg)", fontWeight: 600 }}>
            El calendario para {year} aún no está publicado.
          </p>
          <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.875rem" }}>
            Se habilitará en cuanto se confirme el calendario oficial.
          </p>
        </div>
      )}
    </div>
  )
}
