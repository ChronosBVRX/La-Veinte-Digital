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
  const isHealthy = quality.percent >= 70 || quality.confirmedCount >= 3
  const hasConfirmed = quality.confirmedCount > 0

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, wordBreak: "break-word" }}>
          Estado de tu perfil laboral
        </h3>
        {hasConfirmed && (
          <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600, background: "#f0fdf4", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
            ✓ Conectado con tarjetón
          </span>
        )}
      </div>

      <div style={{ height: "8px", background: "var(--accent)", borderRadius: "4px", marginBottom: "0.5rem", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, Math.max(quality.percent, hasConfirmed ? 50 : 0))}%`,
          background: isHealthy ? "#16a34a" : "var(--primary)",
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
        <span style={{ fontWeight: 600 }}>
          {quality.percent > 0 ? `${quality.percent}% completitud` : hasConfirmed ? "Datos clave listos" : "Perfil básico"}
        </span>
        <span>
          {quality.confirmedCount > 0 && `${quality.confirmedCount} confirmados`}
          {quality.confirmedCount > 0 && quality.manualCount > 0 && " · "}
          {quality.manualCount > 0 && `${quality.manualCount} manuales`}
          {quality.confirmedCount === 0 && quality.manualCount === 0 && "Pendiente de sincronizar"}
        </span>
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
          <span style={{ color: "var(--muted)", marginRight: "0.125rem" }}>Campos complementarios:</span>
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
