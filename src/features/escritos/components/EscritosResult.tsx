"use client"

import { useState, useCallback } from "react"
import { Button } from "@/shared/components/ui/Button"
import { SignaturePadModal } from "./SignaturePadModal"
import { renderEscritoToPdf, imprimirEscrito, generarNombreArchivoPdf } from "@/shared/lib/escrito-pdf-renderer"
import type { EscritoDraftV2, WorkerProfileContext } from "@/shared/contracts/escrito-draft"

interface EscritosResultProps {
  draft: EscritoDraftV2
  profile: WorkerProfileContext | null
  onEdit: () => void
  onSave: (tituloPersonalizado?: string) => void
  onClose: () => void
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  hasUnsavedChanges?: boolean
}

export function EscritosResult({
  draft,
  profile,
  onEdit,
  onSave,
  onClose,
  onUpdateDraft,
  hasUnsavedChanges = false,
}: EscritosResultProps) {
  const [modoVista, setModoVista] = useState<"lectura" | "hoja">("lectura")
  const [mostrarFirmaPad, setMostrarFirmaPad] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [mostrarModalGuardar, setMostrarModalGuardar] = useState(false)
  const [tituloGuardar, setTituloGuardar] = useState(draft.titulo || "")
  const [mostrarConfirmCerrar, setMostrarConfirmCerrar] = useState(false)

  const fechaLarga = draft.fecha
    ? new Date(draft.fecha + "T12:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : ""

  const handleDescargarPdf = async () => {
    setDescargando(true)
    try {
      const doc = await renderEscritoToPdf(draft, profile || undefined)
      const filename = generarNombreArchivoPdf(draft)
      doc.save(filename)
    } catch (e) {
      console.error("[EscritosResult] Error descargando PDF:", e)
      alert("No se pudo generar el archivo PDF. Por favor intenta de nuevo.")
    } finally {
      setDescargando(false)
    }
  }

  const handleImprimir = async () => {
    setImprimiendo(true)
    try {
      await imprimirEscrito(draft, profile || undefined)
    } catch (e) {
      console.error("[EscritosResult] Error imprimiendo PDF:", e)
      alert("No se pudo preparar la impresión del documento.")
    } finally {
      setImprimiendo(false)
    }
  }

  const handleGuardarFirma = useCallback((dataUrl: string) => {
    onUpdateDraft({ firmaUrl: dataUrl })
  }, [onUpdateDraft])

  const handleQuitarFirma = useCallback(() => {
    onUpdateDraft({ firmaUrl: undefined })
  }, [onUpdateDraft])

  const handleConfirmarGuardar = () => {
    onSave(tituloGuardar.trim() || draft.titulo)
    setMostrarModalGuardar(false)
  }

  const handleIntentarCerrar = () => {
    if (hasUnsavedChanges) {
      setMostrarConfirmCerrar(true)
    } else {
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.95)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: 960,
          maxHeight: "96vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Barra superior de controles */}
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "var(--accent)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <h2 id="preview-modal-title" style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
              Vista final del documento
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
              <button
                type="button"
                onClick={() => setModoVista("lectura")}
                style={{
                  background: modoVista === "lectura" ? "var(--primary)" : "transparent",
                  color: modoVista === "lectura" ? "var(--primary-fg)" : "var(--muted)",
                  border: "none",
                  borderRadius: "0.25rem",
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Vista de lectura
              </button>
              <button
                type="button"
                onClick={() => setModoVista("hoja")}
                style={{
                  background: modoVista === "hoja" ? "var(--primary)" : "transparent",
                  color: modoVista === "hoja" ? "var(--primary-fg)" : "var(--muted)",
                  border: "none",
                  borderRadius: "0.25rem",
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Ver hoja completa (Carta)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="secondary" size="sm" onClick={() => setMostrarFirmaPad(true)}>
              ✍ {draft.firmaUrl ? "Cambiar firma" : "Añadir firma"}
            </Button>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              ✏ Editar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTituloGuardar(draft.titulo || "")
                setMostrarModalGuardar(true)
              }}
            >
              💾 Guardar
            </Button>
            <Button variant="secondary" size="sm" onClick={handleImprimir} loading={imprimiendo}>
              🖨 Imprimir
            </Button>
            <Button variant="primary" size="sm" onClick={handleDescargarPdf} loading={descargando}>
              📄 Descargar PDF
            </Button>
            <button
              onClick={handleIntentarCerrar}
              aria-label="Cerrar vista previa"
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.25rem",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0.25rem",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenedor del documento */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.5rem",
            background: modoVista === "hoja" ? "#334155" : "var(--bg)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {modoVista === "lectura" ? (
            /* Vista de lectura optimizada para móviles y pantallas táctiles */
            <div
              style={{
                maxWidth: 720,
                width: "100%",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "clamp(1.25rem, 4vw, 2.5rem)",
                fontFamily: "var(--font-serif, Georgia, 'Times New Roman', serif)",
                color: "var(--fg)",
                lineHeight: 1.7,
                fontSize: "1rem",
              }}
            >
              {/* Lugar y fecha */}
              <div style={{ textAlign: "right", fontWeight: 600, color: "var(--muted)", marginBottom: "1.5rem" }}>
                {draft.ciudad ? `${draft.ciudad}, a ` : ""}{fechaLarga}
              </div>

              {/* Destinatario */}
              <div style={{ marginBottom: "1.5rem" }}>
                {draft.destino.nombre && (
                  <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{draft.destino.nombre}</div>
                )}
                {draft.destino.cargo && (
                  <div style={{ fontWeight: 600 }}>{draft.destino.cargo}</div>
                )}
                <div style={{ fontWeight: 600, color: "var(--muted)" }}>Presente.</div>
              </div>

              {/* Asunto */}
              {draft.asunto && (
                <div style={{ marginBottom: "1.25rem", fontWeight: 700 }}>
                  ASUNTO: {draft.asunto.toUpperCase()}
                </div>
              )}

              {/* Atención */}
              {draft.atencion && draft.atencion.length > 0 && draft.atencion[0].nombre && (
                <div style={{ marginBottom: "1.25rem", fontSize: "0.9375rem" }}>
                  <strong>At’n: {draft.atencion[0].nombre}</strong>
                  {draft.atencion[0].cargo ? ` (${draft.atencion[0].cargo})` : ""}
                </div>
              )}

              {/* Cuerpo del documento */}
              <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", marginBottom: "2rem" }}>
                {draft.cuerpo}
              </div>

              {/* Cierre ATENTAMENTE */}
              <div style={{ textAlign: "center", marginTop: "3rem", paddingTop: "1rem" }}>
                <div style={{ fontWeight: 700, letterSpacing: "0.08em", marginBottom: "1.5rem" }}>
                  A T E N T A M E N T E
                </div>

                {draft.firmaUrl ? (
                  <div style={{ marginBottom: "0.5rem" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.firmaUrl}
                      alt="Firma manuscrita"
                      style={{ maxHeight: 80, maxWidth: 200, margin: "0 auto 0.5rem", display: "block" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                      <button
                        type="button"
                        onClick={() => setMostrarFirmaPad(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cambiar firma
                      </button>
                      <button
                        type="button"
                        onClick={handleQuitarFirma}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Quitar firma
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <Button variant="ghost" size="sm" onClick={() => setMostrarFirmaPad(true)}>
                      ✍ Añadir firma manuscrita
                    </Button>
                  </div>
                )}

                <div
                  style={{
                    width: 240,
                    borderBottom: "1.5px solid var(--fg)",
                    margin: "0 auto 0.75rem",
                  }}
                />

                <div style={{ fontWeight: 700 }}>{profile?.nombre || "TRABAJADOR(A)"}</div>
                {profile?.matricula && <div style={{ fontSize: "0.875rem" }}>Matrícula: {profile.matricula}</div>}
                {profile?.categoria && <div style={{ fontSize: "0.875rem" }}>{profile.categoria}</div>}
                {profile?.adscripcion && <div style={{ fontSize: "0.875rem" }}>{profile.adscripcion}</div>}
              </div>

              {/* Copias c.c.p. */}
              {draft.copias && draft.copias.length > 0 && draft.copias[0].nombre && (
                <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", fontSize: "0.8125rem", color: "var(--muted)" }}>
                  c.c.p. {draft.copias[0].nombre} - {draft.copias[0].cargo}. Para su conocimiento e intervención.
                </div>
              )}

              {/* Anexos */}
              {draft.anexos && draft.anexos.length > 0 && (
                <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "2px dashed var(--border)" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", textAlign: "center" }}>
                    ANEXOS Y EVIDENCIA ADJUNTA ({draft.anexos.length})
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {draft.anexos.map((anexo, idx) => (
                      <div key={anexo.id} style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                          Anexo {idx + 1}: {anexo.nombre}
                        </div>
                        {anexo.descripcion && (
                          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                            {anexo.descripcion}
                          </div>
                        )}
                        {anexo.dataUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={anexo.dataUrl}
                            alt={anexo.nombre}
                            style={{
                              maxWidth: "100%",
                              maxHeight: 320,
                              borderRadius: "0.375rem",
                              border: "1px solid var(--border)",
                              objectFit: "contain",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Vista de hoja Carta completa para escritorio */
            <div
              style={{
                width: 612,
                minHeight: 792,
                background: "#ffffff",
                color: "#000000",
                padding: "54pt",
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: "11pt",
                lineHeight: 1.4,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
            >
              <div style={{ textAlign: "right", marginBottom: 20 }}>
                {draft.ciudad ? `${draft.ciudad}, a ` : ""}{fechaLarga}
              </div>

              <div style={{ marginBottom: 15 }}>
                {draft.destino.nombre && <div style={{ fontWeight: "bold" }}>{draft.destino.nombre.toUpperCase()}</div>}
                {draft.destino.cargo && <div style={{ fontWeight: "bold" }}>{draft.destino.cargo}</div>}
                <div>Presente.</div>
              </div>

              {draft.asunto && <div style={{ fontWeight: "bold", marginBottom: 12 }}>ASUNTO: {draft.asunto.toUpperCase()}</div>}

              {draft.atencion && draft.atencion.length > 0 && draft.atencion[0].nombre && (
                <div style={{ marginBottom: 12 }}>
                  <strong>At’n: {draft.atencion[0].nombre}</strong> {draft.atencion[0].cargo ? `(${draft.atencion[0].cargo})` : ""}
                </div>
              )}

              <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", marginBottom: 25 }}>
                {draft.cuerpo}
              </div>

              <div style={{ marginTop: "auto", paddingTop: 30, textAlign: "center" }}>
                <div style={{ fontWeight: "bold", marginBottom: 15 }}>A T E N T A M E N T E</div>
                {draft.firmaUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={draft.firmaUrl} alt="Firma" style={{ maxHeight: 60, margin: "0 auto 5px", display: "block" }} />
                )}
                <div style={{ width: 220, borderBottom: "1px solid #000", margin: "10px auto 5px" }} />
                <div style={{ fontWeight: "bold" }}>{profile?.nombre || "TRABAJADOR(A)"}</div>
                {profile?.matricula && <div>Matrícula: {profile.matricula}</div>}
                {profile?.categoria && <div>{profile.categoria}</div>}
                {profile?.adscripcion && <div>{profile.adscripcion}</div>}
              </div>

              {draft.copias && draft.copias.length > 0 && draft.copias[0].nombre && (
                <div style={{ fontSize: "8.5pt", marginTop: 25 }}>
                  c.c.p. {draft.copias[0].nombre} - {draft.copias[0].cargo}. Para su conocimiento e intervención.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Firma Manuscrita */}
      <SignaturePadModal
        open={mostrarFirmaPad}
        firmaActual={draft.firmaUrl}
        onSave={handleGuardarFirma}
        onRemove={handleQuitarFirma}
        onClose={() => setMostrarFirmaPad(false)}
      />

      {/* Modal para Guardar Escrito */}
      {mostrarModalGuardar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 15, 25, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalGuardar(false)
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              maxWidth: 480,
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
          >
            <h3 id="save-dialog-title" style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.25rem", color: "var(--fg)" }}>
              Guardar escrito
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
              Se guardará en este dispositivo para que puedas reabrirlo, editarlo o reimprimirlo cuando lo necesites.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="titulo-escrito-guardar"
                style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.35rem" }}
              >
                Título interno del escrito
              </label>
              <input
                id="titulo-escrito-guardar"
                value={tituloGuardar}
                onChange={(e) => setTituloGuardar(e.target.value)}
                placeholder="Ej. Solicitud de cambio de adscripción"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  fontSize: "0.875rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={() => setMostrarModalGuardar(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleConfirmarGuardar}>
                Guardar en dispositivo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de salida con cambios pendientes */}
      {mostrarConfirmCerrar && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 15, 25, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              maxWidth: 420,
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--fg)" }}>
              ¿Salir sin guardar cambios?
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
              Tienes cambios sin guardar en tu escrito. Si sales ahora, se perderán las modificaciones recientes.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
              <Button variant="secondary" onClick={() => setMostrarConfirmCerrar(false)}>
                Continuar editando
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setMostrarConfirmCerrar(false)
                  onClose()
                }}
                style={{ background: "#ef4444" }}
              >
                Salir de todos modos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
