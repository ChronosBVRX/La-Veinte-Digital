"use client"

import { useEffect, useCallback } from "react"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { useTarjetonImporter } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { mapParsedPayslipToWorkerProfileDraft } from "./payslip-adapter"
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { WorkerProfileDraft } from "@/shared/domain/worker"

interface TarjetonImportStepProps {
  onParsed: (draft: WorkerProfileDraft, parsed: ParsedImssTarjeton) => void
  onBack: () => void
}

export function TarjetonImportStep({ onParsed, onBack }: TarjetonImportStepProps) {
  const importer = useTarjetonImporter(null)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) importer.start(file)
  }, [importer])

  // Cuando termina la extracción, mapear a draft y avanzar
  useEffect(() => {
    if (importer.state.step === "review" && importer.state.parsed) {
      const result = mapParsedPayslipToWorkerProfileDraft(importer.state.parsed)
      onParsed(result.draft, importer.state.parsed)
    }
  }, [importer.state.step, importer.state.parsed, onParsed])

  if (importer.state.step === "reading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
        <LoadingSpinner text="Procesando tu tarjetón..." />
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          El archivo se procesa en tu dispositivo y no se envía a ningún servidor.
        </p>
        <div style={{ width: "100%", maxWidth: "300px", height: "6px", background: "var(--accent)", borderRadius: "3px" }}>
          <div style={{ height: "100%", width: `${Math.round(importer.state.progress * 100)}%`, background: "var(--primary)", borderRadius: "3px", transition: "width 0.3s" }} />
        </div>
      </div>
    )
  }

  if (importer.state.error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.75rem", borderRadius: "0.375rem" }}>
          {importer.state.error.code === "invalid_file" && "El archivo no es un PDF válido."}
          {importer.state.error.code === "unsupported" && "El archivo tiene demasiadas páginas."}
          {importer.state.error.code === "no_text" && "No se pudo extraer texto del PDF."}
          {importer.state.error.code === "template_not_detected" && "El archivo no parece un tarjetón del IMSS."}
          {!["invalid_file", "unsupported", "no_text", "template_not_detected"].includes(importer.state.error.code) &&
            "No se pudo leer el archivo. Intenta con otro tarjetón."}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="secondary" onClick={onBack}>←</Button>
          <Button onClick={() => importer.reset()}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Importa tu tarjetón</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
        Selecciona el archivo PDF de tu último recibo de nómina del IMSS.
        El archivo PDF se procesa en tu dispositivo y no se conserva.
        Solo se guardarán los datos estructurados que revises, selecciones y confirmes.
      </p>
      <div style={{
        border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: "2rem",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
        background: "var(--accent)",
      }}>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>Arrastra tu PDF aquí o selecciónalo</p>
        <label style={{
          background: "var(--primary)", color: "var(--primary-fg)", padding: "0.5rem 1rem",
          borderRadius: "0.25rem", fontSize: "0.875rem", cursor: "pointer", fontWeight: 500,
        }}>
          Seleccionar archivo
          <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>Máximo 4 páginas, 10 MB</p>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onBack}>←</Button>
        <div />
      </div>
    </div>
  )
}
