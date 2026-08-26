"use client"

import Link from "next/link"
import { Calculator, ArrowsLeftRight, FileText, Books, Scales } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"

const TOOLS = [
  { href: "/calculadoras", label: "Calculadoras", description: "Aguinaldo, tiempo extra, préstamos, segunda de julio y más.", icon: Calculator },
  { href: "/simulador-nomina", label: "Simulador de nómina", description: "Compara cómo cambiaría tu quincena al modificar categoría o antigüedad.", icon: ArrowsLeftRight },
  { href: "/escritos", label: "Crear un escrito", description: "Genera documentos formales basados en tu situación laboral.", icon: FileText },
  { href: "/guia", label: "Guía de mi Tarjetón", description: "Entiende cada concepto, campo y detalle de tu tarjetón IMSS.", icon: Books },
  { href: "/simulador", label: "Practicar una audiencia", description: "Practica una audiencia de aclaración con un evaluador virtual.", icon: Scales },
]

export default function HerramientasPage() {
  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <PageHeader
        eyebrow="Herramientas"
        title="Herramientas laborales"
        description="Explora las herramientas disponibles para tu gestión y cálculo laboral."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-4)",
                padding: "var(--space-4)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow var(--transition)",
              }}
              className="hover-lift"
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={22} weight="duotone" color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "0.125rem" }}>
                  {tool.label}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", lineHeight: 1.4 }}>
                  {tool.description}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
