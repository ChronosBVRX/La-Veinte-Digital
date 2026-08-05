"use client"
import { Button } from "@/shared/components/ui/Button"

export function ConsentStep({ accepted, onAccept, onContinue, onBack }: { accepted: boolean; onAccept: (v: boolean) => void; onContinue: () => void; onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Antes de guardar</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        Seleccionar un método o capturar datos no guarda tu perfil. Solo se guardará cuando confirmes esta sección.
      </p>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        Tus datos laborales se utilizarán para completar calculadoras, simulaciones de nómina y vacaciones, preparar escritos y personalizar las herramientas que utilices.
      </p>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        Podrás modificar o borrar tus datos en cualquier momento desde Mi perfil → Mi información laboral. Al borrarlos, tu cuenta permanecerá activa en modo básico.
      </p>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
        <input type="checkbox" checked={accepted} onChange={(e) => onAccept(e.target.checked)} style={{ marginTop: "0.125rem" }} />
        <span>Quiero guardar mi información laboral para que las herramientas puedan completar automáticamente los datos. Podré borrarla cuando quiera.</span>
      </label>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
        La Veinte Digital es una herramienta independiente. No es un sitio oficial, no representa ni actúa en nombre del IMSS o del SNTSS.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <Button onClick={onContinue} disabled={!accepted}>Continuar</Button>
      </div>
    </div>
  )
}
