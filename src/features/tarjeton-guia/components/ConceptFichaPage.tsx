"use client"

import Link from "next/link"
import { CaretRight, Calculator, Article, Question, ChalkboardTeacher, ArrowsClockwise } from "@phosphor-icons/react"
import type { CSSProperties, ReactNode } from "react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { ActionLink } from "@/shared/components/ui/ActionLink"
import { Tabs } from "@/shared/components/ui/Tabs"
import { getGuideConceptWithDetails, getRelationsForConcept, resolveRefHref, getManualSource } from "@/features/tarjeton-guia/lib/catalog"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import type { GuideDetailContent } from "@/features/tarjeton-guia/data/concept-details"

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
            ¿Buscarías <Link href="/guia/conceptos" style={{ color: "var(--primary)", fontWeight: 600 }}>otro concepto</Link>?
          </p>
        </Card>
      </div>
    )
  }

  const kind = entry.kind === "perception" ? "Percepción" : "Deducción"
  const d = entry.details
  const manual = entry.manual2023.detail
  const manualSource = getManualSource()
  const relations = getRelationsForConcept(entry.code)
  const hasEnoughInfo = !!d?.simple

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de conceptos"
        title={`${entry.code} · ${displayName(entry.name)}`}
        backHref="/guia/conceptos"
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Badge variant={kind === "Percepción" ? "info" : "warning"}>{kind}</Badge>
        <Badge variant="neutral">Referencia educativa 2023</Badge>
      </div>

      {hasEnoughInfo ? (
        <Tabs
          defaultTab="facil"
          tabs={[
            { id: "facil", label: "Fácil", icon: <ChalkboardTeacher size={16} /> },
            { id: "detallado", label: "Detallado", icon: <ArrowsClockwise size={16} /> },
            { id: "fundamento", label: "Fundamento", icon: <Article size={16} /> },
          ]}
        >
          {(active) => {
            if (active === "detallado") return <DetalladoTab d={d} manual={manual} />
            if (active === "fundamento") return <FundamentoTab sources={d?.sources} manualPages={manual.map((m) => m.page)} manualSource={manualSource} />
            return (
              <FacilTab d={d} kindLabel={kind} manualPages={manual.map((m) => m.page)} />
            )
          }}
        </Tabs>
      ) : (
        <Card padding="1.5rem" variant="subtle">
          <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.375rem" }}>Información insuficiente</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Tenemos identificado este concepto, pero todavía no contamos con información suficiente para ofrecer una explicación completa y confiable.
          </p>
          {manual.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
              Referencia del Manual de orientación al tarjetón (2023): páginas {unique(manual.map((m) => m.page)).join(", ")}.
            </p>
          )}
        </Card>
      )}

      {relations.length > 0 && (
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
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <ActionLink href="/tarjeton" variant="secondary" size="md">Revisar en mi tarjetón</ActionLink>
        {d?.calculator ? (
          <ActionLink href={d.calculator.route} size="md">
            <Calculator size={16} /> {d.calculator.label}
          </ActionLink>
        ) : (
          <ActionLink href="/guia/conceptos" variant="ghost" size="md">Buscar otro concepto</ActionLink>
        )}
      </div>
    </div>
  )
}

function displayName(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

function unique(values: number[]): number[] {
  return Array.from(new Set(values))
}

function FacilTab({ d, kindLabel, manualPages }: { d: GuideDetailContent | null; kindLabel: string; manualPages: number[] }) {
  if (!d) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Section title="En palabras simples">
        <p style={para()}>{d.simple}</p>
      </Section>
      {d.whyItMatters && (
        <Section title="¿Por qué debería importarme?">
          <p style={para()}>{d.whyItMatters}</p>
        </Section>
      )}
      <Section title="¿Dónde aparece?">
        <p style={para()}>
          <Badge variant={kindLabel === "Percepción" ? "info" : "warning"}>{kindLabel}</Badge>{" "}
          En la sección correspondiente de tu tarjetón
          {manualPages.length > 0 && <span style={{ color: "var(--muted)" }}> · manual 2023, págs. {unique(manualPages).join(", ")}</span>}
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.375rem" }}>{title}</h3>
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

function DetalladoTab({ d, manual }: { d: GuideDetailContent | null; manual: { page: number; text: string }[] }) {
  if (!d) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {d.whyItAppears && (
        <Section title="¿Por qué aparece?">
          <p style={para()}>{d.whyItAppears}</p>
        </Section>
      )}
      {d.whenItAppears && (
        <Section title="¿Cuándo debería aparecer?">
          <p style={para()}>{d.whenItAppears}</p>
        </Section>
      )}
      {d.affects && d.affects.length > 0 && (
        <Section title="¿Qué puede hacer que no lo genere?">
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {d.affects.map((a) => (
              <li key={a} style={para({ margin: 0 })}>{a}</li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="¿Cómo se calcula?">
        {d.calculator ? (
          <p style={para()}>
            <ActionLink href={d.calculator.route} size="sm">
              <Calculator size={14} /> {d.calculator.label}
            </ActionLink>
          </p>
        ) : (
          <p style={para({ color: "var(--muted)" })}>
            Disponemos de una referencia del manual 2023, pero no la presentamos como vigente hasta validarla con la normativa actual del proyecto. Si quieres calcular una prestación, usa el simulador correspondiente desde la ficha.
          </p>
        )}
      </Section>
      {manual.length > 0 && (
        <Section title="Referencia del manual">
          <p style={para({ color: "var(--muted)" })}>
            El manual 2023 aborda este concepto en {unique(manual.map((m) => m.page)).join(", ")} página(s).
          </p>
        </Section>
      )}
    </div>
  )
}

function FundamentoTab({ sources, manualPages, manualSource }: { sources?: string[]; manualPages: number[]; manualSource: ReturnType<typeof getManualSource> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Section title="Referencias">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {sources?.map((sid) => {
            const items: Record<string, string> = {
              "manual-imss-2023": "Manual de orientación al tarjetón de pago del trabajador del IMSS (2023)",
              "cct-2023-2025-mentioned": "Contrato Colectivo de Trabajo 2023–2025 (mencionado por el manual)",
              "rit-mentioned": "Reglamento Interior de Trabajo (citado por el manual)",
            }
            return (
              <div key={sid} style={{ padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)", background: "var(--accent)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                {items[sid] ?? sid}
              </div>
            )
          })}
          {manualPages.length > 0 && (
            <div style={{ padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)", background: "var(--accent)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Manual de orientación al tarjetón · páginas {unique(manualPages).join(", ")}
            </div>
          )}
          {manualSource?.notes && (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
              {manualSource.notes}
            </div>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            La información de este catálogo proviene de una fuente de referencia (2023). Las reglas vigentes de cálculo viven en los motores de La Veinte Digital.
          </p>
        </div>
      </Section>
    </div>
  )
}
