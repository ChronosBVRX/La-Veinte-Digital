"use client"

import { useState, useEffect, useCallback, useMemo, useTransition } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  createEmptyEscritoDraftV2,
  type EscritoDraftV2,
} from "@/shared/contracts/escrito-draft"
import {
  getEscritosGuardados,
  getEscritoById,
  guardarEscrito,
  eliminarEscrito,
  duplicarEscrito,
  migrarEscritosLegadosSiEsNecesario,
  serializePersistableDraft,
} from "../services/escritos-storage"
import {
  hydrateEscritoBlobs,
  revokeEscritoBlobs,
} from "../services/escritos-indexeddb"
import { generarEscrito } from "../services/generarEscrito"
import { EscritosForm } from "./EscritosForm"
import { EscritosEditor } from "./EscritosEditor"
import { EscritosResult } from "./EscritosResult"
import { createClient } from "@/lib/supabase/client"
import { getUserWithTimeout } from "@/shared/lib/auth-helpers"
import { useBackLayer } from "@/shared/navigation/useBackLayer"

export function EscritosGenerator() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [authResolved, setAuthResolved] = useState(false)
  const [userId, setUserId] = useState<string>("")
  const [workerProfile, setWorkerProfile] = useState<{
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }>({})

  const [stage, setStage] = useState<"form" | "editor" | "preview">("form")
  const [draft, setDraft] = useState<EscritoDraftV2>(() => createEmptyEscritoDraftV2("anonymous"))
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null)
  const [savedList, setSavedList] = useState<EscritoDraftV2[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null)

  // Capa transitoria canónica: Atrás permanece en el escrito (mismo cierre que
  // el botón "Permanecer en el escrito") antes que retroceder de ruta.
  useBackLayer(pendingNavigationAction !== null, () => setPendingNavigationAction(null), "escritos-unsaved")

  // 1. Cargar sesión de usuario y perfil de forma segura
  useEffect(() => {
    let cancelled = false
    const signal = { aborted: false }

    const loadSession = async () => {
      try {
        const supabase = createClient()
        const res = await getUserWithTimeout(supabase, 4000, signal)
        if (cancelled) return

        if (!res.user) {
          setAuthResolved(true)
          return
        }

        const user = res.user
        setUserId(user.id)
        setDraft((prev) => ({ ...prev, ownerId: user.id }))

        // Ejecutar migración transaccional de legados
        await migrarEscritosLegadosSiEsNecesario(user.id).catch((err) => {
          console.warn("[EscritosGenerator] Error en migración:", err)
        })

        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name,matricula,categoria,adscripcion")
            .eq("id", user.id)
            .maybeSingle()

          if (profile && !cancelled) {
            setWorkerProfile({
              nombre: profile.full_name ?? undefined,
              matricula: profile.matricula ?? undefined,
              categoria: profile.categoria ?? undefined,
              adscripcion: profile.adscripcion ?? undefined,
            })
          }
        } catch (err) {
          console.warn("[EscritosGenerator] No se pudo cargar perfil:", err)
        } finally {
          if (!cancelled) {
            setAuthResolved(true)
          }
        }
      } catch {
        if (!cancelled) {
          setAuthResolved(true)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
      signal.aborted = true
    }
  }, [])

  // 2. Refrescar lista de escritos guardados cuando se resuelve el usuario
  useEffect(() => {
    if (!userId || userId === "anonymous") return
    queueMicrotask(() => {
      const list = getEscritosGuardados(userId)
      setSavedList(list)
    })
  }, [userId])

  // 3. Cargar escrito desde parámetro de URL (?id=...)
  const urlId = searchParams.get("id")
  useEffect(() => {
    if (!urlId || !userId || userId === "anonymous") return
    const found = getEscritoById(urlId, userId)
    if (found) {
      hydrateEscritoBlobs(found, userId).then((hydrated) => {
        setDraft(hydrated)
        setLastSavedSnapshot(serializePersistableDraft(hydrated))
        setStage("editor")
      })
    }
  }, [urlId, userId])

  // Detección canónica de cambios sin guardar
  const currentSnapshot = useMemo(() => serializePersistableDraft(draft), [draft])
  const emptySnapshot = useMemo(
    () => serializePersistableDraft(createEmptyEscritoDraftV2(userId || "anonymous")),
    [userId]
  )

  const isDirty = Boolean(
    lastSavedSnapshot
      ? currentSnapshot !== lastSavedSnapshot
      : currentSnapshot !== emptySnapshot
  )

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  // Reseteo de scroll horizontal al cambiar de etapa
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ left: 0 })
      const scrollEl = document.querySelector(".mobile-app-shell__scroll")
      if (scrollEl) scrollEl.scrollLeft = 0
    }
  }, [stage])

  const handleUpdateDraft = useCallback((updated: Partial<EscritoDraftV2>) => {
    setDraft((prev) => ({ ...prev, ...updated }))
  }, [])

  const [generationError, setGenerationError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const response = await generarEscrito({
        tipo: draft.tipo,
        hechos: draft.hechos,
        peticion: draft.peticion,
        destino: draft.destino,
        ciudad: draft.ciudad,
        fecha: draft.fecha,
        asunto: draft.asunto,
        atencion: draft.atencion,
        copias: draft.copias,
        incluirFundamentos: draft.incluirFundamentos,
      })

      if (response.generationMode === "basic_fallback") {
        setGenerationError(
          response.advertencias?.[0] || "La redacción inteligente no está disponible en este momento."
        )
        return
      }

      const updatedDraft: EscritoDraftV2 = {
        ...draft,
        cuerpo: response.cuerpo,
        fuentes: response.fuentes,
        advertencias: response.advertencias,
        generationMode: response.generationMode,
      }

      setDraft(updatedDraft)
      setStage("editor")
    } catch (err: unknown) {
      console.error("Error al generar escrito:", err)
      const msg = err instanceof Error ? err.message : "Error inesperado al redactar el borrador."
      setGenerationError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleManualEdit = () => {
    setGenerationError(null)
    let cuerpo = draft.cuerpo?.trim() || ""
    if (!cuerpo) {
      if (draft.hechos.trim() || draft.peticion.trim()) {
        const parts: string[] = []
        if (draft.hechos.trim()) parts.push(draft.hechos.trim())
        if (draft.peticion.trim()) parts.push(draft.peticion.trim())
        cuerpo = parts.join("\n\n")
      }
    }

    const updatedDraft: EscritoDraftV2 = {
      ...draft,
      cuerpo,
      generationMode: "manual",
    }

    setDraft(updatedDraft)
    setStage("editor")
  }

  const handleSaveDraft = useCallback(() => {
    try {
      const updatedList = guardarEscrito(draft, userId)
      setSavedList(updatedList)
      setLastSavedSnapshot(serializePersistableDraft(draft))
      setSaveToast("Escrito guardado correctamente en Mis Documentos.")
      setTimeout(() => setSaveToast(null), 3000)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al guardar el borrador.")
    }
  }, [draft, userId])

  const performNewDraft = () => {
    revokeEscritoBlobs(draft)
    const empty = createEmptyEscritoDraftV2(userId)
    setDraft(empty)
    setLastSavedSnapshot(null)
    setStage("form")
    startTransition(() => {
      router.push("/escritos")
    })
  }

  const handleNewDraft = () => {
    if (isDirty) {
      setPendingNavigationAction(() => performNewDraft)
      return
    }
    performNewDraft()
  }

  const performOpenDraft = async (item: EscritoDraftV2, targetStage: "editor" | "preview" = "editor") => {
    revokeEscritoBlobs(draft)
    const hydrated = await hydrateEscritoBlobs(item, userId)
    setDraft(hydrated)
    setLastSavedSnapshot(serializePersistableDraft(hydrated))
    setStage(targetStage)
  }

  const handleOpenDraft = (item: EscritoDraftV2, targetStage: "editor" | "preview" = "editor") => {
    if (isDirty) {
      setPendingNavigationAction(() => () => performOpenDraft(item, targetStage))
      return
    }
    performOpenDraft(item, targetStage)
  }

  const handleDuplicate = async (id: string) => {
    const dup = await duplicarEscrito(id, userId)
    if (dup) {
      setSavedList(getEscritosGuardados(userId))
      setSaveToast("Copia creada exitosamente con archivos independientes.")
      setTimeout(() => setSaveToast(null), 3000)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este escrito guardado? Esta acción purgará también sus firmas y fotos adjuntas.")) {
      const updated = await eliminarEscrito(id, userId)
      setSavedList(updated)
      if (draft.id === id) {
        handleNewDraft()
      }
    }
  }

  if (!authResolved) {
    return (
      <div style={{ maxWidth: "840px", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <LoadingSpinner text="Cargando generador de escritos..." />
      </div>
    )
  }

  if (!userId || userId === "anonymous") {
    return (
      <div style={{ maxWidth: "540px", margin: "4rem auto", padding: "1rem" }}>
        <Card padding="2rem" style={{ textAlign: "center", background: "var(--card)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>
            Inicia sesión para continuar
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Para redactar, guardar, adjuntar fotografías y firmar tus escritos de forma privada y segura, necesitas acceder con tu cuenta.
          </p>
          <Link href="/login">
            <Button variant="primary" size="md">
              Iniciar sesión
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "840px", width: "100%", minWidth: 0, margin: "0 auto", padding: "clamp(0.75rem, 2.5vw, 1.5rem) 0", boxSizing: "border-box", overflowX: "hidden" }}>
      {/* Modal de confirmación de cambios sin guardar */}
      {pendingNavigationAction && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <Card padding="1.5rem" style={{ maxWidth: "420px", width: "100%", minWidth: 0, background: "var(--card)", boxSizing: "border-box" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)" }}>
              ⚠️ Cambios sin guardar
            </h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              Tienes cambios en el borrador actual que no han sido guardados. ¿Deseas descartarlos y continuar?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.5rem", width: "100%", boxSizing: "border-box" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingNavigationAction(null)}
              >
                Permanecer en el escrito
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const action = pendingNavigationAction
                  setPendingNavigationAction(null)
                  action()
                }}
              >
                Descartar y continuar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Toast de Guardado */}
      {saveToast && (
        <div
          style={{
            position: "fixed",
            bottom: "5rem",
            right: "1rem",
            maxWidth: "calc(100% - 2rem)",
            background: "#0f172a",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            zIndex: 9999,
            boxSizing: "border-box",
          }}
        >
          {saveToast}
        </div>
      )}

      {/* Encabezado y Navegador de Etapas */}
      <div style={{ marginBottom: "1.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem", width: "100%", boxSizing: "border-box" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.25rem, 4vw, 1.5rem)", fontWeight: 800, color: "var(--fg)", overflowWrap: "break-word" }}>
              Generador de Escritos
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "clamp(0.75rem, 2.5vw, 0.875rem)", color: "var(--muted)" }}>
              Redacta oficios laborales y solicitudes sindicales con estructura formal y fundamentación verificada.
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={handleNewDraft}>
            ➕ Nuevo escrito
          </Button>
        </div>

        {/* Indicador de 3 Etapas responsivo con minmax(0, 1fr) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.25rem", background: "var(--card)", padding: "0.25rem", borderRadius: "0.75rem", border: "1px solid var(--border)", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <button
            type="button"
            onClick={() => setStage("form")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "form" ? "var(--primary)" : "transparent",
              color: stage === "form" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "clamp(0.7rem, 2.3vw, 0.8125rem)",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            1. Formulario
          </button>
          <button
            type="button"
            onClick={() => setStage("editor")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "editor" ? "var(--primary)" : "transparent",
              color: stage === "editor" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "clamp(0.7rem, 2.3vw, 0.8125rem)",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            2. Editor
          </button>
          <button
            type="button"
            onClick={() => setStage("preview")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "preview" ? "var(--primary)" : "transparent",
              color: stage === "preview" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "clamp(0.7rem, 2.3vw, 0.8125rem)",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            3. Vista y Firma
          </button>
        </div>
      </div>

      {/* Contenido de la Etapa Activa */}
      {stage === "form" && (
        <EscritosForm
          userId={userId}
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          onGenerate={handleGenerate}
          onManualEdit={handleManualEdit}
          isGenerating={isGenerating}
          generationError={generationError}
          onRetryAI={handleGenerate}
          workerProfile={workerProfile}
        />
      )}

      {stage === "editor" && (
        <EscritosEditor
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          onSaveDraft={handleSaveDraft}
          onGoToPreview={() => setStage("preview")}
          onBackToForm={() => setStage("form")}
        />
      )}

      {stage === "preview" && (
        <EscritosResult
          userId={userId}
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          onSaveDraft={handleSaveDraft}
          onBackToEditor={() => setStage("editor")}
          workerProfile={workerProfile}
        />
      )}

      {/* Sección de Escritos Guardados del Usuario */}
      {savedList.length > 0 && (
        <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)", marginBottom: "1rem" }}>
            📂 Mis escritos guardados ({savedList.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {savedList.map((item) => (
              <Card key={item.id} padding="0.875rem" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", width: "100%", boxSizing: "border-box" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", overflowWrap: "break-word", wordBreak: "break-word" }}>
                    {item.titulo}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem", overflowWrap: "break-word" }}>
                    {item.destino.nombre ? `Para: ${item.destino.nombre} • ` : ""}
                    {item.fecha} {item.anexos.length > 0 ? `• 📷 ${item.anexos.length} fotos` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDraft(item, "editor")}>
                    ✏ Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDraft(item, "preview")}>
                    🖨 Ver
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(item.id)}>
                    📋 Duplicar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    🗑 Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
