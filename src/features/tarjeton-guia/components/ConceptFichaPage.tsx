"use client"

import Link from "next/link"
import { CaretRight, CaretDown, Calculator, Question } from "@phosphor-icons/react"
import type { CSSProperties, ReactNode } from "react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { getGuideConceptWithDetails, getRelationsForConcept, resolveRefHref } from "@/features/tarjeton-guia/lib/catalog"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import type { GuideDetailContent } from "@/features/tarjeton-guia/data/concept-details"
import type { GuideVerificationLevel, VerificationState } from "@/features/tarjeton-guia/lib/types"
import { VerificationCard } from "@/features/tarjeton-guia/components/VerificationCard"

function levelFromVerification(v: VerificationState | undefined): GuideVerificationLevel {
  switch (v) {
    case "verified":
      return "officially_verified"
    case "partially_verified":
      return "contextually_explained"
    default:
      return "pending_identification"
  }
}

export function ConceptFichaPage({ code }: { code: string }) {
  const norm = normalizeCode(code)
  const entry = norm ? getGuideConceptWithDetails(norm) : null

  if (!entry) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <PageHeader eyebrow="Guía" title={`Concepto ${code ?? ""}`} backHref="/guia/conceptos" />
        <Card padding="1.5rem" variant="subtle" style={{ textAlign: "center" }}>
          <Question size={28} color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.25rem" }}>No encontramos información de este concepto</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            ¿Quieres <Link href="/guia/conceptos" style={{ color: "var(--primary)", fontWeight: 600 }}>volver a conceptos</Link>?
          </p>
        </Card>
      </div>
    )
  }

  const kind = entry.kind === "perception" ? "Percepción" : "Deducción"
  const d = entry.details
  const relations = getRelationsForConcept(entry.code)
  const level: GuideVerificationLevel = d?.level ?? levelFromVerification(d?.verification)
  const hasSources = !!d?.sources?.length
  const showLegacyNote = !!d?.legacyNotes || level === "historically_identified" || !d?.directSource

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de conceptos"
        title={`${entry.code} · ${displayName(entry.name)}`}
        backHref="/guia/conceptos"
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Badge variant={kind === "Percepción" ? "info" : "warning"}>{kind}</Badge>
        {d?.descriptor && <Badge variant="neutral">{d.descriptor}</Badge>}
      </div>

      <Card padding="1.5rem" style={{ marginBottom: "1rem" }}>
        <Section title="En pocas palabras" divider={false}>
          <p style={para()}>
            {d?.simple ??
              "Tenemos identificado el concepto, pero su cálculo depende de información específica que no aparece en esta ficha."}
          </p>
        </Section>

        <Section title="¿Por qué aparece?">
          <p style={para()}>
            {d?.whyItAppears ??
              d?.whenItAppears ??
              (kind === "Percepción"
                ? "Puede corresponder a una prestación o condición laboral asociada al trabajador."
                : "Puede corresponder a un financiamiento, convenio u obligación asociado al trabajador.")}
          </p>
        </Section>

        <Section title="¿Qué conviene revisar?">
          <p style={para()}>
            {kind === "Percepción"
              ? "El importe acreditado, la base de cálculo y las observaciones que aparezcan en tu tarjetón."
              : "El importe descontado, el número de control y cualquier dato de vencimiento u observación que aparezca en tu tarjetón."}
          </p>
          {!!d?.affects?.length && (
            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {d.affects.map((a) => (
                <div
                  key={a}
                  style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}
                >
                  <span style={{ color: "var(--primary)", flexShrink: 0 }}>·</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {showLegacyNote && (
          <div style={{ marginTop: "1rem", padding: "0.75rem 0.875rem", borderRadius: "var(--radius-sm)", background: "var(--accent)" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              <strong style={{ color: "var(--fg)" }}>Sobre este código. </strong>
              {legacyNoteFor(d, level)}
            </p>
          </div>
        )}

        {hasSources && (
          <details style={{ marginTop: "1rem" }}>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--primary)",
                userSelect: "none",
              }}
            >
              <CaretDown size={14} style={{ transition: "transform var(--transition)" }} />
              {level === "officially_verified" ? "Ver fundamento" : "Ver fuentes de referencia"}
            </summary>
            <div style={{ marginTop: "0.75rem" }}>
              <VerificationCard state={d?.verification ?? "pending_verification"} level={level} sources={d?.sources} />
            </div>
          </details>
        )}
      </Card>

      {relations.length > 0 && <Relations relations={relations} />}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <ActionLink href="/tarjeton" variant="secondary" size="md">Ver en mi tarjetón</ActionLink>
        {d?.calculator && (
          <ActionLink href={d.calculator.route} size="md">
            <Calculator size={16} /> {d.calculator.label}
          </ActionLink>
        )}
        <ActionLink href="/guia/conceptos" variant="ghost" size="md">Volver a conceptos</ActionLink>
      </div>

      <p
        style={{
          fontSize: "0.6875rem",
          color: "var(--muted)",
          textAlign: "center",
          margin: "1.25rem auto 0",
          maxWidth: 480,
          lineHeight: 1.5,
        }}
      >
        La información mostrada es orientativa y se basa en fuentes institucionales disponibles.
      </p>

      <style>{`
        summary::-webkit-details-marker { display: none }
        details[open] summary svg { transform: rotate(180deg) }
      `}</style>
    </div>
  )
}

function legacyNoteFor(d: GuideDetailContent | null, level: GuideVerificationLevel): string {
  if (d?.legacyNotes) return d.legacyNotes
  if (level === "historically_identified") {
    return "Este código puede aparecer en tarjetones históricos. Su forma de cálculo depende del crédito o convenio específico."
  }
  return "Tenemos identificado el concepto, pero su cálculo depende de información específica que no aparece en esta ficha."
}

function Relations({ relations }: { relations: ReturnType<typeof getRelationsForConcept> }) {
  return (
    <Card padding="1rem 1.25rem" style={{ marginTop: "1rem" }}>
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", margin: "0 0 0.625rem" }}>Esto se relaciona con…</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {relations.map((r) => {
          const href = resolveRefHref(r.ref)
          const label = r.label
          if (!href || !label) return null
          return (
            <Link
              key={r.ref}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                textDecoration: "none",
              }}
            >
              <span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", display: "block" }}>{label}</span>
                {r.why && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.why}</span>}
              </span>
              <CaretRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

function displayName(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

function Section({ title, children, divider = true }: { title: string; children: ReactNode; divider?: boolean }) {
  return (
    <div style={divider ? { borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem" } : undefined}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0 }}>{title}</h3>
      {children}
    </div>
  )
}

const paragraphStyle: CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--fg)",
  lineHeight: 1.6,
  margin: "0.25rem 0 0",
}

function para(extra: CSSProperties = {}): CSSProperties {
  return { ...paragraphStyle, ...extra }
}
