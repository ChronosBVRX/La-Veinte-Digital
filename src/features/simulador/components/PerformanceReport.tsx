"use client"

import { motion } from "framer-motion"
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

function ScoreGauge({ label, score, icon, color, delay }: { label: string; score: number; icon: React.ReactNode; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1rem" }}
    >
      <div style={{
        position: "relative", width: 80, height: 80,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r="36" fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDasharray: "0 226" }}
            animate={{ strokeDasharray: `${(score / 100) * 226} 226` }}
            transition={{ delay: delay + 0.3, duration: 1, ease: "easeOut" }}
            transform="rotate(-90 40 40)"
          />
        </svg>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.8, type: "spring", stiffness: 200 }}
          style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {icon}
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{score}%</span>
        </motion.div>
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </motion.div>
  )
}

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.3 + i * 0.12, duration: 0.4 },
  }),
}

export function PerformanceReport({ analysis, messages, scenarioName, difficulty, onReset }: PerformanceReportProps) {
  const totalExchanges = messages.filter((m) => m.role === "user").length

  const sections = [
    { id: "summary", content: (
      <div key="summary" style={{
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
    )},
    { id: "errors", content: analysis.erroresTacticos.length > 0 && (
      <div key="errors" style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "#dc2626" }}>
          <AlertCircle size={16} />
          Errores Tácticos Detectados
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {analysis.erroresTacticos.map((err, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}
            >
              {err}
            </motion.li>
          ))}
        </ul>
      </div>
    )},
    { id: "strengths", content: analysis.fortalezas.length > 0 && (
      <div key="strengths" style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "#16a34a" }}>
          <CheckCircle size={16} />
          Fortalezas
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {analysis.fortalezas.map((f, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}
            >
              {f}
            </motion.li>
          ))}
        </ul>
      </div>
    )},
    { id: "articles", content: analysis.articulosRelevantes.length > 0 && (
      <div key="articles" style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--primary)" }}>
          <BookOpen size={16} />
          Normatividad Relevante para tu Defensa
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {analysis.articulosRelevantes.map((art, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + i * 0.1 }}
              style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--fg)" }}
            >
              {art}
            </motion.li>
          ))}
        </ul>
      </div>
    )},
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 700, margin: "0 auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
          Reporte de Desempeño
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
          Simulación: {scenarioName} · Nivel {difficulty === 1 ? "Aclaración de Hechos" : "Presión Alta"}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: "0.5rem",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "0.75rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
        }}
      >
        <ScoreGauge label="Calma" score={analysis.puntajeCalma} icon={<Shield size={16} color="#2563eb" />} color="#2563eb" delay={0.2} />
        <ScoreGauge label="Firmeza" score={analysis.puntajeFirmeza} icon={<Target size={16} color="#16a34a" />} color="#16a34a" delay={0.35} />
      </motion.div>

      {sections.map((s, i) => (
        <motion.div
          key={s.id}
          custom={i}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          {s.content}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4 }}
        style={{
          background: "var(--accent)", borderRadius: "0.75rem",
          padding: "0.75rem 1rem", display: "flex", justifyContent: "center", gap: "2rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}
          >
            {totalExchanges}
          </motion.span>
          <br />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Intercambios</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}
          >
            {difficulty === 2 ? "Alta" : "Normal"}
          </motion.span>
          <br />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Presión</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7 }}
        style={{ display: "flex", justifyContent: "center", gap: "0.75rem", paddingTop: "0.5rem" }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="primary" onClick={onReset}>
            <RotateCcw size={16} style={{ marginRight: "0.375rem" }} />
            Nueva Simulación
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
