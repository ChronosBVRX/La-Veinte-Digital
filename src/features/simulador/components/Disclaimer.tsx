"use client"

import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"

interface DisclaimerProps {
  onAccept: () => void
}

export function Disclaimer({ onAccept }: DisclaimerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        maxWidth: 600, margin: "0 auto", padding: "2rem 1rem",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: "1.5rem",
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
        style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--accent)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <AlertTriangle size={28} style={{ color: "var(--warning)" }} />
      </motion.div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
        Simulador de Audiencias
      </h1>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25 }}
        style={{
          background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "0.75rem",
          padding: "1.25rem", textAlign: "left", width: "100%",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "#92400e" }}>
          <strong>Aviso importante:</strong> Este simulador es una herramienta de entrenamiento pedagógico.
          No sustituye la asesoría ni el acompañamiento presencial de tu representante sindical
          en una investigación real.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--muted)", textAlign: "left" }}
      >
        <p style={{ margin: "0 0 0.75rem" }}>
          Este ejercicio te permitirá:
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <li>Ensayar respuestas ante un interrogatorio simulado basado en normatividad real</li>
          <li>Identificar errores tácticos antes de una audiencia real</li>
          <li>Familiarizarte con el lenguaje y presión de un proceso disciplinario</li>
          <li>Conocer qué cláusulas del CCT, Ley Federal del Trabajo y reglamentos aplican a tu caso</li>
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Button variant="primary" size="md" onClick={onAccept}>
          Entendido, comenzar
        </Button>
      </motion.div>
    </motion.div>
  )
}
