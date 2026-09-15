"use client"

/**
 * Punto de entrada del módulo de digitalización dentro de Documentos personales.
 *
 * Expone tres acciones y monta el flujo aislado:
 * - Digitalizar documento (guardar en Documentos personales).
 * - Escanear INE (frente + reverso en una hoja).
 * - Escanear para imprimir (copiadora: por defecto no se guarda).
 *
 * La Veinte Digital
 */

import { useState } from "react"
import { CopySimple, IdentificationCard, Scan } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import type { ScanMode } from "@/shared/contracts/document-scan"
import { DocumentScannerFlow, type SavedScanSummary } from "./DocumentScannerFlow"

export interface DocumentScannerLauncherProps {
  userId: string | null
  onSaved?: (document: SavedScanSummary) => void
  onPrintRequest?: (file: File, name: string) => void
  disabled?: boolean
}

interface ActiveFlow {
  mode: ScanMode
  intent: "save" | "print"
}

export function DocumentScannerLauncher({
  userId,
  onSaved,
  onPrintRequest,
  disabled = false,
}: DocumentScannerLauncherProps) {
  const [active, setActive] = useState<ActiveFlow | null>(null)

  const handleSaved = (document: SavedScanSummary) => {
    onSaved?.(document)
  }

  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%" }}>
        <Button
          variant="primary"
          size="md"
          disabled={disabled}
          onClick={() => setActive({ mode: "document", intent: "save" })}
        >
          <Scan size={18} weight="bold" />
          Digitalizar documento
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={disabled}
          onClick={() => setActive({ mode: "ine-front", intent: "save" })}
        >
          <IdentificationCard size={18} weight="bold" />
          Escanear INE
        </Button>
        <Button
          variant="ghost"
          size="md"
          disabled={disabled || !onPrintRequest}
          onClick={() => setActive({ mode: "document", intent: "print" })}
        >
          <CopySimple size={18} weight="bold" />
          Escanear para imprimir
        </Button>
      </div>

      <DocumentScannerFlow
        open={active !== null}
        mode={active?.mode ?? "document"}
        intent={active?.intent ?? "save"}
        userId={userId}
        onClose={() => setActive(null)}
        onSaved={handleSaved}
        onPrintRequest={onPrintRequest}
      />
    </>
  )
}
