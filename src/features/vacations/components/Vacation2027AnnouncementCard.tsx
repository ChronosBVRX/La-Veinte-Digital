"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { CalendarCheck, ArrowRight } from "@phosphor-icons/react"

const containerSection: CSSProperties = {
  marginBottom: "var(--space-4, 1rem)",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
}

const cardLink: CSSProperties = {
  display: "block",
  textDecoration: "none",
  borderRadius: "var(--radius-lg, 1rem)",
  padding: "1.1rem 1.25rem",
  background: "linear-gradient(135deg, #064e3b 0%, #047857 55%, #0d9488 100%)",
  color: "#ffffff",
  boxShadow: "0 6px 20px rgba(6, 78, 59, 0.28)",
  border: "1px solid rgba(167, 243, 208, 0.22)",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  overflowWrap: "break-word",
  cursor: "pointer",
}

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minWidth: 0,
}

const iconBadge: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "rgba(167, 243, 208, 0.2)",
  color: "#a7f3d0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}

const labelBadge: CSSProperties = {
  fontSize: "var(--text-xs, 0.75rem)",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#a7f3d0",
}

const contentLayout: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  minWidth: 0,
  width: "100%",
  marginTop: "0.5rem",
}

const textBlock: CSSProperties = {
  minWidth: 0,
  flex: "1 1 260px",
}

const titleStyle: CSSProperties = {
  fontSize: "var(--text-md, 1rem)",
  fontWeight: 800,
  lineHeight: 1.35,
  color: "#ffffff",
  margin: 0,
}

const descriptionStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  fontSize: "var(--text-sm, 0.875rem)",
  lineHeight: 1.5,
  color: "#d1fae5",
  overflowWrap: "break-word",
}

const ctaPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.45rem 0.95rem",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.16)",
  border: "1px solid rgba(255, 255, 255, 0.35)",
  color: "#ffffff",
  fontSize: "var(--text-sm, 0.875rem)",
  fontWeight: 700,
  whiteSpace: "nowrap",
  flexShrink: 0,
  alignSelf: "flex-start",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
}

/**
 * Anuncio destacado en Inicio sobre la disponibilidad de los roles vacacionales 2027.
 * Componente ligero sin consultas externas, con enlace directo a /vacaciones.
 */
export function Vacation2027AnnouncementCard() {
  return (
    <section
      aria-label="Roles vacacionales 2027"
      data-testid="vacation-2027-announcement-card"
      style={containerSection}
    >
      <Link
        href="/vacaciones"
        aria-label="Ya están disponibles los roles vacacionales 2027. Ver roles 2027"
        className="vacation-2027-announcement-link"
        data-testid="vacation-2027-announcement-link"
        style={cardLink}
      >
        <div style={headerRow}>
          <span style={iconBadge} aria-hidden="true">
            <CalendarCheck size={16} weight="bold" />
          </span>
          <span style={labelBadge}>NUEVO · 2027</span>
        </div>

        <div style={contentLayout}>
          <div style={textBlock}>
            <h2 style={titleStyle}>
              Ya están disponibles los roles vacacionales 2027
            </h2>
            <p style={descriptionStyle}>
              Consulta las fechas oficiales y revisa los roles disponibles para organizar con tiempo tus vacaciones del próximo año.
            </p>
          </div>

          <div style={{ flexShrink: 0 }}>
            <span className="vacation-2027-cta" style={ctaPill}>
              <span>Ver roles 2027</span>
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>

      <style>{`
        .vacation-2027-announcement-link {
          transition: transform var(--transition, 0.15s ease), box-shadow var(--transition, 0.15s ease);
        }
        .vacation-2027-announcement-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(6, 78, 59, 0.38) !important;
        }
        .vacation-2027-announcement-link:hover .vacation-2027-cta {
          background: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
        }
        .vacation-2027-announcement-link:focus-visible {
          outline: 2px solid #34d399 !important;
          outline-offset: 3px !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .vacation-2027-announcement-link {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  )
}
