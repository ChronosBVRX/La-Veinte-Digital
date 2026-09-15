"use client"

/**
 * Flujo completo de digitalización (documento normal y INE).
 *
 * Orquesta motor nativo (ML Kit) o web (captura + esquinas manuales),
 * la revisión multipágina y el guardado/impresión reutilizando los servicios
 * existentes (`SendPrintModal` para imprimir; persistencia local/nativa).
 *
 * La Veinte Digital
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { X } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  defaultScanOptions,
  INE_REQUIRED_PAGES,
  sanitizeScanFileName,
  scanDocumentTitle,
  scanKindForMode,
  type ScanDocumentKind,
  type ScanFilter,
  type ScanMode,
} from "@/shared/contracts/document-scan"
import type { DetectedQuad, Quad } from "../types/scanner-types"
import { useDocumentScanner } from "../hooks/useDocumentScanner"
import { WebDocumentScanner, toSourceQuad, type AnalysisImage } from "../services/web-document-scanner"
import {
  persistScannedDocument,
  classifyStorageError,
  type ScanStorageKind,
  type ScanStorageFailure,
} from "../services/scan-persistence"
import { ScanCaptureStep } from "./ScanCaptureStep"
import { ScanCornerEditor } from "./ScanCornerEditor"
import { DocumentScannerReview } from "./DocumentScannerReview"

type Step = "preparing" | "capture" | "corners" | "review"

export interface ScanPrintOptions {
  alsoSaved: boolean
  saveFailure?: ScanStorageFailure | null
}

export interface DocumentScannerFlowProps {
  open: boolean
  mode: ScanMode
  /** "save": guardar en Documentos personales (con opción de imprimir). "print": solo imprimir. */
  intent?: "save" | "print"
  userId: string | null
  onClose: () => void
  onSaved?: (document: SavedScanSummary) => void
  onPrintRequest?: (file: File, name: string, options?: ScanPrintOptions) => void
  onSaveFailed?: (failure: ScanStorageFailure, error?: unknown) => void
}

export interface SavedScanSummary {
  id: string
  kind: ScanDocumentKind
  name: string
  storage: ScanStorageKind
}

