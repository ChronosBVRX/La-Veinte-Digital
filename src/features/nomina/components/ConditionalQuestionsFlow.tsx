"use client"

import { useState } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { ConditionalPayrollQuestion } from "../lib/question-engine"
import type { PayrollFactKey, PayrollFactValue } from "../lib/types"
import { HelpCircle, SkipForward } from "lucide-react"

interface ConditionalQuestionsFlowProps {
  questions: ConditionalPayrollQuestion[]
  onAnswer: (factKey: PayrollFactKey, value: PayrollFactValue) => void
  onSkip: () => void
  onGenerate: () => void
}

export function ConditionalQuestionsFlow({
  questions,
  onAnswer,
  onSkip,
  onGenerate,
}: ConditionalQuestionsFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answered, setAnswered] = useState(0)

  if (questions.length === 0) {
    return (
      <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
        <Card padding="1.5rem" style={{ textAlign: "center" }}>
          <h3 style={{ margin: "0 0 0.5rem" }}>No hay preguntas pendientes</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Tu proyecci&oacute;n est&aacute; lista para generarse.
          </p>
          <Button onClick={onGenerate}>Generar proyecci&oacute;n</Button>
        </Card>
      </div>
    )
  }

  if (currentIndex >= questions.length) {
    return (
      <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
        <Card padding="1.5rem" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#10003;</div>
          <h3 style={{ margin: "0 0 0.5rem" }}>Respuestas guardadas</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Respondiste {answered} de {questions.length} preguntas.
            Tu proyecci&oacute;n base est&aacute; disponible.
          </p>
          <Button onClick={onGenerate}>Generar proyecci&oacute;n ahora</Button>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]

  const handleAnswer = (value: PayrollFactValue) => {
    onAnswer(currentQuestion.factKey, value)
    setAnswered((prev) => prev + 1)
    setCurrentIndex((prev) => prev + 1)
  }

  return (
    <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
      <Card padding="1.5rem">
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "0.75rem",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Pregunta {currentIndex + 1} de {questions.length}
          </span>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <SkipForward size={14} /> Omitir y calcular
          </Button>
        </div>

        <div style={{
          height: "4px", borderRadius: "2px", background: "var(--border)",
          marginBottom: "1.25rem",
        }}>
          <div style={{
            height: "100%", borderRadius: "2px", background: "var(--primary)",
            transition: "width 0.3s",
            width: `${((currentIndex) / questions.length) * 100}%`,
          }} />
        </div>

        <div style={{
          display: "flex", gap: "0.75rem", marginBottom: "1rem",
        }}>
          <HelpCircle size={20} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.125rem" }} />
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
              {currentQuestion.question}
            </h3>
            {currentQuestion.whyItMatters && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>
                {currentQuestion.whyItMatters}
              </p>
            )}
          </div>
        </div>

        {currentQuestion.helpText && (
          <div style={{
            background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)",
            borderRadius: "var(--radius)", padding: "0.625rem 0.75rem",
            fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem",
          }}>
            {currentQuestion.helpText}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          {currentQuestion.options?.map((opt, i) => (
            <Button
              key={i}
              variant={i === 0 ? "primary" : "secondary"}
              onClick={() => handleAnswer(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Omitir y calcular proyecci&oacute;n
          </Button>
        </div>
      </Card>
    </div>
  )
}
