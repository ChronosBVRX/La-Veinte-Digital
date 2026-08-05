"use client"

import { UserCircle, Phone, EnvelopeSimple, CheckCircle } from "@phosphor-icons/react"

interface ProfileSummaryCardProps {
  fullName: string | null
  phone: string | null
  email: string | null
  hasMatricula: boolean
  hasCategoria: boolean
  hasAdscripcion: boolean
  hasAntiguedad: boolean
}

const FIELDS = [
  { key: "name", label: "Nombre", weight: 1 },
  { key: "phone", label: "Teléfono", weight: 1 },
  { key: "matricula", label: "Matrícula", weight: 1 },
  { key: "categoria", label: "Categoría", weight: 1 },
  { key: "adscripcion", label: "Adscripción", weight: 1 },
  { key: "antiguedad", label: "Antigüedad", weight: 1 },
]

export function ProfileSummaryCard({
  fullName,
  phone,
  email,
  hasMatricula,
  hasCategoria,
  hasAdscripcion,
  hasAntiguedad,
}: ProfileSummaryCardProps) {
  const filled = [
    !!fullName,
    !!phone,
    hasMatricula,
    hasCategoria,
    hasAdscripcion,
    hasAntiguedad,
  ].filter(Boolean).length

  const total = FIELDS.length
  const percent = Math.round((filled / total) * 100)

  const registered = [
    hasMatricula && "Matrícula",
    hasCategoria && "Categoría",
    hasAdscripcion && "Adscripción",
    hasAntiguedad && "Antigüedad",
  ].filter(Boolean) as string[]

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-5)",
        alignItems: "center",
        marginBottom: "var(--space-6)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <UserCircle size={28} weight="fill" color="white" />
      </div>

      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "0.125rem" }}>
          {fullName ?? "Sin nombre"}
        </div>
        {email && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: "0.125rem" }}>
            <EnvelopeSimple size={14} />
            {email}
          </div>
        )}
        {phone && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--text-sm)", color: "var(--muted)" }}>
            <Phone size={14} />
            {phone}
          </div>
        )}

        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${percent}%`,
              height: "100%",
              background: percent >= 80 ? "var(--success)" : percent >= 50 ? "var(--brand-cyan)" : "var(--warning)",
              borderRadius: 2,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {percent}% completo
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {registered.length > 0 ? (
          registered.map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--text-xs)", color: "var(--success)" }}>
              <CheckCircle size={14} weight="fill" />
              {label} registrada
            </div>
          ))
        ) : (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
            Sin datos laborales
          </span>
        )}
      </div>
    </div>
  )
}
