"use client"
import type { ProfileQuality } from "@/shared/domain/worker"

const FIELD_LABELS: Record<string, string> = {
  effectiveSeniorityDate: "Antigüedad",
  workdayHours: "Jornada",
  employmentType: "Tipo de contratación",
  categoria: "Categoría",
  matricula: "Matrícula",
  adscripcion: "Adscripción",
  shift: "Turno",
  baseSalary: "Sueldo base",
  delegacion: "Delegación / OOAD",
  fullName: "Nombre completo",
}

export function ProfileQualityCard({ quality }: { quality: ProfileQuality }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1rem",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      boxSizing: "border-box",
    }}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.75rem", wordBreak: "break-word" }}>
        Calidad del perfil
      </h3>
      <div style={{ height: "8px", background: "var(--accent)", borderRadius: "4px", marginBottom: "0.5rem", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, quality.percent)}%`,
          background: "var(--primary)",
          borderRadius: "4px",
          transition: "width 0.5s",
        }} />
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.375rem",
        fontSize: "0.8125rem",
        color: "var(--muted)",
      }}>
        <span style={{ fontWeight: 600 }}>{quality.percent}% completitud</span>
        <span>{quality.confirmedCount} confirmados · {quality.manualCount} manuales</span>
      </div>
      {quality.missingFields.length > 0 && (
        <div style={{
          marginTop: "0.75rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.8125rem",
        }}>
          <span style={{ color: "var(--muted)", marginRight: "0.125rem" }}>Para mejorar:</span>
          {quality.missingFields.map((f) => (
            <span
              key={f}
              style={{
                background: "var(--accent)",
                color: "var(--fg)",
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-sm, 0.25rem)",
                fontSize: "0.75rem",
                fontWeight: 500,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {FIELD_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
