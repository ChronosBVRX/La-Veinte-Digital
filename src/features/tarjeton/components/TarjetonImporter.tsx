"use client"

import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { useTarjetonImporter } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Badge } from "@/shared/components/ui/Badge"
import { Dropzone } from "./Dropzone"
import { ProgressBar } from "./ProgressBar"
import { Review } from "./Review"
import { ImportSuccess } from "./ImportSuccess"

interface TarjetonImporterProps {
  profile: TarjetonProfileSnapshot | null
}

export function TarjetonImporter({ profile }: TarjetonImporterProps) {
  const { state, start, confirm, reset } = useTarjetonImporter(profile)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card padding="1.5rem" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>Importar tarjetón IMSS</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
            Sube el PDF de tu recibo de pago del IMSS. Los datos se extraen en tu dispositivo: el archivo nunca sale de tu equipo.
          </p>
        </div>

        {state.step === "idle" && <Dropzone onFile={start} />}

        {state.step === "reading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
            <ProgressBar progress={state.progress} label={state.usedOcr ? "Reconociendo texto (OCR)…" : "Leyendo tarjetón…"} />
            <div style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
              {state.fileName} · {state.fileSize ? `${Math.round(state.fileSize / 1024)} KB` : ""}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
          </div>
        )}

        {state.error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Card padding="1rem" style={{ borderColor: "var(--error)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                <Badge variant="error">{state.error.code}</Badge>
                <span>{state.error.message}</span>
              </div>
            </Card>
            {state.step === "idle" && <Dropzone onFile={start} />}
          </div>
        )}

        {(state.step === "review" || state.step === "confirming") && state.parsed && (
          <>
            <Review
              key={`${state.fileName}-${state.parsed.document.periodRaw}`}
              parsed={state.parsed}
              profile={profile}
              confirming={state.step === "confirming"}
              onConfirm={confirm}
              onCancel={reset}
            />
            {state.step === "confirming" && (
              <ProgressBar progress={1} label="Guardando tarjetón…" />
            )}
          </>
        )}

        {state.step === "done" && state.parsed && state.confirmResponse && (
          <ImportSuccess parsed={state.parsed} response={state.confirmResponse} onStartOver={reset} />
        )}
      </Card>

      <Card padding="1rem" style={{ background: "var(--accent)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          <div><strong>Privacidad:</strong> el PDF se lee con PDF.js/OCR en tu navegador y nunca se sube al servidor.</div>
          <div><strong>Seguridad:</strong> solo se guardan los datos estructurados del recibo; RFC, CURP, NSS, cuenta y folio fiscal se descartan o se guardan como huella.</div>
          <div><strong>Revisión:</strong> antes de confirmar podrás revisar cada campo extraído y autorizar cambios en tu perfil.</div>
        </div>
      </Card>
    </div>
  )
}
