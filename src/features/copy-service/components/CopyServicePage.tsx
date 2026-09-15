"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import type { CSSProperties } from "react"
import {
  CopySimple,
  FileText,
  IdentificationCard,
  CheckCircle,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { DocumentScannerFlow } from "@/features/document-scanner/components/DocumentScannerFlow"
import { SendPrintModal } from "@/shared/components/app/SendPrintModal"
import type { ScanMode } from "@/shared/contracts/document-scan"

export interface CopyServicePageProps {
  userId: string | null
}

interface PendingPrintItem {
  file: File
  name: string
  alsoSaved: boolean
}

export function CopyServicePage({ userId }: CopyServicePageProps) {
  const [activeScanMode, setActiveScanMode] = useState<ScanMode | null>(null)
  const [pendingPrint, setPendingPrint] = useState<PendingPrintItem | null>(null)
  const [alsoSavedFlag, setAlsoSavedFlag] = useState(false)
  const [completedCopy, setCompletedCopy] = useState<{ name: string; alsoSaved: boolean } | null>(null)

  const wasSentRef = useRef(false)

  const handleSelectMode = (mode: ScanMode) => {
    setAlsoSavedFlag(false)
    wasSentRef.current = false
    setActiveScanMode(mode)
  }

  const handlePrintRequest = (file: File, name: string) => {
    // Al recibir el archivo, DocumentScannerFlow ya cerró su estado interno
    setActiveScanMode(null)
    setPendingPrint({
      file,
      name,
      alsoSaved: alsoSavedFlag,
    })
  }

  const handleModalClose = () => {
    if (wasSentRef.current && pendingPrint) {
      setCompletedCopy({
        name: pendingPrint.name,
        alsoSaved: pendingPrint.alsoSaved,
      })
    }
    wasSentRef.current = false
    setPendingPrint(null)
  }

  const handleResetForAnotherCopy = () => {
    setCompletedCopy(null)
    setPendingPrint(null)
    setAlsoSavedFlag(false)
    wasSentRef.current = false
    setActiveScanMode(null)
  }

  const containerStyle: CSSProperties = {
    maxWidth: "680px",
    width: "100%",
    margin: "0 auto",
    padding: "1.5rem 1rem 3rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    boxSizing: "border-box",
  }

  // ── Pantalla de éxito tras envío confirmado ──────────────────────────────────
  if (completedCopy) {
    return (
      <div style={containerStyle} data-testid="copy-service-success">
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 1rem)",
            padding: "2.5rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "1.25rem",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle size={36} weight="fill" />
          </div>

          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "var(--fg, #0f172a)" }}>
              ¡Listo!
            </h1>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "var(--fg, #0f172a)",
                margin: "0.5rem 0 0",
                lineHeight: 1.5,
                maxWidth: "460px",
              }}
            >
              Tu documento fue enviado a la computadora de la oficina sindical. Ya puedes imprimirlo.
            </p>
          </div>

          {completedCopy.alsoSaved && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                borderRadius: "0.5rem",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "0.84375rem",
                fontWeight: 600,
              }}
            >
              <CheckCircle size={18} weight="bold" />
              <span>También guardamos una copia en Mis documentos.</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              width: "100%",
              maxWidth: "320px",
              marginTop: "0.5rem",
            }}
          >
            <Button variant="primary" size="md" onClick={handleResetForAnotherCopy} fullWidth>
              Sacar otra copia
            </Button>
            <Link href="/" style={{ textDecoration: "none", width: "100%" }}>
              <Button variant="secondary" size="md" fullWidth>
                Volver al inicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Pantalla principal de selección ──────────────────────────────────────────
  return (
    <div style={containerStyle} data-testid="copy-service-page">
      {/* Botón Volver */}
      <div>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            color: "var(--muted, #64748b)",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} weight="bold" />
          <span>Volver al inicio</span>
        </Link>
      </div>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "1rem",
            background: "linear-gradient(135deg, var(--primary, #2563eb), #4f46e5)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 6px 16px rgba(37, 99, 235, 0.25)",
          }}
        >
          <CopySimple size={28} weight="bold" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 800, margin: 0, color: "var(--fg, #0f172a)", lineHeight: 1.25 }}>
            Sacar copias
          </h1>
          <p style={{ fontSize: "0.90625rem", color: "var(--muted, #64748b)", margin: "0.375rem 0 0", lineHeight: 1.45 }}>
            Escanea con tu celular y envía el documento a la computadora de la oficina sindical para imprimirlo.
          </p>
        </div>
      </div>

      {/* Banner de privacidad y destino */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
          background: "var(--accent, #f1f5f9)",
          border: "1px solid var(--border, #e2e8f0)",
          color: "var(--muted, #64748b)",
          fontSize: "0.8125rem",
          lineHeight: 1.45,
        }}
      >
        <ShieldCheck size={20} weight="duotone" style={{ color: "var(--primary, #2563eb)", flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>No se guardará automáticamente en tus documentos.</strong> El archivo solo se envía cuando escaneas el
          código QR de la computadora de la oficina.
        </span>
      </div>

      {/* Opciones de digitalización */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Opción 1: Documento */}
        <button
          type="button"
          onClick={() => handleSelectMode("document")}
          data-testid="copy-option-document"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "1.25rem",
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 1rem)",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: "inherit",
            transition: "border-color var(--transition, 0.15s ease), box-shadow var(--transition, 0.15s ease)",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "0.75rem",
              background: "rgba(37, 99, 235, 0.1)",
              color: "var(--primary, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={26} weight="duotone" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg, #0f172a)" }}>
                Documento
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--primary, #2563eb)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                Escanear <ArrowRight size={14} weight="bold" />
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg, #0f172a)", margin: "0.25rem 0 0" }}>
              Una o varias páginas
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
              Escanea hojas, oficios, recetas, formatos o cualquier documento.
            </p>
          </div>
        </button>

        {/* Opción 2: INE */}
        <button
          type="button"
          onClick={() => handleSelectMode("ine-front")}
          data-testid="copy-option-ine"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "1.25rem",
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 1rem)",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: "inherit",
            transition: "border-color var(--transition, 0.15s ease), box-shadow var(--transition, 0.15s ease)",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "0.75rem",
              background: "rgba(180, 83, 9, 0.1)",
              color: "#b45309",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IdentificationCard size={26} weight="duotone" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg, #0f172a)" }}>
                INE
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#b45309",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                Escanear <ArrowRight size={14} weight="bold" />
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg, #0f172a)", margin: "0.25rem 0 0" }}>
              Frente y reverso en una sola hoja
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
              Captura ambas caras de tu credencial y se acomodarán automáticamente en una sola hoja tamaño carta.
            </p>
          </div>
        </button>
      </div>

      {/* Motor de digitalización reutilizado */}
      {activeScanMode && (
        <DocumentScannerFlow
          open={!!activeScanMode}
          mode={activeScanMode}
          intent="print"
          userId={userId}
          onClose={() => setActiveScanMode(null)}
          onSaved={() => {
            setAlsoSavedFlag(true)
          }}
          onPrintRequest={handlePrintRequest}
        />
      )}

      {/* Flujo QR existente para transferir el PDF a la computadora */}
      {pendingPrint && (
        <SendPrintModal
          open={!!pendingPrint}
          docName={pendingPrint.name}
          getFile={async () => pendingPrint.file}
          onSent={() => {
            wasSentRef.current = true
          }}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
