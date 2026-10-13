"use client"

import { User, IdentificationCard, Phone, EnvelopeSimple, MapPin, Briefcase, FileText } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import type { AccountProfile } from "@/lib/caja/models"

interface CajaInfoCardProps {
  account: AccountProfile | null
  matricula?: string
}

export function CajaInfoCard({ account, matricula }: CajaInfoCardProps) {
  const nombreCompleto = account
    ? [account.nombre, account.paterno, account.materno].filter(Boolean).join(" ")
    : "Afiliado a Caja de Ahorro"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <User size={22} color="var(--primary)" weight="bold" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Información del Afiliado
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: "0.75rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <User size={14} style={{ flexShrink: 0 }} />
              <span>Nombre Completo</span>
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {nombreCompleto}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <IdentificationCard size={14} style={{ flexShrink: 0 }} />
              <span>Matrícula IMSS</span>
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {account?.matricula || matricula || "—"}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              RFC
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {account?.rfc || "—"}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              CURP
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {account?.curp || "—"}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MapPin size={14} style={{ flexShrink: 0 }} />
              <span>Delegación</span>
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {account?.delegacion || "—"}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Briefcase size={14} style={{ flexShrink: 0 }} />
              <span>Tipo de Cuenta / Antigüedad</span>
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
              {account?.tipoCuenta || "Ahorrador Activo"} {account?.antiguedad ? `· ${account.antiguedad}` : ""}
            </div>
          </div>

          {account?.celular && (
            <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Phone size={14} style={{ flexShrink: 0 }} />
                <span>Teléfono de Contacto</span>
              </div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
                {account.celular}
              </div>
            </div>
          )}

          {account?.correo && (
            <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <EnvelopeSimple size={14} style={{ flexShrink: 0 }} />
                <span>Correo Registrado</span>
              </div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)", wordBreak: "break-word" }}>
                {account.correo}
              </div>
            </div>
          )}
        </div>

        {account?.hasInvoice && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.875rem 1rem",
              background: "rgba(37, 99, 235, 0.05)",
              border: "1px solid rgba(37, 99, 235, 0.15)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.8125rem",
            }}
          >
            <FileText size={18} color="var(--primary)" />
            <span>Tienes constancias fiscales / facturas disponibles en el portal de Caja.</span>
          </div>
        )}
      </Card>
    </div>
  )
}
