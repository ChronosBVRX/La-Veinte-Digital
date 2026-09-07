"use client"

import Link from "next/link"
import { CalendarDots, CurrencyDollar, Clock, FileText, Calculator, UploadSimple, ArrowRight } from "@phosphor-icons/react"
import { CalculatorCard } from "./CalculatorCard"
import { SourceAttribution } from "@/shared/components/ui/SourceAttribution"

const calculators = [
  {
    href: "/calculadoras/aguinaldo",
    title: "Aguinaldo",
    description: "Descubre cuánto te corresponde y cómo se distribuye durante el año.",
    icon: CalendarDots,
  },
  {
    href: "/calculadoras/segunda-julio",
    title: "Segunda de Julio",
    description: "Calcula cuánto podrías recibir en esta prestación.",
    icon: CurrencyDollar,
  },
  {
    href: "/calculadoras/tiempo-extra",
    title: "Tiempo Extra",
    description: "Calcula cuánto te pagarían por tus horas adicionales.",
    icon: Clock,
  },
  {
    href: "/calculadoras/clausula-97",
    title: "Anticipo de sueldo",
    badge: "Cláusula 97",
    description: "Consulta cuánto puedes solicitar con la Cláusula 97.",
    icon: FileText,
  },
  {
    href: "/calculadoras/prestamos",
    title: "Préstamos por Categoría",
    description: "Consulta los montos disponibles para tu puesto.",
    icon: Calculator,
  },
]

export function CalculatorsIndex({ hasTarjeton }: { hasTarjeton: boolean }) {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "2rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "clamp(1.25rem, 4vw, 1.5rem)", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Calculadoras Laborales
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
          Herramientas informativas para estimar tus prestaciones laborales en lenguaje claro.
        </p>
      </div>

      <Link
        href="/profile/mi-informacion-laboral"
        style={{ textDecoration: "none", display: "block", marginBottom: "1.25rem" }}
      >
        {hasTarjeton ? (
          <div
            style={{
              background: "rgba(37, 99, 235, 0.05)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              borderRadius: "var(--radius-lg)",
              padding: "0.875rem 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "var(--text-sm)" }}>
              <UploadSimple size={22} weight="duotone" style={{ color: "var(--primary)" }} />
              <span style={{ color: "var(--fg)" }}>
                <strong>Tarjetón conectado:</strong> tus calculadoras usan tus importes automáticamente.
              </span>
            </div>
            <ArrowRight size={18} style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <div
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <UploadSimple size={26} weight="duotone" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>Importar mi tarjetón IMSS</span>
                <span style={{ opacity: 0.9, fontSize: "var(--text-sm)" }}>
                  Llena tus calculadoras en un clic con los importes reales de tu último recibo.
                </span>
              </div>
            </div>
            <ArrowRight size={22} />
          </div>
        )}
      </Link>

      <div
        className="calculators-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {calculators.map((c) => (
          <CalculatorCard key={c.href} {...c} />
        ))}
      </div>

      <div
        style={{
          marginTop: "2rem",
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "1rem 1.25rem",
          fontSize: "var(--text-sm)",
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        Cálculo orientativo basado en los datos proporcionados y la normativa vigente del CCT IMSS-SNTSS.
        <SourceAttribution sourceId="cct-imss-sntss-2025-2027" detalle="prestaciones y cláusulas aplicables" />
        <span style={{ display: "block", marginTop: "0.375rem" }}>
          Herramienta independiente: no emite resoluciones oficiales.{" "}
          <Link href="/informacion-y-fuentes" style={{ color: "var(--primary)", textDecoration: "underline" }}>
            Información y fuentes
          </Link>
        </span>
      </div>
    </div>
  )
}