export function DocumentScannerFlow({
  open,
  mode,
  intent = "save",
  userId,
  onClose,
  onSaved,
  onPrintRequest,
  onSaveFailed,
}: DocumentScannerFlowProps) {
  const scanner = useDocumentScanner()
  const [step, setStep] = useState<Step>("preparing")
  const [saveToDocuments, setSaveToDocuments] = useState(intent === "save")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisImage | null>(null)
  const [detected, setDetected] = useState<DetectedQuad | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null)
  const [retakePageId, setRetakePageId] = useState<string | null>(null)
  const [ineStage, setIneStage] = useState<"front" | "back">("front")

  const webScannerRef = useRef<WebDocumentScanner | null>(null)
  const startedRef = useRef(false)
  const [editorKey, setEditorKey] = useState(0)

  const { reset, setStatus, setError: setScannerError, scanWithNative, pages } = scanner

  const isIne = mode !== "document"
  const options = defaultScanOptions(mode)

  const closeFlow = useCallback(() => {
    reset()
    setStep("preparing")
    setError(null)
    setAnalysis(null)
    setDetected(null)
    setPendingPhoto(null)
    setRetakePageId(null)
    setIneStage("front")
    startedRef.current = false
    onClose()
  }, [onClose, reset])

  const startNativeCapture = useCallback(
    async (captureMode: ScanMode, replacePageId: string | null = null) => {
      const outcome = await scanWithNative(captureMode, captureMode === "document" ? options.pageLimit : 1)
      if (outcome.ok) return outcome
      if (outcome.reason === "cancelled") return outcome
      // Motor nativo no disponible o con error: se ofrece el flujo web.
      setError(
        outcome.reason === "play_services_unavailable" || outcome.reason === "unsupported"
          ? "El escáner de Google no está disponible en este dispositivo. Usa la cámara o una foto de tu galería."
          : "No se pudo usar el escáner de Google. Usa la cámara o una foto de tu galería."
      )
      setStep("capture")
      void replacePageId
      return outcome
    },
    [options.pageLimit, scanWithNative]
  )

  // Arranque: motor nativo si existe; si no, captura web.
  useEffect(() => {
    if (!open) {
      startedRef.current = false
      reset()
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    setStatus("starting")

    const run = async () => {
      if (!scanner.nativeScannerAvailable) {
        setStep("capture")
        setStatus("capturing")
        return
      }
      const first = await startNativeCapture(isIne ? "ine-front" : "document")
      if (!first.ok) {
        if (first.reason === "cancelled") closeFlow()
        return
      }
      if (isIne) {
        const second = await startNativeCapture("ine-back")
        if (!second.ok) {
          if (second.reason !== "cancelled") return
          // Reverso cancelado: se conserva el frente y se pide el reverso por cámara.
          setIneStage("back")
          setStatus("capturing")
          setStep("capture")
          return
        }
      }
      setStep("review")
      setStatus("review")
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arranque único por apertura
  }, [open])

  const handlePhotoCaptured = useCallback(
    async (blob: Blob) => {
      setBusy(true)
      setError(null)
      setScannerError(null)
      try {
        const webScanner = webScannerRef.current ?? new WebDocumentScanner()
        webScannerRef.current = webScanner
        const createdAnalysis = await webScanner.createAnalysis(blob)
        const found = await webScanner.detectCorners(createdAnalysis.raster)
        setAnalysis(createdAnalysis)
        setDetected(found)
        setPendingPhoto(blob)
        setStep("corners")
      } catch (captureError) {
        setError(
          captureError instanceof Error
            ? captureError.message
            : "No se pudo procesar la foto. Inténtalo de nuevo."
        )
      } finally {
        setBusy(false)
      }
    },
    [setScannerError]
  )

  const handleRedetect = useCallback(async () => {
    if (!analysis || !webScannerRef.current) return
    setBusy(true)
    try {
      const found = await webScannerRef.current.detectCorners(analysis.raster, { retryOpenCv: true })
      setDetected(found)
      setEditorKey((key) => key + 1)
    } finally {
      setBusy(false)
    }
  }, [analysis])

  const finalizeCapture = useCallback(
    async (corners: Quad) => {
      if (!analysis || !pendingPhoto) return
      setBusy(true)
      setError(null)
      try {
        const webScanner = webScannerRef.current ?? new WebDocumentScanner()
        webScannerRef.current = webScanner
        const sourceQuad = toSourceQuad(corners, analysis)
        const source = await webScanner.extractSource({
          source: pendingPhoto,
          corners: sourceQuad,
        })

        if (retakePageId) {
          await scanner.replacePageSource(retakePageId, source.blob, "web")
          setRetakePageId(null)
        } else {
          await scanner.addWebPage(
            {
              blob: source.blob,
              previewUrl: "",
              width: source.width,
              height: source.height,
              filter: options.filter ?? "enhanced",
              rotation: 0,
              engine: "web",
              sourceBlob: source.blob,
              corners: sourceQuad,
            },
            options.filter ?? "enhanced"
          )
        }

        setAnalysis(null)
        setDetected(null)
        setPendingPhoto(null)

        const nextCount = retakePageId ? pages.length : pages.length + 1
        if (isIne && !retakePageId && nextCount < INE_REQUIRED_PAGES) {
          setIneStage("back")
          setStep("capture")
          setStatus("capturing")
          return
        }
        setStep("review")
        setStatus("review")
      } catch (captureError) {
        setError(
          captureError instanceof Error
            ? captureError.message
            : "No se pudo recortar el documento. Inténtalo de nuevo."
        )
      } finally {
        setBusy(false)
      }
    },
    [analysis, isIne, options.filter, pages.length, pendingPhoto, retakePageId, scanner, setStatus]
  )

  const handleAddPage = useCallback(async () => {
    setRetakePageId(null)
    if (scanner.nativeScannerAvailable) {
      const outcome = await startNativeCapture("document")
      if (outcome.ok) {
        setStep("review")
      }
      return
    }
    scanner.setStatus("capturing")
    setStep("capture")
  }, [scanner, startNativeCapture])

  const handleRetake = useCallback(
    (id: string) => {
      setRetakePageId(id)
      setIneStage(pages.findIndex((page) => page.id === id) === 0 ? "front" : "back")
      setError(null)
      scanner.setStatus("capturing")
      setStep("capture")
    },
    [pages, scanner]
  )

  const handleConfirm = useCallback(async () => {
    if (!userId && (intent === "save" || saveToDocuments)) {
      setError("Inicia sesión para guardar tus documentos digitalizados.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const kind = scanKindForMode(mode)
      const title = sanitizeScanFileName(scanDocumentTitle(kind)).replace(/\.pdf$/i, "")
      const finalized = isIne
        ? await scanner.buildIneDocument(title)
        : await scanner.buildDocumentPdf(title)

      let savedSummary: SavedScanSummary | null = null
      let saveFailure: ScanStorageFailure | null = null

      if (saveToDocuments) {
        try {
          const effectiveUserId = userId || "anonymous"
          const result = await persistScannedDocument({
            userId: effectiveUserId,
            kind: finalized.kind,
            name: finalized.file.name,
            pdfFile: finalized.file,
            pageCount: finalized.pageCount,
          })
          if (result.ok) {
            savedSummary = {
              id: result.id,
              kind: finalized.kind,
              name: finalized.file.name,
              storage: result.storage,
            }
          } else {
            saveFailure = result.failure || "unknown"
            onSaveFailed?.(saveFailure)
            console.warn("[DocumentScannerFlow] Guardado opcional falló (no fatal):", result)
            if (intent === "save") {
              throw new Error(
                result.failure === "quota_exceeded"
                  ? "No hay suficiente espacio disponible en este dispositivo para guardar el documento."
                  : "No se pudo guardar el documento en el dispositivo."
              )
            }
          }
        } catch (saveError) {
          saveFailure = classifyStorageError(saveError)
          onSaveFailed?.(saveFailure, saveError)
          if (intent === "save") {
            if (saveFailure === "quota_exceeded") {
              throw new Error("No hay suficiente espacio disponible en este dispositivo para guardar el documento.")
            }
            throw saveError
          }
          console.warn("[DocumentScannerFlow] Error al guardar copia opcional:", saveError)
        }
      }

      if (savedSummary && onSaved) {
        onSaved(savedSummary)
      }

      if (intent === "print") {
        if (!onPrintRequest) {
          throw new Error("La impresión no está disponible en este momento.")
        }
        closeFlow()
        onPrintRequest(finalized.file, finalized.file.name, {
          alsoSaved: Boolean(savedSummary),
          saveFailure,
        })
      } else {
        if (!saveToDocuments) {
          if (!onPrintRequest) {
            throw new Error("La impresión no está disponible en este momento.")
          }
          closeFlow()
          onPrintRequest(finalized.file, finalized.file.name, {
            alsoSaved: false,
            saveFailure: null,
          })
        } else {
          scanner.setStatus("saved")
          closeFlow()
        }
      }
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "No se pudo generar el PDF del documento."
      )
    } finally {
      setBusy(false)
    }
  }, [closeFlow, intent, isIne, mode, onPrintRequest, onSaveFailed, onSaved, saveToDocuments, scanner, userId])

  if (!open) return null

  const showSpinner = step === "preparing" && !error

  return (
    <FullscreenPortal open={open} onClose={closeFlow} ariaLabel="Digitalizar documento">
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "var(--bg)",
          color: "var(--fg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "max(0.75rem, env(safe-area-inset-top, 0px)) 1rem 0.75rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              {isIne ? "Escanear INE" : intent === "print" ? "Escanear para imprimir" : "Digitalizar documento"}
            </h1>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {intent === "print"
                ? "Se enviará por QR; por defecto no se guarda en el dispositivo."
                : "El documento nunca sale de tu dispositivo."}
            </span>
          </div>
          <button
            type="button"
            onClick={closeFlow}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "var(--fg)",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        <main
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "560px",
            margin: "0 auto",
            padding: "1rem 1rem max(1.25rem, env(safe-area-inset-bottom, 0px))",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          {showSpinner && (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
              <LoadingSpinner text="Abriendo el escáner…" />
            </div>
          )}

          {step === "capture" && (
            <ScanCaptureStep
              title={
                isIne
                  ? ineStage === "front"
                    ? "Escanea el frente del INE"
                    : "Escanea el reverso del INE"
                  : "Escanea el documento"
              }
              hint={
                isIne
                  ? "Apoya el INE en una superficie plana. Después escanearás el reverso."
                  : "Puedes capturar varias páginas; las revisarás antes de guardar."
              }
              busy={busy}
              error={error}
              onCapture={(blob) => void handlePhotoCaptured(blob)}
              onCancel={closeFlow}
            />
          )}

          {step === "corners" && analysis && (
            <ScanCornerEditor
              key={editorKey}
              analysis={analysis}
              detected={detected}
              busy={busy}
              onCancel={() => {
                setAnalysis(null)
                setDetected(null)
                setPendingPhoto(null)
                setRetakePageId(null)
                setStep("capture")
              }}
              onConfirm={(corners) => void finalizeCapture(corners)}
              onRedetect={() => void handleRedetect()}
            />
          )}

          {step === "review" && (
            <DocumentScannerReview
              mode={mode}
              intent={intent}
              pages={pages}
              busy={busy}
              error={error}
              saveToDocuments={saveToDocuments}
              nativeEngine={pages.some((page) => page.engine === "mlkit")}
              onToggleSave={setSaveToDocuments}
              onChangeFilter={(id, filter: ScanFilter) => void scanner.setPageFilter(id, filter)}
              onRotate={(id) => void scanner.rotatePage(id)}
              onRemove={scanner.removePage}
              onMove={scanner.movePage}
              onAddPage={() => void handleAddPage()}
              onRetake={handleRetake}
              onCancel={closeFlow}
              onConfirm={() => void handleConfirm()}
            />
          )}

          {step === "preparing" && !showSpinner && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>{error}</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button variant="primary" size="md" onClick={() => setStep("capture")}>
                  Usar la cámara
                </Button>
                <Button variant="secondary" size="md" onClick={closeFlow}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </FullscreenPortal>
  )
}
