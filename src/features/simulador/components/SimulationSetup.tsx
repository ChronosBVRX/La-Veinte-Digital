"use client"

import { Scale, BookOpen, Swords, AlertTriangle, FileText, Lock } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import type { Scenario } from "../hooks/useSimulation"

interface SimulationSetupProps {
  scenarios: Scenario[]
  selectedScenario: Scenario
  difficulty: 1 | 2
  onSelectScenario: (s: Scenario) => void
  onSelectDifficulty: (d: 1 | 2) => void
  onStart: () => void
}

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  faltas: <BookOpen size={20} />,
  maltrato: <AlertTriangle size={20} />,
  incumplimiento: <FileText size={20} />,
  extravio: <Scale size={20} />,
  retardo: <Swords size={20} />,
  confidencialidad: <Lock size={20} />,
}

export function SimulationSetup({
  scenarios, selectedScenario, difficulty,
  onSelectScenario, onSelectDifficulty, onStart,
}: SimulationSetupProps) {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          Configurar Simulación
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
          Selecciona el escenario y nivel de dificultad para tu entrenamiento
        </p>
      </div>

      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
          Escenario
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {scenarios.map((s) => {
            const isSelected = selectedScenario.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => onSelectScenario(s)}
                style={{
                  padding: "1rem", borderRadius: "0.75rem",
                  border: isSelected ? "2px solid var(--primary)" : "2px solid var(--border)",
                  background: isSelected ? "var(--accent)" : "var(--card)",
                  cursor: "pointer", textAlign: "left",
                  transition: "all var(--transition)",
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "0.5rem",
                  background: isSelected ? "var(--primary)" : "var(--accent)",
                  color: isSelected ? "var(--primary-fg)" : "var(--muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {SCENARIO_ICONS[s.id] ?? <Scale size={20} />}
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{s.nombre}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>{s.descripcion}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
          Nivel de Dificultad
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <button
            onClick={() => onSelectDifficulty(1)}
            style={{
              padding: "1rem", borderRadius: "0.75rem",
              border: difficulty === 1 ? "2px solid #22c55e" : "2px solid var(--border)",
              background: difficulty === 1 ? "#f0fdf4" : "var(--card)",
              cursor: "pointer", textAlign: "left",
              transition: "all var(--transition)",
              display: "flex", flexDirection: "column", gap: "0.375rem",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: difficulty === 1 ? "#22c55e" : "var(--accent)",
              color: difficulty === 1 ? "white" : "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.75rem", fontWeight: 700,
            }}>1</div>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Aclaración de Hechos</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Preguntas directas pero estándar. Ritmo pausado.
            </span>
          </button>
          <button
            onClick={() => onSelectDifficulty(2)}
            style={{
              padding: "1rem", borderRadius: "0.75rem",
              border: difficulty === 2 ? "2px solid #dc2626" : "2px solid var(--border)",
              background: difficulty === 2 ? "#fef2f2" : "var(--card)",
              cursor: "pointer", textAlign: "left",
              transition: "all var(--transition)",
              display: "flex", flexDirection: "column", gap: "0.375rem",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: difficulty === 2 ? "#dc2626" : "var(--accent)",
              color: difficulty === 2 ? "white" : "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.75rem", fontWeight: 700,
            }}>2</div>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Presión Alta</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Intimidatorio, busca contradicciones, ritmo acelerado.
            </span>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.5rem" }}>
        <Button variant="primary" size="md" onClick={onStart}>
          Iniciar Simulación
        </Button>
      </div>
    </div>
  )
}
