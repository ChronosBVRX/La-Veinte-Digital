"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { FileText, FolderOpen, Printer, Clock, Trash, PencilLine, DotsThree, UploadSimple } from "@phosphor-icons/react"
import { getEscritosGuardados, eliminarEscrito } from "@/features/escritos/services/escritos-storage"
import { readNativeDocumentAsFile, deleteNativeDocument } from "@/features/transferir/services/transfer"
import { SendPrintModal } from "./SendPrintModal"
import { ImportTarjetonModal } from "./ImportTarjetonModal"
import { escritoToPdfFile } from "../lib/escrito-pdf"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import {
  toNativo, formatBytes, formatFecha, formatFechaEscrito, grupoLabel,
  type DocTipo, type DocumentoPersonalItem,
} from "../lib/documents"

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
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [nativos, setNativos] = useState<DocumentoPersonalItem[]>([])
  const [escritos, setEscritos] = useState<DocumentoPersonalItem[]>(() =>
    getEscritosGuardados().map((e) => ({
      kind: "escrito", tipo: "escrito", id: e.id, titulo: e.titulo, fecha: e.fecha, escrito: e,
    }))
  )
  const [cargando, setCargando] = useState(true)
  const [profile, setProfile] = useState<TarjetonProfileSnapshot | null>(null)
  const [sendDoc, setSendDoc] = useState<{ doc: DocumentoPersonalItem; getFile: () => Promise<File | null> } | null>(null)
  const [importDoc, setImportDoc] = useState<{ file: File | null; name: string } | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [menuDoc, setMenuDoc] = useState<string | null>(null)

  const isNative = typeof window !== "undefined" && !!window.LaVeinteApp?.listNativeDocuments

  const reloadNativos = () => {
    if (!isNative) return
    window.LaVeinteApp!.listNativeDocuments()
      .then((docs) => setNativos((docs ?? []).map(toNativo).filter((d): d is NonNullable<typeof d> => !!d)))
      .catch(() => setNativos([]))
  }

  useEffect(() => {
    if (!isNative) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de shell nativo (solo cliente)
      setCargando(false)
      return
    }
    let cancelled = false
    window.LaVeinteApp!.listNativeDocuments()
      .then((docs) => {
        if (cancelled) return
        setNativos((docs ?? []).map(toNativo).filter((d): d is NonNullable<typeof d> => !!d))
      })
      .catch(() => { if (!cancelled) setNativos([]) })
      .finally(() => { if (!cancelled) setCargando(false) })
    return () => { cancelled = true }
  }, [isNative])

  useEffect(() => {
    supabase.auth.getUser().then(async (res) => {
      const user = res?.data?.user
      const activeId = user?.id
      if (activeId) {
        setUserId(activeId)
      }
      setEscritos(getEscritosGuardados(activeId).map((e) => ({
        kind: "escrito", tipo: "escrito", id: e.id, titulo: e.titulo, fecha: e.fecha, escrito: e,
      })))
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, matricula, categoria, antiguedad")
          .eq("id", user.id)
          .maybeSingle()
        setProfile({
          fullName: p?.full_name ?? null,
          matricula: p?.matricula ?? null,
          categoria: p?.categoria ?? null,
          antiguedad: p?.antiguedad ?? null,
        })
      }
    }).catch(() => {})
  }, [])

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

  const handleSend = (doc: DocumentoPersonalItem) => {
    const getFile = async (): Promise<File | null> => {
      if (doc.kind === "nativo") {
        return readNativeDocumentAsFile({ name: doc.name, mimeType: doc.mimeType, localPath: doc.localPath })
      }
      return escritoToPdfFile(doc.escrito)
    }
    setSendDoc({ doc, getFile })
    setMenuDoc(null)
  }

  const handleImport = async (doc: DocumentoPersonalItem) => {
    if (doc.kind !== "nativo") return
    const file = await readNativeDocumentAsFile({ name: doc.name, mimeType: doc.mimeType, localPath: doc.localPath })
    setImportDoc({ file, name: doc.name })
    setMenuDoc(null)
  }

  const handleDelete = async (doc: DocumentoPersonalItem) => {
    setMenuDoc(null)
    setBorrandoId(doc.id)
    try {
      if (doc.kind === "escrito") {
        eliminarEscrito(doc.id, userId)
        setEscritos(getEscritosGuardados(userId).map((e) => ({
          kind: "escrito", tipo: "escrito", id: e.id, titulo: e.titulo, fecha: e.fecha, escrito: e,
        })))
      } else {
        const ok = await deleteNativeDocument(doc.localPath)
        if (ok) reloadNativos()
      }
    } finally {
      setBorrandoId(null)
    }
  }

  const titulo = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? doc.name : doc.escrito.titulo || "Escrito"
  const fecha = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? formatFecha(doc.downloadedAt) : formatFechaEscrito(doc.escrito.fecha)
  const detalle = (doc: DocumentoPersonalItem) =>
    doc.kind === "nativo" ? formatBytes(doc.fileSize) : "Guardado"
  const puedeBorrarNativo = typeof window !== "undefined" && !!window.LaVeinteApp?.deleteNativeDocument

  const iconBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 38, height: 38, borderRadius: "0.625rem",
    border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "1rem", flexShrink: 0,
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <FolderOpen size={26} weight="duotone" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, lineHeight: 1.25 }}>Documentos personales</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.125rem 0 0", lineHeight: 1.4 }}>
            Tus tarjetones, checadas y escritos en un solo lugar.
          </p>
        </div>
      </div>

      {!isNative && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "2rem 1.5rem", textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "0.75rem", margin: "0 auto 0.75rem",
            background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FolderOpen size={24} weight="duotone" style={{ color: "var(--primary)" }} />
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            Esta sección es exclusiva de la app La Veinte Digital. Ábrela desde la aplicación en tu teléfono.
          </p>
        </div>
      )}

      {isNative && cargando && (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>Cargando documentos…</p>
      )}

      {isNative && !cargando && items.length === 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.75rem", padding: "2.5rem 1.5rem", textAlign: "center",
        }}>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Aún no tienes documentos</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            Cuando descargues tarjetones o checadas del IMSS, o guardes un escrito, aparecerán aquí.
          </p>
        </div>
      )}

      {isNative && !cargando && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {(Object.keys(grouped) as Array<keyof typeof grouped>).map((tipo) => {
            const list = grouped[tipo]
            if (list.length === 0) return null
            const Icon = TIPO_ICON[tipo]
            const color = TIPO_COLOR[tipo]
            return (
              <section key={tipo}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0 0.25rem" }}>
                  <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                    {grupoLabel(tipo)}
                  </h2>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>{list.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {list.map((doc) => {
                    const name = titulo(doc)
                    const locked = doc.kind === "nativo" && !puedeBorrarNativo
                    const meta = [detalle(doc), fecha(doc)].filter(Boolean).join("  ·  ")
                    const hasMenu = doc.tipo === "tarjeton"
                    return (
                      <div key={doc.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.875rem",
                        padding: "0.875rem 1rem",
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.875rem",
                      }}>
                        {/* Tipo */}
                        <div style={{
                          width: 44, height: 44, borderRadius: "0.75rem", flexShrink: 0,
                          background: `${color}1a`,
                          display: "flex", alignItems: "center", justifyContent: "center", color,
                        }}>
                          <Icon size={22} weight="duotone" />
                        </div>

                        {/* Identidad del documento */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.25rem", minWidth: 0 }}>
                            <span style={{
                              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                              color, background: `${color}1a`, padding: "0.125rem 0.5rem", borderRadius: "999px", flexShrink: 0,
                            }}>
                              {grupoLabel(tipo)}
                            </span>
                            <span style={{
                              fontSize: "var(--text-xs)", color: "var(--muted)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {meta}
                            </span>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, alignItems: "center" }}>
                          {hasMenu && (
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={() => setMenuDoc(menuDoc === doc.id ? null : doc.id)}
                                aria-label="Más acciones"
                                title="Más opciones"
                                style={{
                                  ...iconBtn, background: "transparent", color: "var(--muted)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <DotsThree size={20} weight="bold" />
                              </button>
                              {menuDoc === doc.id && (
                                <div style={{
                                  position: "absolute", right: 0, bottom: "calc(100% + 6px)",
                                  width: 248, background: "var(--card)", border: "1px solid var(--border)",
                                  borderRadius: "0.75rem", boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                                  padding: "0.375rem", zIndex: 20,
                                }}>
                                  <button
                                    onClick={() => handleImport(doc)}
                                    style={{
                                      display: "flex", alignItems: "center", gap: "0.625rem",
                                      width: "100%", padding: "0.625rem 0.625rem", borderRadius: "0.5rem",
                                      border: "none", background: "transparent", cursor: "pointer",
                                      textAlign: "left", fontFamily: "inherit", color: "var(--fg)",
                                    }}
                                  >
                                    <span style={{ color, flexShrink: 0 }}><UploadSimple size={18} weight="duotone" /></span>
                                    <span style={{ minWidth: 0 }}>
                                      <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600 }}>Cargar al perfil</span>
                                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.3 }}>
                                        Actualiza categoría, antigüedad, jornada y conceptos.
                                      </span>
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

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
                                textDecoration: "none",
                              }}
                            >
                              <PencilLine size={18} weight="bold" />
                            </Link>
                          )}

                          <button
                            onClick={() => handleSend(doc)}
                            title="Enviar a imprimir"
                            aria-label="Enviar a imprimir"
                            style={{ ...iconBtn, background: "var(--primary)", color: "var(--primary-fg)", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }}
                          >
                            <Printer size={18} weight="bold" />
                          </button>

                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={borrandoId === doc.id}
                            title={locked ? "Para borrar, actualiza la app a la última versión." : "Eliminar"}
                            aria-label="Eliminar"
                            style={{
                              ...iconBtn, background: "transparent", color: "#ef4444",
                              border: "1px solid #fecaca", opacity: locked ? 0.45 : 1,
                              cursor: borrandoId === doc.id ? "not-allowed" : "pointer",
                            }}
                          >
                            <Trash size={18} weight="bold" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

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
