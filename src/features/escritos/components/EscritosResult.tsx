"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import html2canvas from "html2canvas"
import type { EscritoGuardado } from "../services/escritos-storage"

export type EscritoASalvar = Omit<EscritoGuardado, "id" | "createdAt">

interface EscritosResultProps {
  cuerpo: string
  destino: string
  ciudad: string
  fecha: string
  nombre: string
  matricula: string
  categoria: string
  adscripcion: string
  atencion: string
  copia: string
  fotos?: string[]
  firmaInicial?: string
  escritoId?: string
  onGuardar?: (payload: { escritoId?: string; escrito: EscritoASalvar }) => void
  onClose: () => void
}

export function EscritosResult({
  cuerpo, destino, ciudad, fecha, nombre, matricula,
  categoria, adscripcion, atencion, copia, fotos, firmaInicial, escritoId, onGuardar, onClose,
}: EscritosResultProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const [firmaUrl, setFirmaUrl] = useState(firmaInicial ?? "")
  const [mostrarFirma, setMostrarFirma] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [mostrarGuardar, setMostrarGuardar] = useState(false)
  const [tituloGuardar, setTituloGuardar] = useState("")
  const [guardando, setGuardando] = useState(false)

  const [cargo, nombreDestino] = (destino || "|").split("|")

  const fechaLarga = fecha
    ? new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    : ""

  const atnHtml = atencion
    ? atencion.split("|")[1]
    : null
  const atnCargo = atencion
    ? atencion.split("|")[0]
    : null
  const ccpLabel = copia
    ? copia.split("|")[1]
    : null
  const ccpCargo = copia
    ? copia.split("|")[0]
    : null

  const ajustarEscala = useCallback(() => {
    const el = pageRef.current
    if (!el) return
    const container = el.parentElement
    if (!container) return
    const availableWidth = container.clientWidth - 40
    const sheetWidth = 816
    const scale = availableWidth < sheetWidth ? availableWidth / sheetWidth : 1
    el.style.transform = `scale(${scale})`
    el.style.transformOrigin = "top center"
  }, [])

  useEffect(() => {
    ajustarEscala()
    window.addEventListener("resize", ajustarEscala)
    return () => window.removeEventListener("resize", ajustarEscala)
  }, [ajustarEscala])

  const handleDescargar = async () => {
    const el = pageRef.current
    if (!el) return
    setDescargando(true)
    const origTransform = el.style.transform
    el.style.transform = "scale(1)"

    try {
      const { jsPDF: JsPDF } = await import("jspdf")
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" })
      el.style.transform = origTransform

      const doc = new JsPDF({ unit: "pt", format: "letter" })
      const imgData = canvas.toDataURL("image/jpeg", 1.0)
      const pdfW = 612
      const ratio = pdfW / canvas.width
      const imgH = canvas.height * ratio

      let heightLeft = imgH
      let position = 0
      doc.addImage(imgData, "JPEG", 0, position, pdfW, imgH)
      heightLeft -= 792
      while (heightLeft > 0) {
        position = heightLeft - imgH
        doc.addPage()
        doc.addImage(imgData, "JPEG", 0, position, pdfW, imgH)
        heightLeft -= 792
      }

      doc.save(`Oficio_PSC_${matricula}.pdf`)
    } catch (e) {
      console.error(e)
      alert("Error al descargar PDF")
      el.style.transform = origTransform
    } finally {
      setDescargando(false)
    }
  }

  const handlePrint = () => {
    const originalTitle = document.title
    document.title = `Oficio_PSC_${matricula}`
    window.print()
    document.title = originalTitle
  }

  const iniciarPad = () => {
    setMostrarFirma(true)
  }

  const abrirGuardar = () => {
    setTituloGuardar(`Oficio a ${nombreDestino ?? ""} - ${fecha ? new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : ""}`.trim())
    setMostrarGuardar(true)
  }

  const confirmarGuardar = () => {
    if (!onGuardar) return
    setGuardando(true)
    const titulo = tituloGuardar.trim() || `Escrito ${new Date().toLocaleDateString("es-MX")}`
    const escrito: EscritoASalvar = {
      titulo,
      cuerpo,
      destino,
      ciudad,
      fecha,
      nombre,
      matricula,
      categoria,
      adscripcion,
      atencion,
      copia,
      fotos: fotos ?? [],
      firmaUrl,
    }
    onGuardar({ escritoId, escrito })
    setGuardando(false)
    setMostrarGuardar(false)
  }

  const guardarFirma = () => {
    const c = document.getElementById("pad-firma") as HTMLCanvasElement
    if (!c) return
    setFirmaUrl(c.toDataURL("image/png"))
    setMostrarFirma(false)
  }

  const limpiarFirma = () => {
    const c = document.getElementById("pad-firma") as HTMLCanvasElement
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
  }

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(10, 15, 25, 0.98)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "1.25rem",
        }}
      >
        <div style={{
          background: "#1e293b", borderRadius: "1.25rem", width: "100%",
          maxWidth: 1000, padding: "1.5rem", display: "flex", flexDirection: "column",
          maxHeight: "95vh",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.75rem",
          }}>
            <h3 style={{ color: "#fff", margin: 0, fontSize: "1.125rem" }}>Vista Previa del Oficio</h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button onClick={handlePrint}
                style={{
                  padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
                  background: "transparent", color: "#f1f5f9", cursor: "pointer", fontSize: "0.8125rem",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                }}
              >
                🖨 Imprimir
              </button>
              <button onClick={handleDescargar} disabled={descargando}
                style={{
                  padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
                  background: "transparent", color: "#f1f5f9", cursor: descargando ? "not-allowed" : "pointer",
                  fontSize: "0.8125rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                  opacity: descargando ? 0.6 : 1,
                }}
              >
                {descargando ? "⏳" : "⬇"} {descargando ? "Generando PDF..." : "Guardar PDF"}
              </button>
              <button onClick={iniciarPad}
                style={{
                  padding: "0.5rem 1rem", borderRadius: "0.5rem",
                  background: "var(--primary)", border: "none",
                  color: "var(--primary-fg)", cursor: "pointer", fontSize: "0.8125rem",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                }}
              >
                ✍ Añadir Firma
              </button>
              <button onClick={abrirGuardar}
                style={{
                  padding: "0.5rem 1rem", borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: "transparent", color: "#f1f5f9", cursor: "pointer", fontSize: "0.8125rem",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                }}
              >
                💾 Guardar
              </button>
              <button onClick={onClose}
                style={{
                  padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #ef4444",
                  background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "1rem",
                  display: "flex", alignItems: "center", lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{
            flex: 1, overflow: "auto", display: "flex", justifyContent: "center",
            background: "#334155", borderRadius: "0.75rem", padding: "1.25rem",
            margin: "0.75rem 0", minHeight: 400,
          }}>
            <div ref={pageRef} id="page-carta" className="page-carta"
              style={{
                width: 816, background: "#fff", color: "#111",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)", flexShrink: 0,
                transformOrigin: "top center",
              }}
            >
              <div style={{
                padding: "50px 64px", fontFamily: "'Times New Roman', Times, serif",
                fontSize: "12pt", lineHeight: 1.5, minHeight: 1056,
                display: "flex", flexDirection: "column", color: "#000",
              }}>
                <header style={{ textAlign: "right", fontWeight: "bold", marginBottom: 30 }}>
                  <div id="folio-doc" style={{ color: "#991b1b", fontSize: "13pt", marginBottom: 16, minHeight: 25 }} />
                  {ciudad}, a {fechaLarga}
                </header>

                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>{nombreDestino}</div>
                <div style={{ fontWeight: "bold", marginBottom: 5 }}>{cargo}</div>
                <div>Presente.</div>

                {atnHtml && (
                  <div style={{ marginTop: 15, fontWeight: "bold" }}>
                    At&apos;n: {atnHtml}<br />
                    <span style={{ fontWeight: "normal", fontSize: "11pt" }}>{atnCargo}</span>
                  </div>
                )}

                <div style={{ textAlign: "justify", whiteSpace: "pre-wrap", marginTop: 20 }}>{cuerpo}</div>

                {firmaUrl && (
                  <div style={{ marginTop: 40 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={firmaUrl} alt="Firma" style={{ maxHeight: 80, display: "block", margin: "0 auto 5px" }} />
                  </div>
                )}

                <div style={{ marginTop: "auto", paddingTop: 50, textAlign: "center", fontWeight: "bold" }}>
                  ATENTAMENTE
                  <div style={{ margin: "10px auto 5px", width: 250, borderBottom: "2px solid black" }} />
                  {nombre}<br />
                  Matrícula: {matricula}<br />
                  {categoria}<br />
                  {adscripcion}
                </div>

                {ccpLabel && (
                  <div style={{ fontSize: "8pt", marginTop: 40, textAlign: "left" }}>
                    c.c.p. {ccpLabel} - {ccpCargo}. Para su conocimiento e intervención.
                  </div>
                )}
              </div>

              {(fotos && fotos.length > 0) && (
                <div style={{
                  padding: "50px 64px", fontFamily: "'Times New Roman', Times, serif",
                  fontSize: "12pt", lineHeight: 1.5, color: "#000",
                  borderTop: "2px solid #ccc", marginTop: 20,
                }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <h2 style={{ fontSize: "16pt", fontWeight: 700, margin: 0 }}>ANEXOS</h2>
                    <p style={{ fontSize: "10pt", color: "#555", margin: "4px 0 0" }}>
                      Evidencia fotográfica
                    </p>
                  </div>
                  <div style={{ fontSize: "10pt", marginBottom: 16 }}>
                    {fotos.map((_, i) => (
                      <span key={i}>Anexo {i + 1}{i < fotos.length - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                  {fotos.map((foto, i) => (
                    <div key={i} style={{
                      marginBottom: 30, textAlign: "center",
                      pageBreakInside: "avoid",
                    }}>
                      <p style={{ fontWeight: 600, fontSize: "10pt", margin: "0 0 8px", textAlign: "left" }}>
                        Anexo {i + 1}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto}
                        alt={`Anexo ${i + 1}`}
                        style={{
                          maxWidth: "100%", maxHeight: 400,
                          border: "1px solid #ccc", objectFit: "contain",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mostrarFirma && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(10, 15, 25, 0.98)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1100, padding: "1.25rem",
          }}
        >
          <div style={{
            background: "#1e293b", borderRadius: "1.25rem", maxWidth: 500,
            width: "100%", padding: "1.5rem", textAlign: "center",
          }}>
            <h3 style={{ color: "#fff", margin: "0 0 0.25rem" }}>Firma Digital</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
              Dibuja tu firma para el documento
            </p>
            <canvas
              id="pad-firma"
              width={400}
              height={180}
              style={{
                background: "#fff", width: "100%", height: 160,
                borderRadius: "0.625rem", border: "2px dashed #94a3b8",
                cursor: "crosshair", marginBottom: "1.25rem",
              }}
              onMouseDown={(e) => {
                const c = e.currentTarget
                const ctx = c.getContext("2d")
                if (!ctx) return
                ctx.beginPath()
                const rect = c.getBoundingClientRect()
                const x = (e.clientX - rect.left) * (c.width / rect.width)
                const y = (e.clientY - rect.top) * (c.height / rect.height)
                ctx.moveTo(x, y)
                c.onmousemove = (ev) => {
                  const ctx2 = c.getContext("2d")
                  if (!ctx2) return
                  const r = c.getBoundingClientRect()
                  const x2 = (ev.clientX - r.left) * (c.width / r.width)
                  const y2 = (ev.clientY - r.top) * (c.height / r.height)
                  ctx2.lineTo(x2, y2)
                  ctx2.stroke()
                }
              }}
              onMouseUp={(e) => { e.currentTarget.onmousemove = null }}
              onMouseLeave={(e) => { e.currentTarget.onmousemove = null }}
              onTouchStart={(e) => {
                const c = e.currentTarget
                const ctx = c.getContext("2d")
                if (!ctx) return
                const touch = e.touches[0]
                const rect = c.getBoundingClientRect()
                const x = (touch.clientX - rect.left) * (c.width / rect.width)
                const y = (touch.clientY - rect.top) * (c.height / rect.height)
                ctx.beginPath()
                ctx.moveTo(x, y)
                c.ontouchmove = (ev) => {
                  ev.preventDefault()
                  const ctx2 = c.getContext("2d")
                  if (!ctx2) return
                  const t = ev.touches[0]
                  const r = c.getBoundingClientRect()
                  const x2 = (t.clientX - r.left) * (c.width / r.width)
                  const y2 = (t.clientY - r.top) * (c.height / r.height)
                  ctx2.lineTo(x2, y2)
                  ctx2.stroke()
                }
              }}
              onTouchEnd={(e) => { e.currentTarget.ontouchmove = null }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              <button onClick={() => { limpiarFirma() }}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "#f1f5f9", cursor: "pointer", fontWeight: 600,
                }}
              >
                Limpiar
              </button>
              <button onClick={() => setMostrarFirma(false)}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "#f1f5f9", cursor: "pointer", fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button onClick={guardarFirma}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                  background: "var(--primary)", border: "none",
                  color: "var(--primary-fg)", cursor: "pointer", fontWeight: 600,
                }}
              >
                Aplicar Firma
              </button>
            </div>
          </div>
        </div>
      )}
      {mostrarGuardar && onGuardar && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(10, 15, 25, 0.98)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1100, padding: "1.25rem",
          }}
        >
          <div style={{
            background: "#1e293b", borderRadius: "1.25rem", maxWidth: 500,
            width: "100%", padding: "1.5rem",
          }}>
            <h3 style={{ color: "#fff", margin: "0 0 0.25rem" }}>Guardar ✓</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
              Este escrito quedará guardado en este dispositivo para que puedas reimprimirlo cuando quieras.
            </p>
            <label style={{
              display: "block", color: "#cbd5e1", fontSize: "0.8125rem",
              fontWeight: 600, marginBottom: "0.375rem",
            }}>
              Título del escrito
            </label>
            <input
              value={tituloGuardar}
              onChange={(e) => setTituloGuardar(e.target.value)}
              placeholder="Ej. Solicitud de cambio de adscripción"
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "0.5rem",
                border: "1px solid var(--border)", background: "#0f172a", color: "#f1f5f9",
                fontSize: "0.875rem", marginBottom: "1.25rem", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setMostrarGuardar(false)}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "#f1f5f9", cursor: "pointer", fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button onClick={confirmarGuardar} disabled={guardando}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                  background: "var(--primary)", border: "none",
                  color: "var(--primary-fg)", cursor: guardando ? "not-allowed" : "pointer",
                  fontWeight: 600, opacity: guardando ? 0.7 : 1,
                }}
              >
                {guardando ? "Guardando..." : "Guardar escrito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
