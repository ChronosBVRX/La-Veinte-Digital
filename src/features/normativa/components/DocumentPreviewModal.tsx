"use client"

import { useEffect, useState, useMemo, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import {
  X,
  BookOpen,
  FileText,
  Users,
  CheckCircle2,
  ShieldCheck,
  Calendar,
} from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { getOrSynthesizePreambulo, formatDocSubtitle } from "../lib/preambulo-helper"
import { useBackLayer } from "@/shared/navigation/useBackLayer"
import { Z_INDEX } from "@/shared/constants/z-index"

interface Props {
  doc: LibraryDocumentEntry | null
  isOpen: boolean
  onClose: () => void
  onOpenReader: (doc: LibraryDocumentEntry) => void
}

function getValidityBadge(val: string): { label: string; color: string; bg: string } {
  switch (val) {
    case "CURRENT":
      return { label: "🟢 VIGENTE", color: "#15803d", bg: "rgba(22, 163, 74, 0.1)" }
    case "PENDING_REVIEW":
      return { label: "🟡 EN REVISIÓN", color: "#b45309", bg: "rgba(217, 119, 6, 0.1)" }
    case "HISTORICAL":
      return { label: "🔵 HISTÓRICO", color: "#1d4ed8", bg: "rgba(37, 99, 235, 0.1)" }
    case "EXPIRED":
      return { label: "⚪ VENCIDO", color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" }
    case "SUPERSEDED":
      return { label: "⚪ SUSTITUIDO", color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" }
    case "REPEALED":
      return { label: "⚪ ABROGADO", color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" }
    default:
      return { label: "⚪ CONSULTABLE", color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" }
  }
}

export function DocumentPreviewModal({ doc, isOpen, onClose, onOpenReader }: Props) {
  const [isDesktop, setIsDesktop] = useState(false)

  // Integración canónica con el Back de Android/iOS y web mediante pila LIFO
  useBackLayer(isOpen && Boolean(doc), onClose, "normativa-doc-preview")

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(typeof window !== "undefined" && window.innerWidth >= 768)
    }
    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  // Sincronización de scroll lock y soporte de tecla Escape
  useEffect(() => {
    if (!isOpen || !doc) return

    const origOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, doc, onClose])

  const preambulo = useMemo(() => {
    if (!doc) return null
    return getOrSynthesizePreambulo(doc)
  }, [doc])

  const subtitle = useMemo(() => {
    if (!doc) return ""
    return formatDocSubtitle(doc)
  }, [doc])

  if (!isOpen || !doc || !preambulo) return null
  if (typeof document === "undefined") return null

  const vBadge = getValidityBadge(doc.validity)

  const handleOpenReader = () => {
    onClose()
    onOpenReader(doc)
  }

  return createPortal(
    <div
      style={{
        ...overlayStyle,
        alignItems: isDesktop ? "center" : "flex-end",
        padding: isDesktop ? "1.5rem" : 0,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-preview-title"
    >
      <div
        style={{
          ...modalContainerStyle,
          borderRadius: isDesktop ? 16 : "18px 18px 0 0",
          maxWidth: isDesktop ? 620 : "100%",
          maxHeight: isDesktop ? "86vh" : "90dvh",
          padding: isDesktop
            ? "1.5rem"
            : "1.25rem 1rem calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA: Badges de clave, validez y botón de cierre */}
        <div style={headerContainerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.18rem 0.5rem",
                  borderRadius: 6,
                  background: vBadge.bg,
                  color: vBadge.color,
                  border: `1px solid ${vBadge.color}33`,
                }}
              >
                {vBadge.label}
              </span>

              {(doc.key || preambulo.claveOficial) && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.18rem 0.5rem",
                    borderRadius: 6,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "var(--primary)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                  }}
                >
                  {doc.key || preambulo.claveOficial}
                </span>
              )}

              {subtitle && (
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {subtitle}
                </span>
              )}
            </div>

            <h2
              id="modal-preview-title"
              style={{
                margin: "0.2rem 0 0",
                fontSize: "clamp(1rem, 3.5vw, 1.2rem)",
                fontWeight: 700,
                color: "var(--fg)",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {preambulo.tituloComun || doc.title}
            </h2>

            {preambulo.vigenciaTexto && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.74rem", color: "var(--muted)" }}>
                <Calendar size={13} style={{ flexShrink: 0 }} />
                <span>{preambulo.vigenciaTexto}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            title="Cerrar ventana (Esc)"
            aria-label="Cerrar ventana informativa"
          >
            <X size={18} />
          </button>
        </div>

        {/* FRASE DE RESUMEN CLAVE */}
        {preambulo.enUnaFrase && (
          <div style={enUnaFraseCardStyle}>
            <span style={{ fontWeight: 600, color: "var(--primary)", lineHeight: 1.4, fontSize: "0.82rem" }}>
              {preambulo.enUnaFrase}
            </span>
          </div>
        )}

        {/* SECCIÓN 1: ¿QUÉ CONTIENE ESTE DOCUMENTO? */}
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <h3 style={sectionHeadingStyle}>¿Qué contiene este documento?</h3>
          </div>
          <p style={paragraphStyle}>
            {preambulo.preambulo}
          </p>

          {/* Temas o puntos clave */}
          {preambulo.temasClave && preambulo.temasClave.length > 0 && (
            <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--fg)" }}>
                Aspectos principales que regula:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {preambulo.temasClave.slice(0, 4).map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.15rem",
                      padding: "0.4rem 0.55rem",
                      background: "var(--card)",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: "0.74rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "var(--fg)" }}>{t.tema}</strong>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)" }}>
                        {t.referencia}
                      </span>
                    </div>
                    <span style={{ color: "var(--muted)", lineHeight: 1.35 }}>{t.queEncontraras}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!preambulo.temasClave || preambulo.temasClave.length === 0) &&
            preambulo.aquiPuedesEncontrar &&
            preambulo.aquiPuedesEncontrar.length > 0 && (
              <div style={{ marginTop: "0.55rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--fg)" }}>
                  Disposiciones principales:
                </span>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
                  {preambulo.aquiPuedesEncontrar.slice(0, 4).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {/* SECCIÓN 2: ¿PARA QUIÉN APLICA? */}
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <Users size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <h3 style={sectionHeadingStyle}>¿Para quién aplica?</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {preambulo.aQuienAplica && preambulo.aQuienAplica.length > 0 ? (
              preambulo.aQuienAplica.map((rol, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.45rem",
                    fontSize: "0.76rem",
                    color: "var(--fg)",
                    lineHeight: 1.35,
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{rol}</span>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--muted)" }}>
                Personal del Instituto Mexicano del Seguro Social y ramas laborales correspondientes.
              </p>
            )}
          </div>
        </div>

        {/* SECCIÓN DE RESPALDO SINDICAL O ATENCIÓN */}
        {preambulo.ojoConEsto && preambulo.ojoConEsto.length > 0 && (
          <div style={{ ...sectionCardStyle, background: "rgba(37, 99, 235, 0.04)", borderColor: "rgba(37, 99, 235, 0.2)" }}>
            <div style={sectionHeaderStyle}>
              <ShieldCheck size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <h3 style={{ ...sectionHeadingStyle, color: "var(--primary)" }}>
                Respaldo y consideraciones laborales
              </h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.75rem", color: "var(--fg)", lineHeight: 1.4 }}>
              {preambulo.ojoConEsto.map((ojo, idx) => (
                <li key={idx} style={{ marginBottom: "0.2rem" }}>{ojo}</li>
              ))}
            </ul>
          </div>
        )}

        {/* BARRA INFERIOR DE ACCIONES */}
        <div style={footerContainerStyle}>
          <button
            type="button"
            onClick={handleOpenReader}
            style={primaryOpenBtnStyle}
            title="Abrir documento en el lector oficial interactivo"
          >
            <BookOpen size={16} />
            <span>Abrir documento en el lector</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={secondaryCloseBtnStyle}
            title="Regresar a la cuadrícula de documentos"
          >
            <span>Volver al catálogo</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: Z_INDEX.fullscreen,
  background: "rgba(15, 23, 42, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  overflow: "hidden",
}

const modalContainerStyle: CSSProperties = {
  background: "var(--card)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  width: "100%",
  boxSizing: "border-box",
  overflowY: "auto",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
  userSelect: "text",
}

const headerContainerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.75rem",
}

const closeBtnStyle: CSSProperties = {
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: "50%",
  width: 34,
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--muted)",
  flexShrink: 0,
  transition: "all 0.15s ease",
}

const enUnaFraseCardStyle: CSSProperties = {
  background: "rgba(37, 99, 235, 0.06)",
  borderLeft: "3.5px solid var(--primary)",
  padding: "0.6rem 0.8rem",
  borderRadius: "0 8px 8px 0",
}

const sectionCardStyle: CSSProperties = {
  background: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "0.75rem 0.85rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
}

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
}

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.82rem",
  fontWeight: 700,
  color: "var(--fg)",
}

const paragraphStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  color: "var(--fg)",
  lineHeight: 1.45,
  whiteSpace: "pre-line",
}

const footerContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
  marginTop: "0.4rem",
  paddingTop: "0.6rem",
  borderTop: "1px solid var(--border)",
}

const primaryOpenBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.45rem",
  fontSize: "0.86rem",
  fontWeight: 700,
  padding: "0.7rem 1rem",
  borderRadius: 8,
  background: "var(--primary)",
  color: "#ffffff",
  border: "none",
  cursor: "pointer",
  width: "100%",
  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
}

const secondaryCloseBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.8rem",
  fontWeight: 600,
  padding: "0.5rem 1rem",
  borderRadius: 8,
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid var(--border)",
  cursor: "pointer",
  width: "100%",
}
