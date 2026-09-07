"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  FileText, FolderOpen, Printer, Clock, Trash, PencilLine,
  DotsThree, UploadSimple, PencilSimple, Eye, ShareNetwork,
  WarningCircle, CheckCircle, X,
} from "@phosphor-icons/react"
import { getEscritosGuardados, eliminarEscrito } from "@/shared/services/escritos-storage"
import {
  readNativeDocumentAsFile,
  deleteNativeDocumentById,
} from "@/features/transferir/services/transfer"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { SendPrintModal } from "./SendPrintModal"
import { ImportTarjetonModal } from "./ImportTarjetonModal"
import { DocumentViewerModal } from "./DocumentViewerModal"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { escritoToPdfFile } from "../lib/escrito-pdf"
import {
  toNativo, formatBytes, formatFecha, formatFechaEscrito, grupoLabel,
  type DocTipo, type DocumentoPersonalItem,
} from "../lib/documents"
import {
  resolveViewerDocument,
  type ViewerDocument,
} from "../services/document-viewer-adapter"
import { sharePdfViaNativeBridge, isNativePdfShareSupported } from "@/shared/services/pdfShareBridge"
import {
  deleteNativeEscritoCopies,
  setNativeDocsOwner,
} from "../services/escrito-native-sync"

const TIPO_ICON: Record<DocTipo, typeof FileText> = {
  tarjeton: FileText,
  checadas: Clock,
  escrito: PencilLine,
}

const TIPO_COLOR: Record<DocTipo, string> = {
  tarjeton: "#2563eb",
  checadas: "#16a34a",
  escrito: "#7c3aed",
}

