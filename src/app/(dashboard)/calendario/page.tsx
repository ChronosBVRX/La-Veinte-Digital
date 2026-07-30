import { CalendarioAnual } from "@/features/calendario/components/CalendarioAnual"
import { CalendarioExportButton } from "@/features/calendario/components/CalendarioExportButton"

export default function CalendarioPage() {
  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{
        marginBottom: "1.5rem", display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Calendario IMSS 2026
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Fechas de pago, periodos de interactivo y vacacional
          </p>
        </div>
        <CalendarioExportButton label="Exportar año completo" />
      </div>
      <CalendarioAnual />
    </div>
  )
}
