"use client"

import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Shield, Info } from "lucide-react"

interface OptInConsentProps {
  onAccept: () => void
  onDecline: () => void
}

export function OptInConsent({ onAccept, onDecline }: OptInConsentProps) {
  return (
    <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
      <Card padding="1.5rem">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(37,99,235,0.1)", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <Shield size={28} style={{ color: "var(--primary)" }} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Proyecci&oacute;n de N&oacute;mina IMSS</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            M&oacute;dulo opcional de estimaci&oacute;n salarial
          </p>
        </div>

        <div style={{
          background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)",
          borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.25rem",
          display: "flex", gap: "0.75rem",
        }}>
          <Info size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.125rem" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--fg)", display: "block", marginBottom: "0.25rem" }}>
              Aviso importante
            </strong>
            Los datos que proporciones en este m&oacute;dulo <strong>se almacenan localmente</strong> y se usan
            &uacute;nicamente para generar estimaciones informativas de tu n&oacute;mina.
            No se comparten con terceros, no se registran en servidores externos y no afectan
            tu relaci&oacute;n laboral.
          </div>
        </div>

        <ul style={{
          fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6,
          paddingLeft: "1.25rem", margin: "0 0 1.25rem", display: "flex",
          flexDirection: "column", gap: "0.375rem",
        }}>
          <li>No se solicitan datos personales sensibles (RFC, CURP, NSS).</li>
          <li>No se env&iacute;an importes a servicios externos.</li>
          <li>Puedes borrar todos tus datos en cualquier momento.</li>
          <li>El resultado es una <strong>proyecci&oacute;n informativa</strong>, no una n&oacute;mina oficial.</li>
          <li>Puedes desactivar este m&oacute;dulo sin afectar el resto de la plataforma.</li>
        </ul>

        <div style={{
          background: "var(--accent)", borderRadius: "var(--radius)",
          padding: "0.75rem 1rem", marginBottom: "1.25rem",
          fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center",
        }}>
          Al activar aceptas que los datos capturados se usen exclusivamente para
          calcular estimaciones de n&oacute;mina.
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <Button variant="primary" onClick={onAccept}>
            Activar m&oacute;dulo
          </Button>
          <Button variant="ghost" onClick={onDecline}>
            No, gracias
          </Button>
        </div>
      </Card>
    </div>
  )
}
