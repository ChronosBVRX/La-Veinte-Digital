"use client"
import { Button } from "@/shared/components/ui/Button"

interface Props { selected: "manual" | "payslip" | null; onSelect: (v: "manual" | "payslip") => void; onContinue: () => void; onBack: () => void }

export function MethodChoiceStep({ selected, onSelect, onContinue, onBack }: Props) {
  return (
    <fieldset style={{ border: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <legend style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>¿Cómo prefieres configurar?</legend>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer", background: selected === "manual" ? "rgba(37,99,235,0.04)" : "transparent" }}>
        <input type="radio" name="method" checked={selected === "manual"} onChange={() => onSelect("manual")} style={{ marginTop: "0.125rem" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Capturar manualmente</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Llenaré los datos que conozca. Puedo completar el resto después.</div>
        </div>
      </label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer", background: selected === "payslip" ? "rgba(37,99,235,0.04)" : "transparent" }}>
        <input type="radio" name="method" checked={selected === "payslip"} onChange={() => onSelect("payslip")} style={{ marginTop: "0.125rem" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Importar mi tarjetón</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Selecciono el PDF de mi último recibo. El archivo se procesa en mi dispositivo y no se guarda.</div>
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
