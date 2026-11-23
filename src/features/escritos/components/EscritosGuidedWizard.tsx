"use client"

import { useState, useMemo } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Textarea } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import {
  TIPOS_ESCRITO,
  type TipoEscritoKey,
  type EscritoDraftV2,
  type AnexoItem,
} from "@/shared/contracts/escrito-draft"
import { saveBlobResource, deleteBlobResource } from "../services/escritos-indexeddb"
import { isGenericAsunto } from "@/shared/lib/escrito-asunto"
import { buscarDestinatarios } from "../data/directorio-destinatarios"
import { DestinatarioSelectorModal } from "./DestinatarioSelectorModal"

export interface EscritosGuidedWizardProps {
  userId: string
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onGenerate: () => void
  onManualEdit: () => void
  isGenerating: boolean
  generationError?: string | null
  onRetryAI?: () => void
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }
  onSwitchToNormalMode?: () => void
}

export function EscritosGuidedWizard({
  userId,
  draft,
  onUpdateDraft,
  onGenerate,
  onManualEdit,
  isGenerating,
  generationError,
  onRetryAI,
  workerProfile,
  onSwitchToNormalMode,
}: EscritosGuidedWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false)
  const [selectorInitialTab, setSelectorInitialTab] = useState<"directorio" | "manual">("directorio")
  const [anexoUploading, setAnexoUploading] = useState(false)
  const [stepValidationError, setStepValidationError] = useState<string | null>(null)
  const [comiteSearch, setComiteSearch] = useState("")

  const COMITE_DESTACADOS = useMemo(
    () => [
      { id: "sec_general", cargo: "Secretaría General", nombre: "Dr. Simbad Solorio Vargas" },
      { id: "sec_trabajo", cargo: "Secretaría de Trabajo", nombre: "A.U.O. Sergio A. González González" },
      { id: "sec_conflictos", cargo: "Secretaría de Conflictos", nombre: "T.B.E.M. Luis Arturo Gallegos Ortiz" },
      { id: "sec_prevision", cargo: "Secretaría de Previsión Social", nombre: "M.F. Laura Paulina Franco Córdova" },
      { id: "sec_admision", cargo: "Secretaría de Admisión y Cambios", nombre: "M.G. Josefina Ríos Álvarez" },
      { id: "sec_bolsa", cargo: "Bolsa de Trabajo", nombre: "M.N.F. Carlos Báez Ambriz" },
    ],
    []
  )

  const displayedComiteItems = useMemo(() => {
    if (!comiteSearch.trim()) return COMITE_DESTACADOS
    const found = buscarDestinatarios(comiteSearch)
    if (found.length === 0) return []
    return found.slice(0, 8).map((d) => ({
      id: d.id,
      cargo: d.cargo,
      nombre: d.nombre,
    }))
  }, [comiteSearch, COMITE_DESTACADOS])

  const isComiteDestino = useMemo(() => {
    if (!draft.destino.cargo && !draft.destino.nombre) return null
    const nombreMatch = draft.destino.nombre ? buscarDestinatarios(draft.destino.nombre) : []
    const cargoMatch = draft.destino.cargo ? buscarDestinatarios(draft.destino.cargo) : []
    return (
      nombreMatch.some((d) => d.nombre === draft.destino.nombre) ||
      cargoMatch.some((d) => d.cargo === draft.destino.cargo)
    )
  }, [draft.destino.cargo, draft.destino.nombre])

  const [destinoMode, setDestinoMode] = useState<"comite" | "manual">(() => {
    if (isComiteDestino === false && (draft.destino.cargo || draft.destino.nombre)) {
      return "manual"
    }
    return "comite"
  })

  const currentTipoDef = TIPOS_ESCRITO[draft.tipo] || TIPOS_ESCRITO.solicitud

  const handleTipoSelect = (tipo: TipoEscritoKey) => {
    onUpdateDraft({
      tipo,
      ...(draft.asunto && !isGenericAsunto(draft.asunto) ? { asunto: draft.asunto } : { asunto: "" }),
    })
  }

  const handleQuickDestino = (cargo: string, nombre: string) => {
    onUpdateDraft({
      destino: { cargo, nombre },
    })
    setStepValidationError(null)
  }

  // Manejo de imágenes adjuntas
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setAnexoUploading(true)
    setStepValidationError(null)

    try {
      const newAnexos: AnexoItem[] = [...draft.anexos]

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith("image/")) {
          setStepValidationError("Solo se admiten archivos de imagen (JPG, PNG, WebP).")
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setStepValidationError("Cada imagen no debe exceder los 10MB.")
          continue
        }

        const anexoId = `anx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const storageRef = await saveBlobResource(
          userId,
          draft.id,
          "anexo",
          anexoId,
          file
        )

        const previewUrl = URL.createObjectURL(file)

        newAnexos.push({
          id: anexoId,
          nombre: file.name.replace(/\.[^/.]+$/, ""),
          descripcion: "",
          tipo: file.type,
          size: file.size,
          storageRef,
          previewUrl,
        })
      }

      onUpdateDraft({
        anexos: newAnexos,
        ...(newAnexos.length >= 2 && !draft.anexosLayout ? { anexosLayout: "compact" } : {}),
      })
    } catch (err) {
      console.error("Error guardando anexo:", err)
      setStepValidationError("Error al procesar la imagen adjunta.")
    } finally {
      setAnexoUploading(false)
      if (e.target) e.target.value = ""
    }
  }

  const removeAnexo = async (index: number) => {
    const anexo = draft.anexos[index]
    if (anexo) {
      if (anexo.storageRef) {
        await deleteBlobResource(userId, anexo.storageRef).catch(() => {})
      }
      if (anexo.previewUrl && anexo.previewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(anexo.previewUrl)
        } catch {
          // noop
        }
      }
    }
    const updated = draft.anexos.filter((_, i) => i !== index)
    onUpdateDraft({ anexos: updated })
  }

  // Validación por paso
  const canProceedToNext = (fromStep: number): boolean => {
    setStepValidationError(null)
    if (fromStep === 1) {
      if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
        setStepValidationError("Por favor elige a quién va dirigido tu escrito antes de continuar.")
        return false
      }
    }
    if (fromStep === 3) {
      if (!draft.hechos.trim()) {
        setStepValidationError("Por favor cuéntanos brevemente qué ocurrió antes de avanzar al siguiente paso.")
        return false
      }
    }
    if (fromStep === 4) {
      if (!draft.peticion.trim()) {
        setStepValidationError("Por favor indica qué necesitas que te respondan o autoricen.")
        return false
      }
    }
    return true
  }

  const goToNextStep = () => {
    if (canProceedToNext(step)) {
      if (step < 5) setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5)
    }
  }

  const goToPrevStep = () => {
    setStepValidationError(null)
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)
  }

  const handleFinalAiSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      setStep(1)
      setStepValidationError("Falta indicar a quién va dirigido el escrito.")
      return
    }
    if (!draft.hechos.trim()) {
      setStep(3)
      setStepValidationError("Por favor describe lo sucedido en el Paso 3.")
      return
    }
    if (!draft.peticion.trim()) {
      setStep(4)
      setStepValidationError("Por favor indica tu petición concreta en el Paso 4.")
      return
    }
    onGenerate()
  }

  const handleFinalManualSubmit = () => {
    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      setStep(1)
      setStepValidationError("Falta indicar a quién va dirigido el escrito.")
      return
    }
    onManualEdit()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Banner de Bienvenida Guiada */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🧭</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              Asistente Guiado Paso a Paso
            </span>
            <span style={{ fontSize: "0.6875rem", background: "var(--primary)", color: "var(--primary-fg)", padding: "0.15rem 0.45rem", borderRadius: "1rem", fontWeight: 600 }}>
              Para nuevos usuarios
            </span>
          </div>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
            Te llevamos paso a paso con explicaciones claras. No necesitas saber términos legales: la IA le dará formato oficial.
          </p>
          {workerProfile?.nombre && (
            <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--muted)" }}>
              Redactando como: <strong>{workerProfile.nombre}</strong> {workerProfile.categoria ? `• ${workerProfile.categoria}` : ""}
            </div>
          )}
        </div>

        {onSwitchToNormalMode && (
          <Button variant="ghost" size="sm" type="button" onClick={onSwitchToNormalMode}>
            Cambiar a modo normal ➡
          </Button>
        )}
      </div>

      {/* Indicador de 5 Pasos Guiados */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "0.25rem",
          background: "var(--card)",
          padding: "0.375rem",
          borderRadius: "0.75rem",
          border: "1px solid var(--border)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {[
          { num: 1, label: "Destinatario", icon: "👤" },
          { num: 2, label: "Motivo", icon: "📋" },
          { num: 3, label: "Hechos", icon: "📝" },
          { num: 4, label: "Petición", icon: "🎯" },
          { num: 5, label: "Finalizar", icon: "✨" },
        ].map((item) => {
          const isActive = step === item.num
          const isDone = step > item.num
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (item.num < step || canProceedToNext(step)) {
                  setStep(item.num as 1 | 2 | 3 | 4 | 5)
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 0.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background: isActive ? "var(--primary)" : isDone ? "var(--accent)" : "transparent",
                color: isActive ? "var(--primary-fg)" : isDone ? "var(--fg)" : "var(--muted)",
                fontSize: "clamp(0.6875rem, 2vw, 0.75rem)",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1rem", marginBottom: "0.125rem" }}>
                {isDone ? "✓" : item.icon}
              </span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Alerta de validación si existe */}
      {stepValidationError && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", color: "#991b1b", fontSize: "0.8125rem" }}>
          ⚠️ {stepValidationError}
        </div>
      )}

      {/* CONTENIDO DEL PASO 1: DESTINATARIO */}
      {step === 1 && (
        <Card padding="1.25rem" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Paso 1: ¿A qué representante del Sindicato va dirigido tu escrito?
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Elige si tu escrito va dirigido a una secretaría del Comité Seccional o escríbelo directamente para tu Delegado Sindical local:
            </p>
          </div>

          {/* Toggle Claro de 2 Modos: Comité Seccional (Escoger) vs Mi Delegado (Escribir) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              background: "var(--accent)",
              padding: "0.3125rem",
              borderRadius: "0.625rem",
              border: "1px solid var(--border)",
            }}
            role="tablist"
            aria-label="Tipo de destinatario sindical"
          >
            <button
              type="button"
              role="tab"
              aria-selected={destinoMode === "comite"}
              onClick={() => {
                setDestinoMode("comite")
                setStepValidationError(null)
              }}
              style={{
                padding: "0.625rem 0.5rem",
                borderRadius: "0.5rem",
                border: destinoMode === "comite" ? "1.5px solid var(--primary)" : "1px solid transparent",
                background: destinoMode === "comite" ? "var(--card)" : "transparent",
                color: destinoMode === "comite" ? "var(--primary)" : "var(--muted)",
                fontWeight: destinoMode === "comite" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: destinoMode === "comite" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.125rem",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "0.9375rem", fontWeight: 700 }}>🏛️ Comité Seccional</span>
              <span style={{ fontSize: "0.6875rem", color: destinoMode === "comite" ? "var(--primary)" : "var(--muted)" }}>
                (Escoger de la lista oficial)
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={destinoMode === "manual"}
              onClick={() => {
                setDestinoMode("manual")
                setStepValidationError(null)
              }}
              style={{
                padding: "0.625rem 0.5rem",
                borderRadius: "0.5rem",
                border: destinoMode === "manual" ? "1.5px solid var(--primary)" : "1px solid transparent",
                background: destinoMode === "manual" ? "var(--card)" : "transparent",
                color: destinoMode === "manual" ? "var(--primary)" : "var(--muted)",
                fontWeight: destinoMode === "manual" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: destinoMode === "manual" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.125rem",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "0.9375rem", fontWeight: 700 }}>✍️ Mi Delegado / Local</span>
              <span style={{ fontSize: "0.6875rem", color: destinoMode === "manual" ? "var(--primary)" : "var(--muted)" }}>
                (Escribir nombre y cargo)
              </span>
            </button>
          </div>

          {/* Banner de resumen si ya hay un destinatario configurado */}
          {(draft.destino.nombre?.trim() || draft.destino.cargo?.trim()) && (
            <div
              style={{
                background: "rgba(37, 99, 235, 0.05)",
                border: "1.5px solid var(--primary)",
                borderRadius: "0.625rem",
                padding: "0.75rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                  ✓ Destinatario configurado:
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                  {draft.destino.nombre || "(Sin nombre especificado)"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {draft.destino.cargo}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onUpdateDraft({ destino: { cargo: "", nombre: "" } })
                  setStepValidationError(null)
                }}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  padding: "0.3125rem 0.625rem",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ✕ Limpiar selección
              </button>
            </div>
          )}

          {/* CONTENIDO DE LA PESTAÑA 1: COMITÉ SECCIONAL (ESCOGER) */}
          {destinoMode === "comite" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                Toca a la persona o secretaría del SNTSS Sección XX que atenderá tu trámite:
              </div>

              <Input
                id="filtro-comite-wizard"
                type="search"
                label=""
                placeholder="🔍 Filtrar por nombre o secretaría (ej. Simbad, Trabajo, Conflictos...)"
                value={comiteSearch}
                onChange={(e) => setComiteSearch(e.target.value)}
              />

              {displayedComiteItems.length === 0 ? (
                <div style={{ padding: "1.25rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", background: "var(--accent)", borderRadius: "0.5rem" }}>
                  No se encontró ningún integrante en el directorio con &ldquo;{comiteSearch}&rdquo;.
                  <div style={{ marginTop: "0.5rem" }}>
                    <Button variant="secondary" size="sm" type="button" onClick={() => setDestinoMode("manual")}>
                      Escribir en &ldquo;Mi Delegado / Local&rdquo; ✍️
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "0.5rem" }}>
                  {displayedComiteItems.map((item) => {
                    const isSelected =
                      draft.destino.nombre === item.nombre && draft.destino.cargo === item.cargo

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleQuickDestino(item.cargo, item.nombre)}
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                          background: isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--card)",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          transition: "all 0.12s ease",
                          boxShadow: isSelected ? "0 0 0 1px var(--primary)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <div style={{ fontWeight: 700, color: isSelected ? "var(--primary)" : "var(--fg)" }}>
                            {item.nombre}
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                              ✓ Elegido
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                          {item.cargo}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Botón para ver directorio completo en modal */}
              <button
                type="button"
                onClick={() => {
                  setSelectorInitialTab("directorio")
                  setIsSelectorModalOpen(true)
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.625rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px dashed var(--primary)",
                  background: "var(--accent)",
                  color: "var(--primary)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: "0.25rem",
                }}
              >
                <MagnifyingGlass size={16} weight="bold" />
                <span>Ver todas las secretarías, comisiones y subcomisiones (30+ integrantes)</span>
              </button>
            </div>
          )}

          {/* CONTENIDO DE LA PESTAÑA 2: MI DELEGADO / LOCAL (ESCRIBIR) */}
          {destinoMode === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                Escribe los datos de la representación sindical en tu clínica, hospital o centro de trabajo:
              </div>

              {/* Sugerencias rápidas para el cargo */}
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
                  Sugerencias rápidas para el cargo:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  {[
                    "Delegado Sindical",
                    "Representante Delegacional",
                    "Subcomisión Mixta",
                    "A quien corresponda",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        if (sug === "A quien corresponda") {
                          onUpdateDraft({
                            destino: { cargo: sug, nombre: sug },
                          })
                        } else {
                          onUpdateDraft({
                            destino: { ...draft.destino, cargo: sug },
                          })
                        }
                        setStepValidationError(null)
                      }}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "1rem",
                        border: "1px solid var(--border)",
                        background: "var(--accent)",
                        color: "var(--fg)",
                        cursor: "pointer",
                      }}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                id="wizard-manual-cargo"
                label="Cargo o representación sindical *"
                placeholder="Ej. Delegado Sindical Turno Matutino HGZ 1"
                value={draft.destino.cargo}
                onChange={(e) => {
                  onUpdateDraft({ destino: { ...draft.destino, cargo: e.target.value } })
                  setStepValidationError(null)
                }}
                required
              />

              <Input
                id="wizard-manual-nombre"
                label="Nombre del destinatario (opcional o 'A quien corresponda')"
                placeholder="Ej. Enf. Roberto Méndez / A quien corresponda"
                value={draft.destino.nombre}
                onChange={(e) => {
                  onUpdateDraft({ destino: { ...draft.destino, nombre: e.target.value } })
                  setStepValidationError(null)
                }}
              />

              <div style={{ fontSize: "0.75rem", color: "var(--muted)", background: "var(--accent)", padding: "0.5rem 0.75rem", borderRadius: "0.375rem" }}>
                💡 <strong>Tip:</strong> Si no sabes el nombre de tu delegado sindical, puedes dejar solo su cargo o escribir &ldquo;A quien corresponda&rdquo;.
              </div>
            </div>
          )}

          {/* Consejo amigable para nuevos usuarios */}
          <div style={{ background: "rgba(37, 99, 235, 0.05)", border: "1px solid rgba(37, 99, 235, 0.15)", borderRadius: "0.5rem", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--fg)" }}>
            💡 <strong>Guía para elegir tu destinatario:</strong>
            <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem", color: "var(--muted)", lineHeight: 1.5 }}>
              <li><strong>Secretaría de Trabajo:</strong> Para asuntos de rol, jornada, descansos, permisos contractuales y condiciones laborales.</li>
              <li><strong>Secretaría de Conflictos:</strong> Para defensa sindical ante actas, sanciones, quejas o violaciones al CCT.</li>
              <li><strong>Otras Secretarías:</strong> Previsión Social, Admisión y Cambios, Becas, Bolsa de Trabajo, o directamente a la Secretaría General.</li>
              <li><strong>Mi Delegado / Local:</strong> Para solicitudes y trámites directos en tu centro de trabajo o clínica de adscripción.</li>
            </ul>
          </div>
        </Card>
      )}

      {/* CONTENIDO DEL PASO 2: TIPO DE ESCRITO Y LUGAR/FECHA */}
      {step === 2 && (
        <Card padding="1.25rem" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Paso 2: ¿Cuál es el motivo principal de tu escrito?
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Selecciona la categoría que mejor describa tu situación:
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "0.75rem" }}>
            {(Object.keys(TIPOS_ESCRITO) as TipoEscritoKey[]).map((key) => {
              const def = TIPOS_ESCRITO[key]
              const isSelected = draft.tipo === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTipoSelect(key)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "0.875rem",
                    borderRadius: "0.75rem",
                    border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--accent)" : "var(--card)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                    <span style={{ fontSize: "1.5rem" }}>{def.icono}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: isSelected ? "var(--primary)" : "var(--fg)" }}>
                      {def.titulo}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
                    {def.subtitulo}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Lugar y Fecha */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>
              ¿Dónde y cuándo se emite el oficio?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "0.75rem" }}>
              <Input
                label="Lugar o Ciudad"
                placeholder="Ej. Morelia, Mich."
                value={draft.ciudad}
                onChange={(e) => onUpdateDraft({ ciudad: e.target.value })}
              />
              <Input
                type="date"
                label="Fecha de emisión"
                value={draft.fecha}
                onChange={(e) => onUpdateDraft({ fecha: e.target.value })}
              />
            </div>
          </div>
        </Card>
      )}

      {/* CONTENIDO DEL PASO 3: HECHOS Y ANTECEDENTES */}
      {step === 3 && (
        <Card padding="1.25rem" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Paso 3: Cuéntanos con tus palabras qué ocurrió
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              No te preocupes por la formalidad ni por palabras técnicas. Describe lo sucedido libremente; la IA ordenará tus notas en un oficio formal impecable.
            </p>
          </div>

          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "0.5rem", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--fg)" }}>
            💡 <strong>Guía para redactar tus hechos:</strong>
            <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem", color: "var(--muted)", lineHeight: 1.5 }}>
              <li><strong>¿Cuándo ocurrió?</strong> Menciona fechas, días o turnos específicos.</li>
              <li><strong>¿Dónde y en qué área?</strong> Tu unidad médica, servicio o clínica de adscripción.</li>
              <li><strong>¿Qué pasó exactamente?</strong> Qué te dijeron, qué ocurrió o qué irregularidad detectaste.</li>
            </ul>
          </div>

          <Textarea
            rows={6}
            placeholder={currentTipoDef.placeholderHechos}
            value={draft.hechos}
            onChange={(e) => onUpdateDraft({ hechos: e.target.value })}
            required
          />

          {/* Plantilla rápida de inicio sugerida */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>¿No sabes cómo empezar?</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                const starter = `Con fecha [indica la fecha], encontrándome en funciones en el servicio de [indica tu servicio], ocurrió lo siguiente: `
                onUpdateDraft({ hechos: draft.hechos ? `${draft.hechos}\n\n${starter}` : starter })
              }}
            >
              ➕ Insertar frase de inicio
            </Button>
          </div>
        </Card>
      )}

      {/* CONTENIDO DEL PASO 4: PETICIÓN CONCRETA */}
      {step === 4 && (
        <Card padding="1.25rem" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Paso 4: ¿Qué necesitas que te resuelvan o autoricen?
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Indica con claridad la solución o respuesta que solicitas a las autoridades o a la representación sindical:
            </p>
          </div>

          <Textarea
            rows={4}
            placeholder={currentTipoDef.placeholderPeticion}
            value={draft.peticion}
            onChange={(e) => onUpdateDraft({ peticion: e.target.value })}
            required
          />

          {/* Ideas frecuentes de peticiones */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
              💡 Ejemplos de peticiones concretas (toca una para usarla):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {[
                "Solicito la autorización de mis vacaciones conforme a la antigüedad correspondiente.",
                "Solicito la aclaración y reintegro del descuento indebido aplicado en mi nómina.",
                "Solicito la intervención sindical para la revisión y solución a la sobrecarga laboral.",
                "Solicito se me otorgue respuesta formal por escrito en apego a mis derechos laborales.",
              ].map((ejemplo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onUpdateDraft({ peticion: ejemplo })}
                  style={{
                    background: "var(--accent)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    padding: "0.375rem 0.625rem",
                    fontSize: "0.75rem",
                    color: "var(--fg)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  &quot;{ejemplo}&quot;
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* CONTENIDO DEL PASO 5: FOTOGRAFÍAS, CCT Y FINALIZAR */}
      {step === 5 && (
        <Card padding="1.25rem" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Paso 5: Evidencias fotográficas y opciones finales
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Puedes adjuntar fotografías de comprobantes o roles de turno (opcional) y activar la fundamentación legal con el CCT:
            </p>
          </div>

          {/* CCT Checkbox */}
          <div style={{ background: "var(--accent)", padding: "0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
            <input
              type="checkbox"
              id="cct-check-guided"
              checked={draft.incluirFundamentos}
              onChange={(e) => onUpdateDraft({ incluirFundamentos: e.target.checked })}
              style={{ width: "1.125rem", height: "1.125rem", marginTop: "0.125rem", accentColor: "var(--primary)" }}
            />
            <label htmlFor="cct-check-guided" style={{ fontSize: "0.8125rem", color: "var(--fg)", cursor: "pointer", lineHeight: 1.4 }}>
              <strong>🛡️ Fundamentar con el Contrato Colectivo de Trabajo (CCT) vigente</strong>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                La Inteligencia Artificial buscará en la base de datos oficial las cláusulas y artículos aplicables a tu solicitud para respaldarla con rigor.
              </div>
            </label>
          </div>

          {/* Anexos de fotos */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
              📷 Fotografías o comprobantes de respaldo (Opcional)
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.875rem",
                borderRadius: "0.5rem",
                border: "2px dashed var(--border)",
                background: "var(--card)",
                cursor: anexoUploading ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--primary)",
                textAlign: "center",
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={anexoUploading}
                style={{ display: "none" }}
              />
              {anexoUploading ? "⏳ Procesando imagen..." : "📎 Adjuntar fotografía o comprobante"}
            </label>

            {draft.anexos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
                {draft.anexos.length >= 2 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                      padding: "0.625rem 0.75rem",
                      background: "var(--card)",
                      borderRadius: "0.5rem",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                        Distribución ({draft.anexos.length} fotos):
                      </span>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          type="button"
                          onClick={() => onUpdateDraft({ anexosLayout: "compact" })}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            borderRadius: "0.375rem",
                            border:
                              (draft.anexosLayout || "compact") === "compact"
                                ? "1px solid var(--primary)"
                                : "1px solid var(--border)",
                            background:
                              (draft.anexosLayout || "compact") === "compact"
                                ? "var(--primary)"
                                : "var(--accent)",
                            color:
                              (draft.anexosLayout || "compact") === "compact"
                                ? "var(--primary-fg)"
                                : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          📄 Varias por hoja
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDraft({ anexosLayout: "individual" })}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            borderRadius: "0.375rem",
                            border:
                              draft.anexosLayout === "individual"
                                ? "1px solid var(--primary)"
                                : "1px solid var(--border)",
                            background:
                              draft.anexosLayout === "individual"
                                ? "var(--primary)"
                                : "var(--accent)",
                            color:
                              draft.anexosLayout === "individual"
                                ? "var(--primary-fg)"
                                : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          📑 Una por hoja
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {(draft.anexosLayout || "compact") === "compact"
                        ? `Se agrupan 2 fotos por página (${Math.ceil(
                            draft.anexos.length / 2
                          )} hoja${Math.ceil(draft.anexos.length / 2) > 1 ? "s" : ""} de anexos).`
                        : `Cada foto ocupa 1 hoja (${draft.anexos.length} hojas de anexos).`}
                    </span>
                  </div>
                )}
                {draft.anexos.map((anexo, idx) => (
                  <div key={anexo.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "var(--accent)", borderRadius: "0.375rem" }}>
                    {anexo.previewUrl && (
                      <img src={anexo.previewUrl} alt={anexo.nombre} style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "0.25rem" }} />
                    )}
                    <span style={{ fontSize: "0.8125rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      Anexo {idx + 1}: {anexo.nombre}
                    </span>
                    <button type="button" onClick={() => removeAnexo(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error de IA si existe */}
          {generationError && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.5rem", padding: "0.875rem", color: "#92400e", fontSize: "0.8125rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div>⚠️ {generationError}. Tus datos están seguros; puedes reintentar o redactar en modo manual.</div>
              {onRetryAI && (
                <div>
                  <Button variant="secondary" size="sm" type="button" onClick={onRetryAI} loading={isGenerating}>
                    🔄 Reintentar con IA
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Botones de acción final de generación */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={() => handleFinalAiSubmit()}
              loading={isGenerating}
              disabled={isGenerating || anexoUploading}
              style={{ minHeight: "50px", fontWeight: 700, fontSize: "1rem" }}
            >
              ✨ Redactar mi escrito formal con IA (Recomendado)
            </Button>

            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={handleFinalManualSubmit}
              disabled={isGenerating || anexoUploading}
              style={{ color: "var(--fg)" }}
            >
              ✍️ Quiero escribirlo manualmente en el editor
            </Button>
          </div>
        </Card>
      )}

      {/* Botones de Navegación de Pasos (Anterior / Siguiente) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={goToPrevStep}
          disabled={step === 1 || isGenerating}
        >
          ⬅ Paso anterior
        </Button>

        <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>
          Paso {step} de 5
        </span>

        {step < 5 ? (
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={goToNextStep}
            disabled={isGenerating}
          >
            Siguiente paso ➡
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => handleFinalAiSubmit()}
            loading={isGenerating}
            disabled={isGenerating}
          >
            ✨ Redactar ahora
          </Button>
        )}
      </div>

      {/* Modal de selección y búsqueda de destinatario */}
      <DestinatarioSelectorModal
        isOpen={isSelectorModalOpen}
        onClose={() => setIsSelectorModalOpen(false)}
        currentDestino={draft.destino}
        onSelectDestino={(d) => {
          onUpdateDraft({ destino: d })
          setStepValidationError(null)
        }}
        initialTab={selectorInitialTab}
      />
    </div>
  )
}