export function DocumentosPersonales() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [nativos, setNativos] = useState<DocumentoPersonalItem[]>([])
  const [escritos, setEscritos] = useState<DocumentoPersonalItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [profile, setProfile] = useState<TarjetonProfileSnapshot | null>(null)
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null)
  const [preparingDocId, setPreparingDocId] = useState<string | null>(null)
  const [preparingError, setPreparingError] = useState<{ id: string; message: string; doc: DocumentoPersonalItem } | null>(null)
  const [sendDoc, setSendDoc] = useState<{ doc: DocumentoPersonalItem; getFile: () => Promise<File | null> } | null>(null)
  const [importDoc, setImportDoc] = useState<{ file: File | null; name: string } | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentoPersonalItem | null>(null)
  const [menuDoc, setMenuDoc] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const isNative = typeof window !== "undefined" && !!window.LaVeinteApp?.listNativeDocuments

  const reloadNativos = () => {
    if (!isNative) return
    window.LaVeinteApp!.listNativeDocuments()
      .then((docs) => setNativos((docs ?? []).map(toNativo).filter((d): d is NonNullable<typeof d> => !!d)))
      .catch(() => setNativos([]))
  }

  // Auto-cerrar feedback toast
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4500)
    return () => clearTimeout(timer)
  }, [feedback])

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    if (!menuDoc) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-menu-doc="true"]')) {
        setMenuDoc(null)
      }
    }
    window.addEventListener("click", handleClickOutside)
    return () => window.removeEventListener("click", handleClickOutside)
  }, [menuDoc])

  // 1. Cargar sesión de usuario antes de leer datos privados
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (user) {
        setUserId(user.id)
        // Aislamiento offline Android: informar el propietario actual (best-effort).
        setNativeDocsOwner(user.id)
        const userEscritos = getEscritosGuardados(user.id)
        setEscritos(
          userEscritos.map((e) => ({
            kind: "escrito",
            tipo: "escrito",
            id: e.id,
            titulo: e.titulo,
            fecha: e.fecha,
            escrito: e,
          }))
        )

        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, matricula, categoria, antiguedad")
          .eq("id", user.id)
          .maybeSingle()

        if (!cancelled && p) {
          setProfile({
            fullName: p.full_name ?? null,
            matricula: p.matricula ?? null,
            categoria: p.categoria ?? null,
            antiguedad: p.antiguedad ?? null,
          })
        }
      } else {
        setUserId("anonymous")
        setEscritos([])
      }
      setCargando(false)
    })

    return () => {
      cancelled = true
    }
  }, [supabase])

  // 2. Cargar documentos nativos si está en el contenedor móvil
  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    window.LaVeinteApp!.listNativeDocuments()
      .then((docs) => {
        if (cancelled) return
        setNativos((docs ?? []).map(toNativo).filter((d): d is NonNullable<typeof d> => !!d))
      })
      .catch(() => { if (!cancelled) setNativos([]) })
    return () => { cancelled = true }
  }, [isNative])

  const items = useMemo(() => {
    const todos = [...nativos, ...escritos]
    const orden: Record<string, number> = { tarjeton: 0, checadas: 1, escrito: 2 }
    return todos.sort((a, b) => (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9))
  }, [nativos, escritos])

  const grouped = useMemo(() => {
    const g: Record<DocTipo, DocumentoPersonalItem[]> = { tarjeton: [], checadas: [], escrito: [] }
    for (const it of items) g[it.tipo]?.push(it)
    return g
  }, [items])

  const getDocFile = async (doc: DocumentoPersonalItem): Promise<File | null> => {
    if (doc.kind === "nativo") {
      return readNativeDocumentAsFile({ name: doc.name, mimeType: doc.mimeType, localPath: doc.localPath })
    }
    return escritoToPdfFile(doc.escrito, userId ?? "anonymous", {
      nombre: profile?.fullName ?? undefined,
      matricula: profile?.matricula ?? undefined,
      categoria: profile?.categoria ?? undefined,
    })
  }

  const handleOpen = async (doc: DocumentoPersonalItem) => {
    setMenuDoc(null)
    setPreparingError(null)
    setPreparingDocId(doc.id)

    try {
      const resolved = await resolveViewerDocument(doc, userId ?? "anonymous", profile)
      setActiveViewerDoc(resolved)
    } catch (err) {
      console.error("[DocumentosPersonales] Error al preparar documento:", err)
      setPreparingError({
        id: doc.id,
        message: err instanceof Error ? err.message : "No se pudo preparar el documento.",
        doc,
      })
    } finally {
      setPreparingDocId(null)
    }
  }

  const handleCloseViewer = () => {
    if (activeViewerDoc) {
      const docToClean = activeViewerDoc
      setActiveViewerDoc(null)
      // Liberar la URL sólo después de cerrar el visor
      setTimeout(() => {
        docToClean.cleanup?.()
      }, 100)
    }
  }

  const handleShare = async (doc: DocumentoPersonalItem) => {
    try {
      const name = titulo(doc)
      if (doc.kind === "nativo" && doc.localPath && typeof window !== "undefined" && window.LaVeinteApp?.shareNativeDocument) {
        window.LaVeinteApp.shareNativeDocument(doc.localPath, name)
        return
      }

      const file = await getDocFile(doc)
      if (!file) return

      if (isNativePdfShareSupported()) {
        const res = await sharePdfViaNativeBridge(file, name)
        if (res.ok) return
      }

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: name,
        })
        return
      }

      if (typeof window !== "undefined") {
        const url = URL.createObjectURL(file)
        const a = document.createElement("a")
        a.href = url
        a.download = name.endsWith(".pdf") ? name : `${name}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error al compartir documento:", err)
      }
    }
  }

  const handleSend = (doc: DocumentoPersonalItem) => {
    setSendDoc({ doc, getFile: () => getDocFile(doc) })
    setMenuDoc(null)
  }

  const handleImport = async (doc: DocumentoPersonalItem) => {
    if (doc.kind !== "nativo") return
    const file = await readNativeDocumentAsFile({ name: doc.name, mimeType: doc.mimeType, localPath: doc.localPath })
    setImportDoc({ file, name: doc.name })
    setMenuDoc(null)
  }

  const handleRequestDelete = (doc: DocumentoPersonalItem) => {
    setMenuDoc(null)
    setConfirmDeleteDoc(doc)
  }

  const handleConfirmDelete = async () => {
    const doc = confirmDeleteDoc
    if (!doc) return

    setBorrandoId(doc.id)
    try {
      if (doc.kind === "escrito") {
        await eliminarEscrito(doc.id, userId || undefined)
        // Mantener sincronizada la copia offline Android (fire-and-forget).
        deleteNativeEscritoCopies(doc.id)
        setEscritos((prev) => prev.filter((e) => e.id !== doc.id))
        setConfirmDeleteDoc(null)
        setFeedback({ type: "success", message: "Escrito eliminado correctamente." })
      } else {
        const docId = doc.numericId ?? (Number(doc.id) || 0)
        const res = await deleteNativeDocumentById(docId, doc.localPath)
        if (res.ok) {
          setNativos((prev) => prev.filter((d) => d.id !== doc.id))
          setConfirmDeleteDoc(null)
          setFeedback({ type: "success", message: "Documento eliminado." })
          reloadNativos()
        } else {
          setConfirmDeleteDoc(null)
          if (res.reason === "bridge_unavailable") {
            setFeedback({
              type: "error",
              message: "Actualiza La Veinte Digital para eliminar este documento correctamente.",
            })
          } else {
            setFeedback({
              type: "error",
              message: "No se pudo eliminar el documento. Inténtalo de nuevo.",
            })
          }
        }
      }
    } catch (err) {
      console.error("Error al eliminar documento:", err)
      setConfirmDeleteDoc(null)
      setFeedback({
        type: "error",
        message: "Ocurrió un error al intentar eliminar el documento.",
      })
    } finally {
      setBorrandoId(null)
    }
  }

  const titulo = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? doc.name : doc.escrito.titulo || "Escrito"
  const fecha = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? formatFecha(doc.downloadedAt) : formatFechaEscrito(doc.escrito.fecha)
  const detalle = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? formatBytes(doc.fileSize) : "Borrador guardado"
  const puedeBorrarNativo = typeof window !== "undefined" && (
    !!window.LaVeinteApp?.deleteNativeDocumentById || !!window.LaVeinteApp?.deleteNativeDocument
  )

  const iconBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 38, height: 38, borderRadius: "0.625rem",
    border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
    textDecoration: "none",
  }

  return (
    <div style={{
      maxWidth: "680px",
      width: "100%",
      margin: "0 auto",
      padding: "1.5rem 1rem",
      display: "flex",
      flexDirection: "column",
      gap: "1.75rem",
      boxSizing: "border-box",
      position: "relative",
    }}>

      {/* Toast / Banner de Feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "sticky",
            top: "1rem",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: feedback.type === "success" ? "#166534" : "#991b1b",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
            {feedback.type === "success" ? (
              <CheckCircle size={20} weight="fill" style={{ color: "#16a34a", flexShrink: 0 }} />
            ) : (
              <WarningCircle size={20} weight="fill" style={{ color: "#dc2626", flexShrink: 0 }} />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            aria-label="Cerrar aviso"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              color: "inherit",
              opacity: 0.7,
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", width: "100%", boxSizing: "border-box" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "1rem", flexShrink: 0,
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <FolderOpen size={26} weight="duotone" />
        </div>
        <div style={{ minWidth: 0, flex: 1, wordBreak: "break-word" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, lineHeight: 1.25 }}>Documentos personales</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.125rem 0 0", lineHeight: 1.4 }}>
            Tus tarjetones, checadas y escritos en un solo lugar.
          </p>
        </div>
      </div>

      {!isNative && nativos.length === 0 && (
        <div style={{
          background: "var(--accent)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "1rem 1.25rem", width: "100%", boxSizing: "border-box",
        }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
            📱 Los tarjetones y checadas descargados del IMSS se sincronizan en la aplicación móvil instalada. Aquí puedes gestionar tus escritos redactados.
          </p>
        </div>
      )}

      {cargando && (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>Cargando documentos…</p>
      )}

      {!cargando && items.length === 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "2.5rem 1.5rem", textAlign: "center", width: "100%", boxSizing: "border-box",
        }}>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Aún no tienes documentos</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem", lineHeight: 1.5, wordBreak: "break-word" }}>
            Cuando descargues tarjetones o checadas del IMSS, o redactes un escrito, aparecerán aquí.
          </p>
          <Link
            href="/escritos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1.25rem",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            ✏️ Redactar un nuevo escrito
          </Link>
        </div>
      )}

      {!cargando && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", width: "100%", boxSizing: "border-box" }}>
          {(Object.keys(grouped) as Array<keyof typeof grouped>).map((tipo) => {
            const list = grouped[tipo]
            if (list.length === 0) return null
            const Icon = TIPO_ICON[tipo]
            const color = TIPO_COLOR[tipo]
            return (
              <section key={tipo} style={{ width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 0.25rem" }}>
                  <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                    {grupoLabel(tipo)}
                  </h2>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>{list.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", boxSizing: "border-box" }}>
                  {list.map((doc) => {
                    const name = titulo(doc)
                    const locked = doc.kind === "nativo" && !puedeBorrarNativo
                    const meta = [detalle(doc), fecha(doc)].filter(Boolean).join("  ·  ")
                    const hasMenu = doc.tipo === "tarjeton"
                    return (
                      <div
                        key={doc.id}
                        data-menu-doc="true"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.875rem",
                          padding: "0.875rem 1rem",
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.875rem",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Fila principal: Identidad y Acciones */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "0.875rem",
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          {/* Identidad del documento (Nombre + Tipo/Descripcion) */}
                          <div style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.75rem",
                            flex: "1 1 230px",
                            minWidth: 0,
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                          }}>
                            {/* Icono de Tipo */}
                            <div style={{
                              width: 42, height: 42, borderRadius: "0.75rem", flexShrink: 0,
                              background: `${color}1a`,
                              display: "flex", alignItems: "center", justifyContent: "center", color,
                              marginTop: "0.125rem",
                            }}>
                              <Icon size={22} weight="duotone" />
                            </div>

                            {/* Textos: Nombre de documento arriba / TIPO - descripcion abajo */}
                            <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                              {/* Nombre de documento */}
                              <div style={{
                                fontSize: "var(--text-sm)",
                                fontWeight: 700,
                                color: "var(--fg)",
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}>
                                {name}
                              </div>

                              {/* TIPO - descripcion */}
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "0.375rem",
                                marginTop: "0.25rem",
                                fontSize: "var(--text-xs)",
                                color: "var(--muted)",
                                lineHeight: 1.4,
                              }}>
                                <span style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color,
                                  background: `${color}1a`,
                                  padding: "0.125rem 0.45rem",
                                  borderRadius: "999px",
                                  flexShrink: 0,
                                  display: "inline-block",
                                }}>
                                  {grupoLabel(tipo)}
                                </span>
                                <span>-</span>
                                <span>{meta}</span>
                              </div>
                            </div>
                          </div>

                          {/* Botones de acción */}
                          <div style={{
                            display: "flex",
                            gap: "0.375rem",
                            flexShrink: 0,
                            alignItems: "center",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}>
                            {/* Botón Abrir */}
                            <button
                              onClick={() => handleOpen(doc)}
                              disabled={preparingDocId === doc.id}
                              title={preparingDocId === doc.id ? "Preparando documento…" : "Abrir documento"}
                              aria-label="Abrir documento"
                              style={{
                                ...iconBtn,
                                background: "var(--accent)",
                                color: "var(--fg)",
                                border: "1px solid var(--border)",
                                opacity: preparingDocId === doc.id ? 0.6 : 1,
                              }}
                            >
                              <Eye size={18} weight="bold" />
                            </button>

                            {/* Botón Compartir */}
                            <button
                              onClick={() => handleShare(doc)}
                              title="Compartir documento"
                              aria-label="Compartir documento"
                              style={{
                                ...iconBtn,
                                background: "var(--accent)",
                                color: "var(--primary)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <ShareNetwork size={18} weight="bold" />
                            </button>

                            {/* Botón Imprimir / Transferir */}
                            <button
                              onClick={() => handleSend(doc)}
                              title="Enviar a imprimir o transferir"
                              aria-label="Enviar a imprimir o transferir"
                              style={{
                                ...iconBtn,
                                background: "var(--primary)",
                                color: "var(--primary-fg)",
                                boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                              }}
                            >
                              <Printer size={18} weight="bold" />
                            </button>

                            {/* Botón Editar para escritos */}
                            {doc.tipo === "escrito" && (
                              <Link
                                href={`/escritos?id=${doc.id}`}
                                title="Editar escrito"
                                aria-label="Editar escrito"
                                style={{
                                  ...iconBtn,
                                  background: "var(--accent)",
                                  color: "var(--primary)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <PencilSimple size={18} weight="bold" />
                              </Link>
                            )}

                            {/* Más opciones (3 puntos) para tarjetones: Exportar al perfil */}
                            {hasMenu && (
                              <button
                                onClick={() => setMenuDoc(menuDoc === doc.id ? null : doc.id)}
                                aria-expanded={menuDoc === doc.id}
                                aria-controls={`menu-panel-${doc.id}`}
                                aria-label="Más opciones"
                                title="Exportar al perfil y más opciones"
                                style={{
                                  ...iconBtn,
                                  background: menuDoc === doc.id ? "var(--accent)" : "transparent",
                                  color: menuDoc === doc.id ? "var(--primary)" : "var(--muted)",
                                  border: `1px solid ${menuDoc === doc.id ? "var(--primary)" : "var(--border)"}`,
                                }}
                              >
                                <DotsThree size={20} weight="bold" />
                              </button>
                            )}

                            {/* Botón Eliminar */}
                            <button
                              onClick={() => handleRequestDelete(doc)}
                              disabled={borrandoId === doc.id}
                              title={locked ? "Para borrar, actualiza la app a la última versión." : "Eliminar documento"}
                              aria-label="Eliminar documento"
                              style={{
                                ...iconBtn,
                                background: "transparent",
                                color: "#ef4444",
                                border: "1px solid #fecaca",
                                opacity: locked ? 0.45 : 1,
                                cursor: borrandoId === doc.id ? "not-allowed" : "pointer",
                              }}
                            >
                              <Trash size={18} weight="bold" />
                            </button>
                          </div>
                        </div>

                        {/* Indicador visual de preparación */}
                        {preparingDocId === doc.id && (
                          <div
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              borderTop: "1px solid var(--border)",
                              paddingTop: "0.625rem",
                              marginTop: "0.375rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.8125rem",
                              color: "var(--primary)",
                            }}
                          >
                            <LoadingSpinner text="Preparando documento…" />
                          </div>
                        )}

                        {/* Error de preparación con acción de Reintentar */}
                        {preparingError && preparingError.id === doc.id && (
                          <div
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              borderTop: "1px solid rgba(239, 68, 68, 0.3)",
                              background: "rgba(239, 68, 68, 0.08)",
                              borderRadius: "0.5rem",
                              padding: "0.625rem 0.875rem",
                              marginTop: "0.375rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: "0.8125rem", color: "#ef4444", fontWeight: 500 }}>
                              {preparingError.message}
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => handleOpen(preparingError.doc)}>
                              Reintentar
                            </Button>
                          </div>
                        )}

                        {/* Panel expandible interno dentro del flujo normal de la tarjeta */}
                        {hasMenu && menuDoc === doc.id && (
                          <div
                            id={`menu-panel-${doc.id}`}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              borderTop: "1px solid var(--border)",
                              paddingTop: "0.75rem",
                              animation: "fadeIn 0.2s ease",
                            }}
                          >
                            <button
                              onClick={() => {
                                setMenuDoc(null)
                                void handleImport(doc)
                              }}
                              aria-label="Exportar tarjetón al perfil"
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.75rem",
                                width: "100%",
                                padding: "0.75rem 0.875rem",
                                borderRadius: "0.625rem",
                                border: "1px solid var(--border)",
                                background: "var(--accent)",
                                cursor: "pointer",
                                textAlign: "left",
                                fontFamily: "inherit",
                                color: "var(--fg)",
                                boxSizing: "border-box",
                                transition: "background var(--transition), border-color var(--transition)",
                              }}
                            >
                              <span style={{ color, flexShrink: 0, marginTop: "0.125rem" }}>
                                <UploadSimple size={22} weight="duotone" />
                              </span>
                              <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                                  Exportar al perfil
                                </span>
                                <span style={{
                                  display: "block",
                                  fontSize: "0.75rem",
                                  color: "var(--muted)",
                                  lineHeight: 1.4,
                                  marginTop: "0.25rem",
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}>
                                  Actualiza tu perfil laboral (categoría, antigüedad, jornada y conceptos) con este tarjetón.
                                </span>
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {confirmDeleteDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            boxSizing: "border-box",
            animation: "fadeIn 0.15s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !borrandoId) setConfirmDeleteDoc(null)
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: "1rem",
              border: "1px solid var(--border)",
              maxWidth: "420px",
              width: "100%",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.125rem",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.2)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "0.75rem",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash size={22} weight="bold" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3
                  id="confirm-delete-title"
                  style={{
                    fontSize: "1.0625rem",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                    lineHeight: 1.3,
                  }}
                >
                  Eliminar documento
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--fg)",
                    margin: "0.375rem 0 0",
                    wordBreak: "break-word",
                  }}
                >
                  {titulo(confirmDeleteDoc)}
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted)",
                lineHeight: 1.5,
                background: "var(--accent)",
                padding: "0.75rem 0.875rem",
                borderRadius: "0.625rem",
                border: "1px solid var(--border)",
              }}
            >
              {confirmDeleteDoc.kind === "escrito" ? (
                "Se eliminará el escrito y sus anexos guardados en este dispositivo."
              ) : (
                "Se eliminará este archivo únicamente de este dispositivo. Esta acción no afecta los portales del IMSS."
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.625rem",
                marginTop: "0.25rem",
              }}
            >
              <Button
                variant="secondary"
                size="md"
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={borrandoId === confirmDeleteDoc.id}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmDelete}
                loading={borrandoId === confirmDeleteDoc.id}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      <DocumentViewerModal
        open={!!activeViewerDoc}
        doc={activeViewerDoc}
        userId={userId}
        profile={profile}
        onClose={handleCloseViewer}
        onSendPrint={(d) => {
          handleCloseViewer()
          const found = items.find((it) => it.id === d.id)
          if (found) {
            handleSend(found)
          }
        }}
        onImportTarjeton={(d) => {
          handleCloseViewer()
          const found = items.find((it) => it.id === d.id)
          if (found) {
            void handleImport(found)
          }
        }}
        onDelete={(d) => {
          handleCloseViewer()
          const found = items.find((it) => it.id === d.id)
          if (found) {
            handleRequestDelete(found)
          }
        }}
      />

      <SendPrintModal
        open={!!sendDoc}
        docName={sendDoc ? titulo(sendDoc.doc) : ""}
        getFile={sendDoc?.getFile ?? (async () => null)}
        onClose={() => setSendDoc(null)}
      />

      <ImportTarjetonModal
        open={!!importDoc}
        file={importDoc?.file ?? null}
        profile={profile}
        onClose={() => setImportDoc(null)}
      />
    </div>
  )
}
