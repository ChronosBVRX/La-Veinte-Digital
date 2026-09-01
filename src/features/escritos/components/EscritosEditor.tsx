"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/shared/components/ui/Button"
import { EscritosProposalModal } from "./EscritosProposalModal"
import { generarEscritoApi } from "../services/generarEscrito"
import type { EscritoDraftV2, GenerarEscritoRequest } from "@/shared/contracts/escrito-draft"

interface EscritosEditorProps {
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onSaveDraft: () => void
  onPreview: () => void
  onBackToForm: () => void
  onRegenerate: () => void
  saving?: boolean
  regenerating?: boolean
}

export function EscritosEditor({
  draft,
  onUpdateDraft,
  onSaveDraft,
  onPreview,
  onBackToForm,
  onRegenerate,
  saving = false,
  regenerating = false,
}: EscritosEditorProps) {
  const [history, setHistory] = useState<string[]>([draft.cuerpo])
  const [historyIdx, setHistoryIdx] = useState(0)

  const [ajustando, setAjustando] = useState<string | null>(null)
  const [propuesta, setPropuesta] = useState<{
    titulo: string
    anterior: string
    propuesto: string
  } | null>(null)

  const wordCount = useMemo(() => {
    const text = draft.cuerpo.trim()
    if (!text) return 0
    return text.split(/\s+/).filter(Boolean).length
  }, [draft.cuerpo])

  const charCount = draft.cuerpo.length

  const handleCuerpoChange = (newText: string) => {
    onUpdateDraft({ cuerpo: newText })
  }

  const pushToHistory = useCallback(
    (newText: string) => {
      const nextHistory = history.slice(0, historyIdx + 1)
      nextHistory.push(newText)
      setHistory(nextHistory)
      setHistoryIdx(nextHistory.length - 1)
      onUpdateDraft({ cuerpo: newText })
    },
    [history, historyIdx, onUpdateDraft]
  )

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1
      setHistoryIdx(prevIdx)
      onUpdateDraft({ cuerpo: history[prevIdx] })
    }
  }

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1
      setHistoryIdx(nextIdx)
      onUpdateDraft({ cuerpo: history[nextIdx] })
    }
  }

  const handleAjusteIA = async (tipoAjuste: "mejorar" | "formal" | "breve" | "fundamentos", titulo: string) => {
    setAjustando(tipoAjuste)
    try {
      const req: GenerarEscritoRequest = {
        tipo: draft.tipo,
        hechos: draft.hechos || draft.cuerpo,
        peticion: draft.peticion,
        destino: draft.destino,
        ciudad: draft.ciudad,
        fecha: draft.fecha,
        asunto: draft.asunto,
        incluirFundamentos: tipoAjuste === "fundamentos" || draft.fuentes.length > 0,
        instruccionAjuste: tipoAjuste,
        cuerpoActual: draft.cuerpo,
      }

      const res = await generarEscritoApi(req)
      if (res.cuerpo && res.cuerpo !== draft.cuerpo) {
        setPropuesta({
          titulo,
          anterior: draft.cuerpo,
          propuesto: res.cuerpo,
        })
      }
    } catch (e) {
      console.error("[EscritosEditor] Error en ajuste con IA:", e)
    } finally {
      setAjustando(null)
    }
  }

  const handleApplyPropuesta = () => {
    if (!propuesta) return
    pushToHistory(propuesta.propuesto)
    setPropuesta(null)
  }

  const handleDiscardPropuesta = () => {
    setPropuesta(null)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Encabezado del Editor */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "var(--accent)",
                  color: "var(--primary)",
                }}
              >
                Paso 2 de 3
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {wordCount} palabras · {charCount} caracteres
              </span>
            </div>
            <h1
              style={{
                fontSize: "clamp(1.2rem, 3.5vw, 1.45rem)",
                fontWeight: 700,
                margin: "0.35rem 0 0",
                color: "var(--fg)",
              }}
            >
              Revisa y modifica tu escrito
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
              Puedes editar directamente cualquier párrafo, añadir nuevos o utilizar las herramientas de asistencia.
            </p>
          </div>

          {/* Deshacer / Rehacer */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIdx <= 0}
              aria-label="Deshacer cambio"
              title="Deshacer último cambio"
            >
              ↩ Deshacer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIdx >= history.length - 1}
              aria-label="Rehacer cambio"
              title="Rehacer cambio"
            >
              ↪ Rehacer
            </Button>
          </div>
        </div>

        {/* Herramientas de Asistencia IA */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            padding: "0.75rem",
            background: "var(--accent)",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            marginBottom: "1rem",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>
            Asistente:
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAjusteIA("mejorar", "Mejorar redacción y fluidez")}
            loading={ajustando === "mejorar"}
            disabled={!!ajustando}
            style={{ fontSize: "0.8125rem", background: "var(--card)" }}
          >
            ✦ Mejorar redacción
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAjusteIA("formal", "Tono más formal e institucional")}
            loading={ajustando === "formal"}
            disabled={!!ajustando}
            style={{ fontSize: "0.8125rem", background: "var(--card)" }}
          >
            📜 Hacer más formal
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAjusteIA("breve", "Sintetizar y hacer más breve")}
            loading={ajustando === "breve"}
            disabled={!!ajustando}
            style={{ fontSize: "0.8125rem", background: "var(--card)" }}
          >
            ✂ Hacer más breve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAjusteIA("fundamentos", "Buscar y agregar fundamento normativo")}
            loading={ajustando === "fundamentos"}
            disabled={!!ajustando}
            style={{ fontSize: "0.8125rem", background: "var(--card)" }}
          >
            ⚖ Agregar fundamento
          </Button>
        </div>

        {/* Área de edición de texto */}
        <div style={{ position: "relative" }}>
          <label
            htmlFor="editor-cuerpo-textarea"
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "0.375rem",
            }}
          >
            Cuerpo del oficio (editable):
          </label>
          <textarea
            id="editor-cuerpo-textarea"
            value={draft.cuerpo}
            onChange={(e) => handleCuerpoChange(e.target.value)}
            rows={14}
            aria-label="Cuerpo redactado del escrito"
            style={{
              width: "100%",
              minHeight: "40dvh",
              padding: "1rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1.5px solid var(--border)",
              background: "var(--bg)",
              color: "var(--fg)",
              fontSize: "1rem",
              fontFamily: "var(--font-serif, 'Times New Roman', Georgia, serif)",
              lineHeight: 1.7,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Barra de navegación y acciones */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onBackToForm}>
              ← Volver a datos
            </Button>
            <Button variant="ghost" onClick={onRegenerate} loading={regenerating}>
              🔄 Regenerar
            </Button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onSaveDraft} loading={saving}>
              💾 Guardar borrador
            </Button>
            <Button variant="primary" onClick={onPreview}>
              Previsualizar oficio →
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Propuesta IA */}
      {propuesta && (
        <EscritosProposalModal
          open={!!propuesta}
          tituloAccion={propuesta.titulo}
          textoAnterior={propuesta.anterior}
          textoPropuesto={propuesta.propuesto}
          onApply={handleApplyPropuesta}
          onDiscard={handleDiscardPropuesta}
        />
      )}
    </div>
  )
}
