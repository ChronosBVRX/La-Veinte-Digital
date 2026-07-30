import { CalendarioAnual } from "@/features/calendario/components/CalendarioAnual"
import { CalendarioExportButton } from "@/features/calendario/components/CalendarioExportButton"
import { CALENDARIOS } from "@/features/calendario/services/calendarioData"

export default function CalendarioPage() {
  const year = new Date().getFullYear()
  const displayYear = CALENDARIOS[year] ? year : 2026

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{
        marginBottom: "1.5rem", display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Calendario IMSS {displayYear}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Fechas de pago, periodos de interactivo y vacacional
          </p>
        </div>
        <CalendarioExportButton year={displayYear} label="Exportar año completo" />
      </div>
      <CalendarioAnual />
    </div>
  )
}
