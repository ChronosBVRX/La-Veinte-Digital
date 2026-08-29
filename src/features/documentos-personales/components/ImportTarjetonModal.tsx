"use client"

import { useEffect, useRef } from "react"
import { UploadSimple, X } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import {
  useTarjetonImporter,
  type TarjetonProfileSnapshot,
} from "@/features/tarjeton/hooks/useTarjetonImporter"
import { ProgressBar } from "@/features/tarjeton/components/ProgressBar"
import { Review } from "@/features/tarjeton/components/Review"
import { ImportSuccess } from "@/features/tarjeton/components/ImportSuccess"

type Status = "idle" | "reading" | "review" | "confirming" | "done" | "error"

interface ImportTarjetonModalProps {
  open: boolean
  file: File | null
  profile: TarjetonProfileSnapshot | null
  onClose: () => void
}

/**
 * Reutiliza el flujo completo de importación del tarjetón (extracción → revisión
 * → confirmación que actualiza el perfil laboral) sobre un PDF ya descargado.
 */
export function ImportTarjetonModal({ open, file, profile, onClose }: ImportTarjetonModalProps) {
  const { state, start, confirm, reset } = useTarjetonImporter(profile)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      startedRef.current = false
      return
    }
    if (file && state.step === "idle" && !startedRef.current) {
      startedRef.current = true
      void start(file)
    }
  }, [open, file, state.step, start])

  useEffect(() => {
    if (!open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const step: Status = state.step

  const retry = () => {
    if (!file) return
    startedRef.current = true
    void start(file)
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.98)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1100,
        padding: "1.25rem",
        overflow: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "var(--card)",
        borderRadius: "1.25rem",
        width: "100%",
        maxWidth: 560,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        marginTop: "6vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <UploadSimple size={26} weight="duotone" style={{ color: "var(--primary)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: "1rem" }}>Actualizar mi perfil</strong>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              Cargamos tu tarjetón para actualizar categoría, antigüedad, jornada y conceptos.
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0.25rem",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {step === "idle" && state.error && (
          <Card padding="1rem" style={{ borderColor: "var(--error)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                <Badge variant="error">{state.error.code}</Badge>
                <span>{state.error.message}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <Button variant="secondary" size="sm" onClick={() => { startedRef.current = false; reset() }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={retry}>
                  Reintentar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {step === "reading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
            <ProgressBar progress={state.progress} label={state.usedOcr ? "Reconociendo texto (OCR)…" : "Leyendo tarjetón…"} />
            <div style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              {state.fileName} · {state.fileSize ? `${Math.round(state.fileSize / 1024)} KB` : ""}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          </div>
        )}

        {(step === "review" || step === "confirming") && state.parsed && (
          <>
            <Review
              key={`${state.fileName}-${state.parsed.document.periodRaw}`}
              parsed={state.parsed}
              profile={profile}
              confirming={step === "confirming"}
              onConfirm={confirm}
              onCancel={onClose}
            />
            {step === "confirming" && <ProgressBar progress={1} label="Guardando tarjetón…" />}
          </>
        )}

        {step === "done" && state.parsed && state.confirmResponse && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <ImportSuccess parsed={state.parsed} response={state.confirmResponse} onStartOver={onClose} />
          </div>
        )}
      </div>
    </div>
  )
}
