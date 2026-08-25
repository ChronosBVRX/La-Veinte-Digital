"use client"

import Link from "next/link"
import { Calculator, Calendar, DollarSign, Clock, Percent, FileText, FileUp, ArrowRight } from "lucide-react"
import { CalculatorCard } from "./CalculatorCard"

const calculators = [
  { href: "/calculadoras/aguinaldo", title: "Aguinaldo", description: "Calcula el aguinaldo estimado.", icon: Calendar },
  { href: "/calculadoras/segunda-julio", title: "Segunda de Julio", description: "Prestacion anual de segunda de julio.", icon: DollarSign },
  { href: "/calculadoras/segunda-julio-proporcional", title: "Segunda de Julio Proporcional", description: "Para categorias 08 y 02.", icon: Percent },
  { href: "/calculadoras/tiempo-extra", title: "Tiempo Extra", description: "Horas extraordinarias.", icon: Clock, badge: "Formula corregida" },
  { href: "/calculadoras/clausula-97", title: "Clausula 97", description: "Adelanto de quincenas.", icon: FileText },
  { href: "/calculadoras/prestamos", title: "Prestamos por Categoria", description: "Montos de prestamos disponibles.", icon: Calculator },
]

export function CalculatorsIndex({ hasTarjeton }: { hasTarjeton: boolean }) {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Calculadoras Laborales</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>Herramientas informativas para estimar prestaciones.</p>
      </div>

      <Link href="/profile/mi-informacion-laboral" style={{ textDecoration: "none", display: "block", marginBottom: "1.5rem" }}>
        {hasTarjeton ? (
          <div style={{
            background: "var(--accent)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "0.75rem 1rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.875rem" }}>
              <FileUp size={18} style={{ color: "var(--primary)" }} />
              <span style={{ color: "var(--fg)" }}>
                <strong>Actualiza tu tarjetón</strong> para mantener tus importes al día.
              </span>
            </div>
            <ArrowRight size={16} style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <div style={{
            background: "var(--primary)", color: "var(--primary-fg)", borderRadius: "var(--radius)",
            padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "1rem", boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <FileUp size={22} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Importa tu tarjetón IMSS</span>
                <span style={{ opacity: 0.85, fontSize: "0.8125rem" }}>
                  Tus calculadoras se llenan con los importes reales de tu recibo.
                </span>
              </div>
            </div>
            <ArrowRight size={20} />
          </div>
        )}
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        {calculators.map((c) => <CalculatorCard key={c.href} {...c} />)}
      </div>
      <div style={{ marginTop: "2rem", background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
        Las formulas fueron reconstruidas de la aplicacion de referencia. Verifique contra normativa vigente.
      </div>
    </div>
  )
}
