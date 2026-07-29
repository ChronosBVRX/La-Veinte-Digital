"use client"

import { Calculator, Calendar, DollarSign, Clock, Percent, FileText } from "lucide-react"
import { CalculatorCard } from "./CalculatorCard"

const calculators = [
  { href: "/calculadoras/aguinaldo", title: "Aguinaldo", description: "Calcula el aguinaldo estimado.", icon: Calendar },
  { href: "/calculadoras/segunda-julio", title: "Segunda de Julio", description: "Prestacion anual de segunda de julio.", icon: DollarSign },
  { href: "/calculadoras/segunda-julio-proporcional", title: "Segunda de Julio Proporcional", description: "Para categorias 08 y 02.", icon: Percent },
  { href: "/calculadoras/tiempo-extra", title: "Tiempo Extra", description: "Horas extraordinarias.", icon: Clock, badge: "Formula corregida" },
  { href: "/calculadoras/clausula-97", title: "Clausula 97", description: "Adelanto de quincenas.", icon: FileText },
  { href: "/calculadoras/prestamos", title: "Prestamos por Categoria", description: "Montos de prestamos disponibles.", icon: Calculator },
]

export function CalculatorsIndex() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Calculadoras Laborales</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>Herramientas informativas para estimar prestaciones.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        {calculators.map((c) => <CalculatorCard key={c.href} {...c} />)}
      </div>
      <div style={{ marginTop: "2rem", background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
        Las formulas fueron reconstruidas de la aplicacion de referencia. Verifique contra normativa vigente.
      </div>
    </div>
  )
}
