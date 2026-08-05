"use client"
import type { ProfileQuality } from "@/shared/domain/worker"

export function ProfileQualityCard({ quality }: { quality: ProfileQuality }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem" }}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Calidad del perfil</h3>
      <div style={{ height: "8px", background: "var(--accent)", borderRadius: "4px", marginBottom: "0.5rem" }}>
        <div style={{ height: "100%", width: `${Math.min(100, quality.percent)}%`, background: "var(--primary)", borderRadius: "4px", transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--muted)" }}>
        <span>{quality.percent}% completitud</span>
        <span>{quality.confirmedCount} confirmados · {quality.manualCount} manuales</span>
      </div>
      {quality.missingFields.length > 0 && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
          <span style={{ color: "var(--muted)" }}>Para mejorar: </span>
          {quality.missingFields.map((f) => (
            <span key={f} style={{ background: "var(--accent)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", marginRight: "0.25rem", fontSize: "0.75rem" }}>{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}
