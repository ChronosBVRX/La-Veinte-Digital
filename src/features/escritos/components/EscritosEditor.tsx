"use client"

import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { useEscritoEditorHistory } from "../hooks/useEscritoEditorHistory"
import { EscritosProposalModal } from "./EscritosProposalModal"
import { generarEscrito } from "../services/generarEscrito"
import { DestinatarioResumen } from "./DestinatarioResumen"

export interface EscritosEditorProps {
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onSaveDraft: () => void
  onGoToPreview: () => void
  onBackToForm: () => void
}

export function EscritosEditor({
  draft,
  onUpdateDraft,
  onSaveDraft,
  onGoToPreview,
  onBackToForm,
}: EscritosEditorProps) {
  const {
    text,
    setText,
    pushImmediateSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    handleKeyDown,
  } = useEscritoEditorHistory(draft.cuerpo, draft.id)

  const [aiLoadingAction, setAiLoadingAction] = useState<string | null>(null)
  const [proposal, setProposal] = useState<{
    title: string
    description: string
    newText: string
    fuentes?: typeof draft.fuentes
    generationMode?: typeof draft.generationMode
    advertencias?: string[]
  } | null>(null)

  // Sincronizar el texto del editor con el draft global cuando cambia
  useEffect(() => {
    onUpdateDraft({ cuerpo: text })
  }, [text, onUpdateDraft])

  // Contadores
  const charCount = text.length
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  // Herramientas de IA asistida no destructiva
  const handleAiTool = async (
    actionName: string,
    title: string,
    description: string,
    instruccionAjuste: string
  ) => {
    setAiLoadingAction(actionName)
    try {
      const res = await generarEscrito({
        mode: "revise",
        tipo: draft.tipo,
        hechos: draft.hechos,
        peticion: draft.peticion,
        destino: draft.destino,
        ciudad: draft.ciudad,
        fecha: draft.fecha,
        asunto: draft.asunto,
        incluirFundamentos: draft.incluirFundamentos,
        cuerpoActual: text,
        instruccionAjuste,
      })

      if (res.cuerpo && res.cuerpo !== text) {
        setProposal({
          title,
          description,
          newText: res.cuerpo,
          fuentes: res.fuentes,
          generationMode: res.generationMode,
          advertencias: res.advertencias,
        })
      }
    } catch (err) {
      console.error("Error aplicando herramienta de IA:", err)
      alert("No se pudo procesar el ajuste de IA. Intenta nuevamente.")
    } finally {
      setAiLoadingAction(null)
    }
  }

  const handleAcceptProposal = () => {
    if (!proposal) return
    pushImmediateSnapshot(proposal.newText)
    onUpdateDraft({
      cuerpo: proposal.newText,
      fuentes: proposal.fuentes ?? draft.fuentes,
      generationMode: proposal.generationMode ?? draft.generationMode,
      advertencias: proposal.advertencias ?? draft.advertencias,
    })
    setProposal(null)
  }

  const handleDiscardProposal = () => {
    setProposal(null)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Visor Compacto del Destinatario */}
      <DestinatarioResumen
        destino={draft.destino}
        onChangeRequest={onBackToForm}
      />

      {/* Indicador discreto de modo de redacción */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.25rem 0.625rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            background:
              draft.generationMode === "ai_with_sources"
                ? "#ecfdf5"
                : draft.generationMode === "ai_without_sources"
                ? "#eff6ff"
                : "var(--accent)",
            color:
              draft.generationMode === "ai_with_sources"
                ? "#065f46"
                : draft.generationMode === "ai_without_sources"
                ? "#1d4ed8"
                : "var(--muted)",
            border: `1px solid ${
              draft.generationMode === "ai_with_sources"
                ? "#a7f3d0"
                : draft.generationMode === "ai_without_sources"
                ? "#bfdbfe"
                : "var(--border)"
            }`,
          }}
        >
          {draft.generationMode === "ai_with_sources" ? (
            <>🛡️ Redactado con IA y fuentes verificadas</>
          ) : draft.generationMode === "ai_without_sources" ? (
            <>✨ Redactado con IA</>
          ) : (
            <>✏️ Modo manual</>
          )}
        </div>

        {draft.generationMode === "ai_with_sources" && draft.fuentes.length > 0 && (
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {draft.fuentes.length} {draft.fuentes.length === 1 ? "norma citada" : "normas citadas"}
          </span>
        )}
      </div>

      {/* Cabecera del Editor con Undo/Redo y Estadísticas */}
      <Card padding="1rem" style={{ background: "var(--card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              ✏️ Revisa y personaliza tu escrito
            </h3>
            <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
              Puedes editar párrafos directamente. Usa los atajos <code>Ctrl+Z</code> y <code>Ctrl+Y</code> para deshacer o rehacer.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginRight: "0.5rem" }}>
              {wordCount} palabras • {charCount} caracteres
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              title="Deshacer (Ctrl+Z)"
            >
              ↩ Deshacer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              title="Rehacer (Ctrl+Y)"
            >
              ↪ Rehacer
            </Button>
          </div>
        </div>
      </Card>

      {/* Herramientas de IA no destructivas */}
      <div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
          ✨ Asistente de redacción (propuestas con vista previa):
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              handleAiTool(
                "ortografia",
                "Corregir ortografía y redacción",
                "Revisa la sintaxis, acentuación y coherencia sin cambiar el sentido.",
                "Corrige errores gramaticales, puntuación y concordancia sin modificar los hechos ni la petición."
              )
            }
            loading={aiLoadingAction === "ortografia"}
            disabled={!!aiLoadingAction}
          >
            🔤 Corregir ortografía
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              handleAiTool(
                "formal",
                "Hacer más formal",
                "Eleva el registro a un tono institucional respetuoso y solemne.",
                "Eleva el registro del texto para que suene más formal, respetuoso e institucional."
              )
            }
            loading={aiLoadingAction === "formal"}
            disabled={!!aiLoadingAction}
          >
            👔 Tono más formal
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              handleAiTool(
                "resumir",
                "Resumir escrito",
                "Sintetiza la exposición manteniendo íntegros los puntos clave.",
                "Sintetiza la exposición de hechos y petición a lo esencial sin omitir detalles cruciales."
              )
            }
            loading={aiLoadingAction === "resumir"}
            disabled={!!aiLoadingAction}
          >
            ✂️ Resumir
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              handleAiTool(
                "expandir",
                "Expandir antecedentes",
                "Detalla la cronología y circunstancias de los hechos.",
                "Detalla y estructura de forma más minuciosa los antecedentes y circunstancias expuestas."
              )
            }
            loading={aiLoadingAction === "expandir"}
            disabled={!!aiLoadingAction}
          >
            📝 Detallar antecedentes
          </Button>
        </div>
      </div>

      {/* Área principal de texto enriquecido */}
      <div style={{ position: "relative" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={14}
          style={{
            width: "100%",
            padding: "1rem",
            borderRadius: "0.75rem",
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--fg)",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
          placeholder="Escribe o edita el cuerpo de tu escrito..."
        />
      </div>

      {/* Modal de Propuesta Visual (Diff) */}
      {proposal && (
        <EscritosProposalModal
          isOpen={true}
          title={proposal.title}
          description={proposal.description}
          originalText={text}
          proposedText={proposal.newText}
          onAccept={handleAcceptProposal}
          onDiscard={handleDiscardProposal}
        />
      )}

      {/* Barra de Acciones Inferior */}
      <div
        style={{
          position: "sticky",
          bottom: "1rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "0.875rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          zIndex: 10,
        }}
      >
        <Button variant="ghost" size="sm" onClick={onBackToForm}>
          ⬅ Volver al formulario
        </Button>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="secondary" size="md" onClick={onSaveDraft}>
            💾 Guardar borrador
          </Button>
          <Button variant="primary" size="md" onClick={onGoToPreview}>
            👁 Ver vista previa y firmar ➡
          </Button>
        </div>
      </div>
    </div>
  )
}
