"use client"

import { Target, Shield, AlertCircle, CheckCircle, BookOpen, RotateCcw, FileText } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import type { AnalysisResult, SimMessage } from "../services/bot"

interface PerformanceReportProps {
  analysis: AnalysisResult
  messages: SimMessage[]
  scenarioName: string
  difficulty: number
  onReset: () => void
}

function ScoreGauge({ label, score, icon, color }: { label: string; score: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
      padding: "1rem",
    }}>
      <div style={{
        position: "relative", width: 80, height: 80,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 226} 226`}
            transform="rotate(-90 40 40)"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {icon}
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{score}%</span>
        </div>
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </div>
  )
}

export function PerformanceReport({ analysis, messages, scenarioName, difficulty, onReset }: PerformanceReportProps) {
  const totalExchanges = messages.filter((m) => m.role === "user").length

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
          Reporte de Desempeño
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
          Simulación: {scenarioName} · Nivel {difficulty === 1 ? "Aclaración de Hechos" : "Presión Alta"}
        </p>
      </div>

      {/* Score gauges */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "0.75rem",
      }}>
        <ScoreGauge
          label="Calma"
          score={analysis.puntajeCalma}
          icon={<Shield size={16} color="#2563eb" />}
          color="#2563eb"
        />
        <ScoreGauge
          label="Firmeza"
          score={analysis.puntajeFirmeza}
          icon={<Target size={16} color="#16a34a" />}
          color="#16a34a"
        />
      </div>

      {/* Summary */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <FileText size={16} />
          Resumen de la Evaluación
        </h3>
        <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--fg)", margin: 0 }}>
          {analysis.resumen}
        </p>
      </div>

      {/* Errors */}
      {analysis.erroresTacticos.length > 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "1.25rem",
        }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "#dc2626" }}>
            <AlertCircle size={16} />
            Errores Tácticos Detectados
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {analysis.erroresTacticos.map((err, i) => (
              <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}>
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths */}
      {analysis.fortalezas.length > 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "1.25rem",
        }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "#16a34a" }}>
            <CheckCircle size={16} />
            Fortalezas
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {analysis.fortalezas.map((f, i) => (
              <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relevant articles */}
      {analysis.articulosRelevantes.length > 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "1.25rem",
        }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--primary)" }}>
            <BookOpen size={16} />
            Normatividad Relevante para tu Defensa
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {analysis.articulosRelevantes.map((art, i) => (
              <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}>
                {art}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div style={{
        background: "var(--accent)", borderRadius: "0.75rem",
        padding: "0.75rem 1rem", display: "flex", justifyContent: "center", gap: "2rem",
      }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}>{totalExchanges}</span>
          <br />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Intercambios</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}>{difficulty === 2 ? "Alta" : "Normal"}</span>
          <br />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Presión</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <Button variant="primary" onClick={onReset}>
          <RotateCcw size={16} style={{ marginRight: "0.375rem" }} />
          Nueva Simulación
        </Button>
      </div>
    </div>
  )
}
