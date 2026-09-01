"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
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
} from "../services/escritos-storage"
import {
  hydrateEscritoBlobs,
  revokeEscritoBlobs,
} from "../services/escritos-indexeddb"
import { EscritosForm } from "./EscritosForm"
import { EscritosEditor } from "./EscritosEditor"
import { EscritosResult } from "./EscritosResult"
import { generarEscrito } from "../services/generarEscrito"

export function EscritosGenerator() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [userId, setUserId] = useState<string>("anonymous")
  const [workerProfile, setWorkerProfile] = useState<{
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }>({})

  const [stage, setStage] = useState<"form" | "editor" | "preview">("form")
  const [draft, setDraft] = useState<EscritoDraftV2>(() => createEmptyEscritoDraftV2("anonymous"))
  const [savedList, setSavedList] = useState<EscritoDraftV2[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // 1. Cargar sesión de usuario y perfil
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      setUserId(user.id)

      supabase
        .from("profiles")
        .select("full_name,matricula,categoria,adscripcion")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (cancelled) return
          if (profile) {
            setWorkerProfile((prev) => ({
              ...prev,
              nombre: profile.full_name || prev.nombre,
              matricula: profile.matricula || prev.matricula,
              categoria: profile.categoria || prev.categoria,
              adscripcion: profile.adscripcion || prev.adscripcion,
            }))
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [])

  // 2. Refrescar lista de escritos guardados cuando cambia el usuario
  useEffect(() => {
    queueMicrotask(() => {
      const list = getEscritosGuardados(userId)
      setSavedList(list)
    })
  }, [userId])

  // 3. Cargar escrito desde parámetro de URL (?id=...)
  const urlId = searchParams.get("id")
  useEffect(() => {
    if (!urlId) return
    const found = getEscritoById(urlId, userId)
    if (found) {
      hydrateEscritoBlobs(found, userId).then((hydrated) => {
        setDraft(hydrated)
        setStage("editor")
      })
    }
  }, [urlId, userId])

  const handleUpdateDraft = useCallback((updated: Partial<EscritoDraftV2>) => {
    setDraft((prev) => ({ ...prev, ...updated }))
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
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
        incluirFundamentos: true,
      })

      const updatedDraft: EscritoDraftV2 = {
        ...draft,
        cuerpo: response.cuerpo,
        asunto: draft.asunto || response.asuntoSugerido,
        titulo: draft.titulo === "Nuevo escrito" ? response.tituloSugerido : draft.titulo,
        fuentes: response.fuentes,
        advertencias: response.advertencias,
        generationMode: response.generationMode,
      }

      setDraft(updatedDraft)
      setStage("editor")
    } catch (err: unknown) {
      console.error("Error al generar escrito:", err)
      const msg = err instanceof Error ? err.message : "Error inesperado al redactar el borrador."
      alert(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveDraft = useCallback(() => {
    try {
      const updatedList = guardarEscrito(draft, userId)
      setSavedList(updatedList)
      setSaveToast("Borrador guardado correctamente en tu dispositivo.")
      setTimeout(() => setSaveToast(null), 3000)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al guardar el borrador.")
    }
  }, [draft, userId])

  const handleNewDraft = () => {
    revokeEscritoBlobs(draft)
    const empty = createEmptyEscritoDraftV2(userId)
    setDraft(empty)
    setStage("form")
    startTransition(() => {
      router.push("/escritos")
    })
  }

  const handleOpenDraft = async (item: EscritoDraftV2, targetStage: "editor" | "preview" = "editor") => {
    revokeEscritoBlobs(draft)
    const hydrated = await hydrateEscritoBlobs(item, userId)
    setDraft(hydrated)
    setStage(targetStage)
  }

  const handleDuplicate = (id: string) => {
    const dup = duplicarEscrito(id, userId)
    if (dup) {
      setSavedList(getEscritosGuardados(userId))
      setSaveToast("Copia creada exitosamente.")
      setTimeout(() => setSaveToast(null), 3000)
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este escrito guardado?")) {
      const updated = eliminarEscrito(id, userId)
      setSavedList(updated)
      if (draft.id === id) {
        handleNewDraft()
      }
    }
  }

  return (
    <div style={{ maxWidth: "840px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Toast de Guardado */}
      {saveToast && (
        <div
          style={{
            position: "fixed",
            bottom: "5rem",
            right: "1.5rem",
            background: "#0f172a",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            zIndex: 9999,
          }}
        >
          {saveToast}
        </div>
      )}

      {/* Encabezado y Navegador de Etapas */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)" }}>
              Generador de Escritos
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
              Redacta oficios laborales y solicitudes sindicales con estructura formal y fundamentación verificada.
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={handleNewDraft}>
            ➕ Nuevo escrito
          </Button>
        </div>

        {/* Indicador de 3 Etapas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", background: "var(--card)", padding: "0.375rem", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setStage("form")}
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "form" ? "var(--primary)" : "transparent",
              color: stage === "form" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            1. Formulario
          </button>
          <button
            type="button"
            onClick={() => setStage("editor")}
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "editor" ? "var(--primary)" : "transparent",
              color: stage === "editor" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            2. Editor
          </button>
          <button
            type="button"
            onClick={() => setStage("preview")}
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: stage === "preview" ? "var(--primary)" : "transparent",
              color: stage === "preview" ? "var(--primary-fg)" : "var(--muted)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
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
          isGenerating={isGenerating}
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
              <Card key={item.id} padding="1rem" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                    {item.titulo}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                    {item.destino.nombre ? `Para: ${item.destino.nombre} • ` : ""}
                    {item.fecha} {item.anexos.length > 0 ? `• 📷 ${item.anexos.length} fotos` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
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
