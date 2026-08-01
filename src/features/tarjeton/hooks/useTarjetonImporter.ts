"use client"

import { useCallback, useRef, useState } from "react"
import type {
  ConfirmTarjetonErrorCode,
  ConfirmTarjetonRequest,
  ConfirmTarjetonResponse,
  ParsedImssTarjeton,
  TarjetonExtractionMethod,
} from "@/shared/contracts/tarjeton-import"
import { loadPdfDocument } from "@/features/tarjeton/lib/pdfjs-client"
import { extractNativePdfText } from "@/features/tarjeton/lib/extract-native-pdf"
import { renderPdfPageToCanvas } from "@/features/tarjeton/lib/render-pdf-page"
import { runOcrFallback } from "@/features/tarjeton/lib/run-ocr-fallback"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { computeFileSha256 } from "@/features/tarjeton/lib/file-hash"
import { markConceptsConfirmedByUser } from "@/features/tarjeton/lib/confirm-mark"
import { confirmTarjetonClient } from "@/features/tarjeton/services/confirm-tarjeton-client"
import { syncConfirmedPayslip } from "@/features/tarjeton/services/payslip-sync"
import { grantPayrollConsent } from "@/shared/services/payroll-consent"

export interface TarjetonProfileSnapshot {
  fullName?: string | null
  matricula?: string | null
  adscripcion?: string | null
  categoria?: string | null
  antiguedad?: string | null
}

export type TarjetonImportErrorCode = ConfirmTarjetonErrorCode | "invalid_file" | "unsupported" | "no_text"

export interface TarjetonImportError {
  code: TarjetonImportErrorCode
  message: string
}

export type TarjetonImportStep = "idle" | "reading" | "review" | "confirming" | "done"

export interface TarjetonImportState {
  step: TarjetonImportStep
  fileName?: string
  fileSize?: number
  pageCount?: number
  method?: TarjetonExtractionMethod
  usedOcr: boolean
  parsed?: ParsedImssTarjeton
  confirmResponse?: ConfirmTarjetonResponse
  error?: TarjetonImportError
  progress: number
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_PAGES = 4
const MIN_NATIVE_TEXT_CHARS = 120

function isPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

async function hashText(text: string): Promise<string> {
  return computeFileSha256(new Blob([text]))
}

export function useTarjetonImporter(profile: TarjetonProfileSnapshot | null) {
  const [state, setState] = useState<TarjetonImportState>({ step: "idle", usedOcr: false, progress: 0 })
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<File | null>(null)
  const requestRef = useRef<ConfirmTarjetonRequest | null>(null)

  const fail = useCallback((error: TarjetonImportError) => {
    setState({ step: "idle", usedOcr: false, progress: 0, error })
  }, [])

  const start = useCallback(async (file: File) => {
    if (!file) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fileRef.current = file

    if (file.size > MAX_FILE_SIZE) {
      fail({ code: "invalid_file", message: "El archivo excede 10 MB. Verifica el tamaño del tarjetón." })
      return
    }

    // Firma %PDF- en los primeros bytes.
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (!isPdfSignature(header)) {
      fail({ code: "invalid_file", message: "El archivo no es un PDF válido." })
      return
    }

    setState({ step: "reading", fileName: file.name, fileSize: file.size, usedOcr: false, progress: 0.05 })

    try {
      const arrayBuffer = await file.arrayBuffer()
      if (controller.signal.aborted) return

      const { pdf, loadingTask } = await loadPdfDocument(arrayBuffer)
      const pageCount = pdf.numPages
      if (pageCount > MAX_PAGES) {
        await loadingTask.destroy()
        fail({ code: "unsupported", message: `El PDF tiene ${pageCount} páginas; el tarjetón tiene un máximo de 4.` })
        return
      }

      // 1. Texto nativo.
      const { items: nativeItems, pageTexts } = await extractNativePdfText(loadingTask, { signal: controller.signal })
      let items = nativeItems
      let usedOcr = false

      const totalChars = pageTexts.join(" ").replace(/\s+/g, "").length

      // 2. OCR de respaldo si el PDF es escaneado.
      if (totalChars < MIN_NATIVE_TEXT_CHARS) {
        if (controller.signal.aborted) return
        const { pdf } = await loadPdfDocument(arrayBuffer)
        const canvases: HTMLCanvasElement[] = []
        for (let p = 1; p <= pageCount; p++) {
          canvases.push(await renderPdfPageToCanvas(pdf, p, { scale: 2, signal: controller.signal }))
        }
        const ocr = await runOcrFallback(canvases, {
          signal: controller.signal,
          onProgress: (p, page, total) => {
            setState((s) => ({ ...s, progress: 0.1 + 0.5 * ((page - 1 + p) / total) }))
          },
        })
        items = ocr.items
        usedOcr = true
        if (controller.signal.aborted) return
      }

      if (items.length === 0) {
        fail({ code: "no_text", message: "No se pudo extraer texto del PDF." })
        return
      }

      setState((s) => ({ ...s, progress: 0.75 }))

      const outcome = await parseImssTarjeton({
        items,
        pageCount,
        hashText,
      })

      if (!outcome.ok) {
        fail({ code: "template_not_detected", message: outcome.message })
        return
      }

      const parsed = outcome.parsed
      parsed.extraction.validations.employeeMatchesProfile =
        profile?.matricula != null && profile.matricula !== "" && parsed.employee.employeeNumber
          ? profile.matricula === parsed.employee.employeeNumber
          : null

      requestRef.current = null
      setState({
        step: "review",
        fileName: file.name,
        fileSize: file.size,
        pageCount,
        method: parsed.extraction.method,
        usedOcr,
        parsed,
        progress: 1,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      console.error("[tarjeton] import fallido:", err)
      fail({ code: "internal", message: "No fue posible leer el archivo. Intenta con otro tarjetón." })
    }
  }, [profile, fail])

  const confirm = useCallback(async (opts: {
    profileUpdates: ConfirmTarjetonRequest["profileUpdates"]
    acknowledgeTotalDifference: boolean
    authorizeServerStorage: boolean
  }) => {
    const parsed = state.parsed
    const file = fileRef.current
    if (!parsed || !file) return
    if (!opts.authorizeServerStorage) return

    await grantPayrollConsent().catch((err) => {
      console.warn("[tarjeton] no se pudo registrar el consentimiento para el prerrelleno:", err)
    })

    const sourceHash = await computeFileSha256(await file.arrayBuffer())
    const request: ConfirmTarjetonRequest = {
      schemaVersion: "1.0",
      sourceHash,
      parsed: markConceptsConfirmedByUser(parsed),
      profileUpdates: opts.profileUpdates,
      acknowledgeTotalDifference: opts.acknowledgeTotalDifference,
    }
    requestRef.current = request

    setState((s) => ({ ...s, step: "confirming" }))
    const result = await confirmTarjetonClient(request)

    if (!result.ok) {
      setState((s) => ({ ...s, step: "review", error: result.error }))
      return
    }

    try {
      syncConfirmedPayslip(result.data, request, "local")
    } catch (err) {
      console.warn("[tarjeton] sincronización local falló:", err)
    }

    setState((s) => ({ ...s, step: "done", confirmResponse: result.data, error: undefined }))
  }, [state.parsed])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    fileRef.current = null
    requestRef.current = null
    setState({ step: "idle", usedOcr: false, progress: 0 })
  }, [])

  return { state, start, confirm, reset }
}
