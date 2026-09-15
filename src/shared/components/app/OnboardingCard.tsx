"use client"

import Link from "next/link"
import { CheckCircle, CaretRight, Sparkle } from "@phosphor-icons/react"

type OnboardingFactStatus = "present" | "absent" | "unknown"

interface OnboardingStep {
  key: string
  status: OnboardingFactStatus
  label: string
  description: string
  actionLabel: string
  href: string
}

interface OnboardingCardProps {
  /** true = confirmado, false = confirmado ausente, null = no se pudo confirmar */
  hasAntiguedad: boolean | null
  /** true = confirmado, false = confirmado ausente, null = no se pudo confirmar */
  hasTarjeton: boolean | null
  /** true = confirmado, false = confirmado ausente, null = no se pudo confirmar */
  hasCategoria: boolean | null
}

function factStatus(value: boolean | null | undefined): OnboardingFactStatus {
  if (value === true) return "present"
  if (value === false) return "absent"
  return "unknown"
}

export function OnboardingCard({ hasAntiguedad, hasTarjeton, hasCategoria }: OnboardingCardProps) {
  const steps: OnboardingStep[] = [
    {
      key: "categoria",
      status: factStatus(hasCategoria),
      label: "Registra tu categoría",
      description: "Tu categoría sindical ayuda a las calculadoras a estimar bien tus prestaciones.",
      actionLabel: "Registrar mi categoría",
      href: "/profile",
    },
    {
      key: "antiguedad",
      status: factStatus(hasAntiguedad),
      label: "Registra tu antigüedad",
      description: "Con tu antigüedad, las vacaciones y prestaciones se calculan con exactitud.",
      actionLabel: "Registrar mi antigüedad",
      href: "/profile",
    },
    {
      key: "tarjeton",
      status: factStatus(hasTarjeton),
      label: "Importa tu tarjetón",
      description: "Importa tu tarjetón del IMSS y tus datos laborales se actualizan solos.",
      actionLabel: "Importar mi tarjetón",
      href: "/profile/mi-informacion-laboral",
    },
  ]

  const activeIndex = steps.findIndex((s) => s.status === "absent")
  if (activeIndex === -1) return null

  const knownTotal = steps.filter((s) => s.status !== "unknown").length
  const doneCount = steps.filter((s) => s.status === "present").length
  const unknownCount = steps.length - knownTotal
  const active = steps[activeIndex]
  const remaining = knownTotal - doneCount

  return (
    <section
      style={{
        marginBottom: "var(--space-6)",
        background: "linear-gradient(135deg, var(--state-info-bg), #eef4ff)",
        border: "1px solid rgba(53, 104, 192, 0.18)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
              color: "var(--primary-fg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkle size={18} weight="fill" />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 700, color: "var(--fg)" }}>
              Prepara tu cuenta
            </h2>
            <p style={{ margin: "0.125rem 0 0", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
              {doneCount} de {knownTotal} pasos completados
              {unknownCount > 0 ? ` · ${unknownCount} por confirmar` : ""}
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "var(--brand-blue)",
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(53, 104, 192, 0.2)",
            padding: "0.25rem 0.625rem",
            borderRadius: "var(--radius-pill)",
            whiteSpace: "nowrap",
          }}
        >
          Falta {remaining} de {knownTotal}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.875rem" }}>
        {steps.map((s, i) => (
          <div
            key={s.key}
            aria-hidden
            style={{
              flex: 1,
              height: 6,
              borderRadius: "var(--radius-pill)",
              background:
                s.status === "present"
                  ? "linear-gradient(90deg, var(--area-work), #34d399)"
                  : i === activeIndex
                  ? "var(--brand-blue)"
                  : s.status === "unknown"
                  ? "rgba(100, 116, 139, 0.28)"
                  : "rgba(100, 116, 139, 0.18)",
            }}
          />
        ))}
      </div>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0.875rem 0 0",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {steps.map((s, i) => {
          const isActive = i === activeIndex
          const isUnknown = s.status === "unknown"
          return (
            <li
              key={s.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                opacity: s.status === "present" || isActive ? 1 : isUnknown ? 0.75 : 0.6,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    s.status === "present"
                      ? "var(--area-work)"
                      : isActive
                      ? "var(--brand-blue)"
                      : "var(--accent)",
                  color: s.status === "present" || isActive ? "var(--primary-fg)" : "var(--muted)",
                  marginTop: 1,
                }}
              >
                {s.status === "present" ? (
                  <CheckCircle size={16} weight="fill" />
                ) : isUnknown ? (
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700 }}>?</span>
                ) : (
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700 }}>{i + 1}</span>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: isActive ? 600 : 500,
                    color: "var(--fg)",
                    textDecoration: s.status === "present" ? "line-through" : "none",
                    textDecorationColor: "rgba(100,116,139,0.4)",
                  }}
                >
                  {s.label}
                </div>
                {isActive && (
                  <p style={{ margin: "0.125rem 0 0", fontSize: "var(--text-xs)", color: "var(--muted)", lineHeight: 1.45 }}>
                    {s.description}
                  </p>
                )}
                {s.status === "present" && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--area-work)", fontWeight: 600 }}>
                    Completado
                  </span>
                )}
                {isUnknown && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontWeight: 600 }}>
                    Por confirmar
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <Link
        href={active.href}
        className="hover-lift pressable"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.375rem",
          minHeight: "var(--control-md)",
          marginTop: "1rem",
          padding: "0 1rem",
          borderRadius: "var(--radius)",
          background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
          color: "var(--primary-fg)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 4px 12px rgba(46, 79, 119, 0.25)",
          transition: "transform var(--transition), box-shadow var(--transition)",
        }}
      >
        {active.actionLabel}
        <CaretRight size={16} weight="bold" />
      </Link>
    </section>
  )
}