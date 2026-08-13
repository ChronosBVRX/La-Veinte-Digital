"use client"

import { CheckCircle, WarningCircle, HourglassMedium, ArrowUpRight } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import type { OfficialSource, VerificationState } from "@/features/tarjeton-guia/lib/types"
import { getSourceById } from "@/data/guia-tarjeton/sources"

const VERIFICATION_META: Record<VerificationState, { icon: ReactNode; color: string; bg: string; title: string; text: string }> = {
  verified: {
    icon: <CheckCircle size={18} weight="fill" />,
    color: "#16a34a",
    bg: "#f0fdf4",
    title: "Información verificada con normativa oficial",
    text: "La asociación de esta información con el documento oficial del IMSS está confirmada. La referencia específica (cláusula, artículo o numeral) se indica cuando está disponible.",
  },
  partially_verified: {
    icon: <WarningCircle size={18} weight="fill" />,
    color: "#b45309",
    bg: "#fffbeb",
    title: "Documento oficial identificado",
    text: "El documento oficial que regula esta información está identificado, pero la referencia específica (cláusula, artículo o numeral) está en proceso de precisión.",
  },
  pending_verification: {
    icon: <HourglassMedium size={18} />,
    color: "var(--muted)",
    bg: "var(--accent)",
    title: "En proceso de verificación con documentación oficial",
    text: "Tenemos identificada esta información, pero su explicación normativa está en proceso de verificación con documentación oficial del IMSS y del CCT vigente. La información mostrada es educativa.",
  },
}

export function VerificationCard({
  state,
  sources,
}: {
  state: VerificationState
  sources?: string[]
}) {
  const meta = VERIFICATION_META[state]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          gap: "0.625rem",
          alignItems: "flex-start",
          padding: "0.75rem 0.875rem",
          borderRadius: "var(--radius-sm)",
          background: meta.bg,
          border: `1px solid ${meta.color}33`,
        }}
      >
        <div style={{ color: meta.color, marginTop: 2, flexShrink: 0 }}>{meta.icon}</div>
        <div>
          <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: meta.color, margin: 0 }}>{meta.title}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--fg)", margin: "0.25rem 0 0", lineHeight: 1.55 }}>{meta.text}</p>
        </div>
      </div>
      {!!sources?.length && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {sources.map((sid) => {
            const src = getSourceById(sid)
            if (!src) return null
            return <SourceCard key={sid} src={src} />
          })}
        </div>
      )}
    </div>
  )
}

function SourceCard({ src }: { src: OfficialSource }) {
  return (
    <div style={{ padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)", background: "var(--accent)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--primary)" }}>
          {src.documentCode ?? src.type}
        </span>
        {src.validity && <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>· {src.validity}</span>}
      </div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>{src.title}</p>
      {src.officialUrl && (
        <a
          href={src.officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)", marginTop: "0.25rem", textDecoration: "none" }}
        >
          Ver fuente oficial <ArrowUpRight size={13} weight="bold" />
        </a>
      )}
    </div>
  )
}