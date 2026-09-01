"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { institutionalToday } from "@/shared/lib/dates"
import { EscritosForm } from "./EscritosForm"
import { EscritosEditor } from "./EscritosEditor"
import { EscritosResult } from "./EscritosResult"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { Button } from "@/shared/components/ui/Button"
import {
  getEscritosGuardados,
  guardarEscrito,
  eliminarEscrito,
  duplicarEscrito,
  getEscritoById,
} from "../services/escritos-storage"
import { generarEscritoApi } from "../services/generarEscrito"
import {
  createEmptyEscritoDraftV2,
  type EscritoDraftV2,
  type WorkerProfileContext,
  type GenerarEscritoRequest,
} from "@/shared/contracts/escrito-draft"

interface Profile {
  id: string
  full_name: string
  matricula: string
  categoria: string
  adscripcion: string
}

export function EscritosGenerator() {
  const supabase = createClient()

  const [userId, setUserId] = useState<string>("anonymous")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(true)
  const [perfilIncompleto, setPerfilIncompleto] = useState(false)

  // Etapas del flujo: "form" (Paso 1) | "editor" (Paso 2) | "preview" (Paso 3)
  const [etapa, setEtapa] = useState<"form" | "editor" | "preview">("form")

  const [draft, setDraft] = useState<EscritoDraftV2>(() =>
    createEmptyEscritoDraftV2("anonymous", undefined, {
      fecha: institutionalToday().toISOString().slice(0, 10),
    })
  )

  const [loadingGeneracion, setLoadingGeneracion] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardadoMsg, setGuardadoMsg] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [escritos, setEscritos] = useState<EscritoDraftV2[]>([])

  // Carga inicial de escritos y perfil
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/login"
        return
      }

      setUserId(user.id)

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, matricula, categoria, adscripcion")
        .eq("id", user.id)
        .maybeSingle()

      setCargandoPerfil(false)

      if (!prof || !prof.full_name || !prof.matricula || !prof.categoria || !prof.adscripcion) {
        setPerfilIncompleto(true)
        return
      }

      setProfile(prof as Profile)
      const lista = getEscritosGuardados(user.id)
      setEscritos(lista)

      // Verificar si viene con ?id= en la URL
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search)
        const idParam = urlParams.get("id")
        if (idParam) {
          const encontrado = getEscritoById(idParam, user.id)
          if (encontrado) {
            setDraft(encontrado)
            setEtapa("editor")
          }
        }
      }
    })
  }, [supabase])

  const updateDraft = useCallback((updated: Partial<EscritoDraftV2>) => {
    setDraft((prev) => ({ ...prev, ...updated }))
    setHasUnsavedChanges(true)
  }, [])

  const handleGenerar = useCallback(async () => {
    setLoadingGeneracion(true)
    try {
      const req: GenerarEscritoRequest = {
        tipo: draft.tipo,
        hechos: draft.hechos,
        peticion: draft.peticion,
        destino: draft.destino,
        ciudad: draft.ciudad,
        fecha: draft.fecha,
        asunto: draft.asunto,
        incluirFundamentos: true,
      }

      const res = await generarEscritoApi(req)
      setDraft((prev) => ({
        ...prev,
        cuerpo: res.cuerpo,
        asunto: prev.asunto || res.asuntoSugerido,
        titulo: prev.titulo === "Nuevo escrito" ? res.tituloSugerido : prev.titulo,
        fuentes: res.fuentes,
        generationMode: res.generationMode,
      }))

      setHasUnsavedChanges(true)
      setEtapa("editor")
    } catch (e) {
      console.error("[EscritosGenerator] Error generando escrito:", e)
    } finally {
      setLoadingGeneracion(false)
    }
  }, [draft])

  const handleGuardarBorrador = useCallback(
    (tituloPersonalizado?: string) => {
      setGuardando(true)
      try {
        const toSave: EscritoDraftV2 = {
          ...draft,
          titulo: tituloPersonalizado || draft.titulo || "Borrador de escrito",
          status: "draft",
          ownerId: userId,
        }

        const listaActualizada = guardarEscrito(toSave, userId)
        setEscritos(listaActualizada)
        setDraft(toSave)
        setHasUnsavedChanges(false)

        setGuardadoMsg("✓ Escrito guardado en este dispositivo")
        setTimeout(() => setGuardadoMsg(""), 3500)
      } catch (err: unknown) {
        if (err instanceof Error) {
          alert(err.message)
        }
      } finally {
        setGuardando(false)
      }
    },
    [draft, userId]
  )

  const handleLimpiarFormulario = useCallback(() => {
    setDraft(
      createEmptyEscritoDraftV2(userId, undefined, {
        fecha: institutionalToday().toISOString().slice(0, 10),
      })
    )
    setHasUnsavedChanges(false)
  }, [userId])

  const handleAbrirParaEditar = useCallback((item: EscritoDraftV2) => {
    setDraft(item)
    setHasUnsavedChanges(false)
    setEtapa("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleAbrirParaVer = useCallback((item: EscritoDraftV2) => {
    setDraft(item)
    setHasUnsavedChanges(false)
    setEtapa("preview")
  }, [])

  const handleDuplicar = useCallback(
    (id: string) => {
      const dup = duplicarEscrito(id, userId)
      if (dup) {
        setEscritos(getEscritosGuardados(userId))
        setGuardadoMsg("✓ Escrito duplicado como nuevo borrador")
        setTimeout(() => setGuardadoMsg(""), 3500)
      }
    },
    [userId]
  )

  const handleConfirmarEliminar = useCallback(
    (id: string) => {
      if (window.confirm("¿Seguro que deseas eliminar este escrito guardado?")) {
        const listaActualizada = eliminarEscrito(id, userId)
        setEscritos(listaActualizada)
        if (draft.id === id) {
          handleLimpiarFormulario()
          setEtapa("form")
        }
      }
    },
    [userId, draft.id, handleLimpiarFormulario]
  )

  const workerProfileContext: WorkerProfileContext | null = profile
    ? {
        nombre: profile.full_name,
        matricula: profile.matricula,
        categoria: profile.categoria,
        adscripcion: profile.adscripcion,
      }
    : null

  if (cargandoPerfil) {
    return <LoadingSpinner text="Cargando generador de escritos..." />
  }

  if (perfilIncompleto) {
    return (
      <div
        style={{
          maxWidth: 520,
          margin: "2rem auto",
          textAlign: "center",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "2.5rem 1.5rem",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Perfil incompleto</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Para generar oficios y escritos formales, necesitas tener registrados tus datos laborales (Nombre, Matrícula, Categoría y Adscripción).
        </p>
        <a
          href="/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.625rem 1.5rem",
            borderRadius: "999px",
            background: "var(--primary)",
            color: "var(--primary-fg)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          Completar mi perfil
        </a>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Toast flotante de guardado */}
      {guardadoMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#16a34a",
            color: "#ffffff",
            padding: "0.625rem 1.25rem",
            borderRadius: "999px",
            fontSize: "0.875rem",
            fontWeight: 600,
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            zIndex: 1400,
          }}
        >
          {guardadoMsg}
        </div>
      )}

      {/* ETAPA 1: Formulario guiado y opciones avanzadas */}
      {etapa === "form" && (
        <EscritosForm
          profile={profile}
          draft={draft}
          onUpdateDraft={updateDraft}
          onGenerate={handleGenerar}
          onClear={handleLimpiarFormulario}
          loading={loadingGeneracion}
        />
      )}

      {/* ETAPA 2: Editor robusto con IA ("Revisa y modifica tu escrito") */}
      {etapa === "editor" && (
        <EscritosEditor
          draft={draft}
          onUpdateDraft={updateDraft}
          onSaveDraft={() => handleGuardarBorrador()}
          onPreview={() => setEtapa("preview")}
          onBackToForm={() => setEtapa("form")}
          onRegenerate={handleGenerar}
          saving={guardando}
          regenerating={loadingGeneracion}
        />
      )}

      {/* ETAPA 3: Vista final y previsualización */}
      {etapa === "preview" && (
        <EscritosResult
          draft={draft}
          profile={workerProfileContext}
          onEdit={() => setEtapa("editor")}
          onSave={(titulo) => handleGuardarBorrador(titulo)}
          onClose={() => setEtapa("editor")}
          onUpdateDraft={updateDraft}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      {/* Sección: Mis escritos guardados */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginTop: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            📂 Mis escritos guardados
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--primary)",
                background: "var(--accent)",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
              }}
            >
              {escritos.length}
            </span>
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Guardados localmente en este dispositivo
          </span>
        </div>

        {escritos.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Aún no tienes escritos guardados. Redacta uno y usa el botón <strong>💾 Guardar</strong> para conservarlo aquí.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.625rem" }}>
            {escritos.map((item) => {
              const fechaDisplay = item.fecha
                ? new Date(item.fecha + "T12:00:00").toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : ""

              const recipientText = item.destino?.nombre || item.destino?.cargo || ""

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.titulo || "Escrito sin título"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                      {fechaDisplay}
                      {recipientText ? ` · Para: ${recipientText}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbrirParaEditar(item)}
                      title="Editar escrito"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      ✏ Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbrirParaVer(item)}
                      title="Ver e imprimir documento"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      🖨 Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicar(item.id)}
                      title="Duplicar como nuevo borrador"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      📋 Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConfirmarEliminar(item.id)}
                      title="Eliminar escrito"
                      aria-label="Eliminar escrito"
                      style={{ color: "#ef4444", fontSize: "0.8125rem" }}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
