"use client"

import Link from "next/link"
import { CalendarDots, CurrencyDollar, Percent, Clock, FileText, Calculator, UploadSimple, ArrowRight } from "@phosphor-icons/react"
import { CalculatorCard } from "./CalculatorCard"

const calculators = [
  { href: "/calculadoras/aguinaldo", title: "Aguinaldo", description: "Calcula el aguinaldo estimado.", icon: CalendarDots },
  { href: "/calculadoras/segunda-julio", title: "Segunda de Julio", description: "Prestación anual de segunda de julio.", icon: CurrencyDollar },
  { href: "/calculadoras/segunda-julio-proporcional", title: "Segunda de Julio Proporcional", description: "Para categorías 08 y 02.", icon: Percent },
  { href: "/calculadoras/tiempo-extra", title: "Tiempo Extra", description: "Cálculo de horas extraordinarias conforme a tabulador.", icon: Clock },
  { href: "/calculadoras/clausula-97", title: "Cláusula 97", description: "Adelanto de quincenas.", icon: FileText },
  { href: "/calculadoras/prestamos", title: "Préstamos por Categoría", description: "Montos y plazos de préstamos disponibles.", icon: Calculator },
]

export function CalculatorsIndex({ hasTarjeton }: { hasTarjeton: boolean }) {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "clamp(1.25rem, 4vw, 1.5rem)", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Calculadoras Laborales</h1>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
          Herramientas informativas para estimar tus prestaciones laborales.
        </p>
      </div>

      <Link href="/profile/mi-informacion-laboral" style={{ textDecoration: "none", display: "block", marginBottom: "1rem", gridColumn: "1 / -1" }}>
        {hasTarjeton ? (
          <div style={{
            background: "var(--accent)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "0.875rem 1.25rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "var(--text-sm)" }}>
              <UploadSimple size={22} weight="duotone" style={{ color: "var(--primary)" }} />
              <span style={{ color: "var(--fg)" }}>
                <strong>Actualiza tu tarjetón</strong> para mantener tus importes al día.
              </span>
            </div>
            <ArrowRight size={18} style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <div style={{
            background: "var(--primary)", color: "var(--primary-fg)", borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "1rem", boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <UploadSimple size={26} weight="duotone" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>Importar mi tarjetón IMSS</span>
                <span style={{ opacity: 0.9, fontSize: "var(--text-sm)" }}>
                  Tus calculadoras se llenan automáticamente con los importes reales de tu recibo.
                </span>
              </div>
            </div>
            <ArrowRight size={22} />
          </div>
        )}
      </Link>

      <div className="calculators-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        {calculators.map((c) => <CalculatorCard key={c.href} {...c} />)}
      </div>

      <div style={{ marginTop: "2rem", background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "1rem 1.25rem", fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.5 }}>
        Cálculo orientativo basado en los datos proporcionados y la normativa disponible.
      </div>
    </div>
  )
}
