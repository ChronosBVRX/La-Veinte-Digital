"use client"
import { Button } from "@/shared/components/ui/Button"

interface Props { selected: "basic" | "configured" | null; onSelect: (v: "basic" | "configured") => void; onContinue: () => void; onBack: () => void }

export function ModeChoiceStep({ selected, onSelect, onContinue, onBack }: Props) {
  return (
    <fieldset style={{ border: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <legend style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>¿Cómo quieres usar La Veinte Digital?</legend>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer", background: selected === "basic" ? "rgba(37,99,235,0.04)" : "transparent" }}>
        <input type="radio" name="mode" checked={selected === "basic"} onChange={() => onSelect("basic")} style={{ marginTop: "0.125rem" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Usar modo básico</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>No necesito guardar datos laborales. Capturaré lo necesario en cada herramienta.</div>
        </div>
      </label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer", background: selected === "configured" ? "rgba(37,99,235,0.04)" : "transparent" }}>
        <input type="radio" name="mode" checked={selected === "configured"} onChange={() => onSelect("configured")} style={{ marginTop: "0.125rem" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Configurar mi perfil laboral</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Podré capturar mis datos manualmente o importar un tarjetón.</div>
        </div>
      </label>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>Ninguna opción viene preseleccionada.</p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <Button onClick={onContinue} disabled={!selected}>Continuar</Button>
      </div>
    </fieldset>
  )
}
