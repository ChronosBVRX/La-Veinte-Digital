"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { SendPrintModal } from "@/shared/components/app/SendPrintModal"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import {
  generarNombreArchivoPdf,
  imprimirEscrito,
  renderStoredEscritoToPdfFile,
} from "@/shared/lib/escrito-pdf-renderer"
import { SignaturePadModal } from "./SignaturePadModal"
import { deleteBlobResource } from "../services/escritos-indexeddb"
import { DestinatarioResumen } from "./DestinatarioResumen"
import { sharePdfViaNativeBridge, isNativePdfShareSupported } from "@/shared/services/pdfShareBridge"

export interface EscritosResultProps {
  userId: string
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onSaveDraft: () => void
  onBackToEditor: () => void
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }
}

export function EscritosResult({
  userId,
  draft,
  onUpdateDraft,
  onSaveDraft,
  onBackToEditor,
  workerProfile,
}: EscritosResultProps) {
  const [viewMode, setViewMode] = useState<"mobile" | "sheet">("sheet")
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [isSendPrintOpen, setIsSendPrintOpen] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const handleSaveSignature = (firmaRef: string, previewUrl: string) => {
    onUpdateDraft({
      firmaRef,
      firmaPreviewUrl: previewUrl,
    })
  }

  const handleRemoveSignature = async () => {
    if (draft.firmaRef) {
      await deleteBlobResource(userId, draft.firmaRef).catch(() => {})
    }
    if (draft.firmaPreviewUrl && draft.firmaPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(draft.firmaPreviewUrl)
    }
    onUpdateDraft({
      firmaRef: undefined,
      firmaPreviewUrl: undefined,
    })
  }

  const handleDirectPrint = async () => {
    setIsPrinting(true)
    try {
      await imprimirEscrito(draft, userId, {
        nombreTrabajador: workerProfile?.nombre,
        nombre: workerProfile?.nombre,
        matricula: workerProfile?.matricula,
        categoria: workerProfile?.categoria,
        adscripcion: workerProfile?.adscripcion,
      })
    } catch (err) {
      console.error("Error al imprimir:", err)
      alert("No fue posible iniciar la impresión directa.")
    } finally {
      setIsPrinting(false)
    }
  }

  const handleOpenPrintModal = () => {
    setIsSendPrintOpen(true)
  }

  const handleNativeShare = async () => {
    setIsSharing(true)
    try {
      const file = await renderStoredEscritoToPdfFile(draft, userId, {
        nombreTrabajador: workerProfile?.nombre,
        nombre: workerProfile?.nombre,
        matricula: workerProfile?.matricula,
        categoria: workerProfile?.categoria,
        adscripcion: workerProfile?.adscripcion,
      })

      if (isNativePdfShareSupported()) {
        const result = await sharePdfViaNativeBridge(file, draft.titulo || "Escrito Formal.pdf")
        if (result.ok) {
          setIsSharing(false)
          return
        }
      }

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: draft.titulo || "Escrito Formal",
          text: `Escrito formal: ${draft.asunto || draft.titulo || "IMSS - SNTSS"}`,
        })
      } else if (typeof window !== "undefined" && window.LaVeinteApp?.share) {
        window.LaVeinteApp.share(
          draft.titulo || "Escrito Formal",
          `Escrito formal: ${draft.asunto || draft.titulo || "IMSS - SNTSS"}`
        )
      } else {
        // Fallback a descarga si el navegador de escritorio no tiene Web Share API
        const url = URL.createObjectURL(file)
        const a = document.createElement("a")
        a.href = url
        a.download = generarNombreArchivoPdf(draft)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error compartiendo:", err)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Selector de modo de vista y Acciones Principales */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: "0.25rem", background: "var(--card)", padding: "0.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setViewMode("sheet")}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.375rem",
              border: "none",
              fontSize: "clamp(0.72rem, 2.5vw, 0.8125rem)",
              fontWeight: 600,
              background: viewMode === "sheet" ? "var(--primary)" : "transparent",
              color: viewMode === "sheet" ? "var(--primary-fg)" : "var(--muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📄 Hoja Carta (Oficio)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mobile")}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.375rem",
              border: "none",
              fontSize: "clamp(0.72rem, 2.5vw, 0.8125rem)",
              fontWeight: 600,
              background: viewMode === "mobile" ? "var(--primary)" : "transparent",
              color: viewMode === "mobile" ? "var(--primary-fg)" : "var(--muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📱 Lectura Móvil
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" onClick={onSaveDraft}>
            📁 Guardar en mis documentos
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenPrintModal} loading={isPrinting}>
            🖨 Imprimir
          </Button>
          <Button variant="primary" size="sm" onClick={handleNativeShare} loading={isSharing}>
            📲 Compartir
          </Button>
        </div>
      </div>

      {/* Renderizado Vista Hoja Carta (Formato Oficio Fiel al PDF) */}
      {viewMode === "sheet" ? (
        <div
          style={{
            background: "#ffffff",
            color: "#0f172a",
            borderRadius: "0.75rem",
            padding: "clamp(1.25rem, 4vw, 2.5rem) clamp(0.875rem, 3vw, 2rem)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
            border: "1px solid var(--border)",
            fontFamily: "Times New Roman, Times, serif",
            fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
            lineHeight: 1.5,
            maxWidth: "700px",
            margin: "0 auto",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {/* Lugar y Fecha */}
          <div style={{ textAlign: "right", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
            {draft.ciudad ? `${draft.ciudad}, ` : ""}
            {draft.fecha}
          </div>

          {/* Asunto */}
          {draft.asunto && (
            <div style={{ textAlign: "right", fontWeight: "bold", marginBottom: "1.5rem", fontSize: "0.9375rem" }}>
              ASUNTO: {draft.asunto}
            </div>
          )}

          {/* Destinatario Principal */}
          <div style={{ marginBottom: "1.25rem" }}>
            {draft.destino.nombre && (
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "1rem" }}>
                {draft.destino.nombre}
              </div>
            )}
            {draft.destino.cargo && (
              <div style={{ fontSize: "0.9375rem" }}>
                {draft.destino.cargo}
              </div>
            )}

            {/* Atenciones Múltiples */}
            {draft.atencion.length > 0 && (
              <div style={{ marginTop: "0.5rem", fontStyle: "italic", fontSize: "0.875rem" }}>
                {draft.atencion.map((at) => (
                  <div key={at.id}>
                    AT&apos;N: {at.nombre} {at.cargo ? `(${at.cargo})` : ""}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontWeight: "bold", marginTop: "0.75rem", letterSpacing: "1px" }}>
              P R E S E N T E .
            </div>
          </div>

          {/* Cuerpo del Documento */}
          <div style={{ textAlign: "justify", marginBottom: "2rem" }}>
            {draft.cuerpo.split(/\n\s*\n/).map((para, idx) => (
              <p key={idx} style={{ margin: "0 0 1rem", textIndent: "clamp(0.75rem, 3vw, 1.5rem)" }}>
                {para}
              </p>
            ))}
          </div>

          {/* Bloque de Despedida y Firma */}
          <div style={{ textAlign: "center", marginTop: "2rem", pageBreakInside: "avoid" }}>
            <div style={{ fontWeight: "bold", marginBottom: "0.5rem", letterSpacing: "1px" }}>
              A T E N T A M E N T E
            </div>

            {/* Firma Gráfica */}
            <div style={{ minHeight: "60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0.75rem 0" }}>
              {draft.firmaPreviewUrl ? (
                <div>
                  <img
                    src={draft.firmaPreviewUrl}
                    alt="Firma del trabajador"
                    style={{ maxHeight: "60px", maxWidth: "160px", objectFit: "contain" }}
                  />
                  <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.25rem", justifyContent: "center" }}>
                    <Button variant="ghost" size="sm" onClick={() => setIsSignatureModalOpen(true)}>
                      Cambiar firma
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleRemoveSignature}>
                      Quitar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSignatureModalOpen(true)}
                  style={{ border: "1px dashed var(--border)" }}
                >
                  ✍️ Insertar firma digitalizada
                </Button>
              )}
            </div>

            {/* Línea de firma */}
            <div style={{ width: "clamp(160px, 45vw, 220px)", borderTop: "1px solid #0f172a", margin: "0 auto 0.5rem" }} />

            <div style={{ fontWeight: "bold", fontSize: "0.9375rem", textTransform: "uppercase" }}>
              {workerProfile?.nombre || "NOMBRE DEL TRABAJADOR"}
            </div>
            {workerProfile?.matricula && (
              <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                Matrícula: {workerProfile.matricula}
              </div>
            )}
            {workerProfile?.categoria && (
              <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                Categoría: {workerProfile.categoria}
              </div>
            )}
            {workerProfile?.adscripcion && (
              <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                Adscripción: {workerProfile.adscripcion}
              </div>
            )}
          </div>

          {/* Copias (c.c.p.) */}
          {draft.copias.length > 0 && (
            <div style={{ marginTop: "2rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
              <div>c.c.p.</div>
              {draft.copias.map((cp) => (
                <div key={cp.id}>
                  - {cp.nombre} {cp.cargo ? `(${cp.cargo})` : ""}
                </div>
              ))}
            </div>
          )}

          {/* Galería de Anexos Adjuntos */}
          {draft.anexos.length > 0 && (
            <div style={{ marginTop: "2.5rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem", width: "100%", boxSizing: "border-box" }}>
              <div style={{ fontWeight: "bold", fontSize: "0.875rem", textTransform: "uppercase", marginBottom: "1rem", color: "#334155" }}>
                Anexos adjuntos ({draft.anexos.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", boxSizing: "border-box" }}>
                {draft.anexos.map((anx, i) => (
                  <div key={anx.id} style={{ background: "#f8fafc", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem", overflowWrap: "break-word" }}>
                      Anexo {i + 1}: {anx.nombre}
                    </div>
                    {anx.descripcion && (
                      <div style={{ fontSize: "0.8125rem", color: "#64748b", fontStyle: "italic", marginBottom: "0.75rem", overflowWrap: "break-word" }}>
                        {anx.descripcion}
                      </div>
                    )}
                    {anx.previewUrl && (
                      <img
                        src={anx.previewUrl}
                        alt={anx.nombre}
                        style={{ maxWidth: "100%", maxHeight: "350px", height: "auto", objectFit: "contain", borderRadius: "0.375rem", border: "1px solid #cbd5e1", display: "block" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Renderizado Vista Lectura Móvil */
        <Card padding="1.25rem" style={{ width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)", overflowWrap: "break-word" }}>
                {draft.titulo}
              </div>
              <span style={{ fontSize: "0.75rem", background: "var(--accent)", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", color: "var(--muted)" }}>
                {draft.fecha}
              </span>
            </div>

            <DestinatarioResumen destino={draft.destino} readOnly />

            {draft.asunto && (
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)", overflowWrap: "break-word" }}>
                Asunto: {draft.asunto}
              </div>
            )}

            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--fg)", overflowWrap: "break-word" }}>
              {draft.cuerpo}
            </div>

            {draft.anexos.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", width: "100%", boxSizing: "border-box" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
                  Anexos fotográficos ({draft.anexos.length}):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 100px), 1fr))", gap: "0.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
                  {draft.anexos.map((anx) => (
                    <div key={anx.id} style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", overflow: "hidden", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      {anx.previewUrl ? (
                        <img src={anx.previewUrl} alt={anx.nombre} style={{ width: "100%", height: "80px", objectFit: "cover" }} />
                      ) : (
                        <div style={{ height: "80px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>📷</div>
                      )}
                      <div style={{ padding: "0.25rem", fontSize: "0.6875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {anx.nombre}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Modal de Firma */}
      <SignaturePadModal
        userId={userId}
        escritoId={draft.id}
        previousFirmaRef={draft.firmaRef}
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
      />

      {/* Modal de Impresión y Transferencia (Mismo sistema que Tarjetones y Checadas) */}
      <SendPrintModal
        open={isSendPrintOpen}
        docName={draft.titulo || "Escrito Formal"}
        getFile={async () => {
          return renderStoredEscritoToPdfFile(draft, userId, {
            nombreTrabajador: workerProfile?.nombre,
            nombre: workerProfile?.nombre,
            matricula: workerProfile?.matricula,
            categoria: workerProfile?.categoria,
            adscripcion: workerProfile?.adscripcion,
          })
        }}
        onClose={() => setIsSendPrintOpen(false)}
        onDirectPrint={handleDirectPrint}
      />

      {/* Barra de Acciones Final */}
      <div
        style={{
          position: "sticky",
          bottom: "1rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "0.75rem 0.875rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          zIndex: 10,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <Button variant="ghost" size="sm" onClick={onBackToEditor}>
          ✏ Volver al editor
        </Button>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button variant="secondary" size="md" onClick={onSaveDraft}>
            📁 Guardar en mis documentos
          </Button>
          <Button variant="secondary" size="md" onClick={handleOpenPrintModal} loading={isPrinting}>
            🖨 Imprimir
          </Button>
          <Button variant="primary" size="md" onClick={handleNativeShare} loading={isSharing}>
            📲 Compartir
          </Button>
        </div>
      </div>
    </div>
  )
}
