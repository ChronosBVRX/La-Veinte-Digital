"use client"

/**
 * Hook orquestador de la sesión de escaneo.
 *
 * - Motor nativo (ML Kit vía `window.LaVeinteApp.scanDocument`) cuando existe.
 * - Páginas web agregadas por el flujo de captura/recorte.
 * - Re-render local de filtro/rotación (JPEG normalizado, sin EXIF).
 *
 * La Veinte Digital
 */

import { useCallback, useMemo, useRef, useState } from "react"
import {
  INE_REQUIRED_PAGES,
  isNativeScanResponse,
  isScannedPagePayload,
  type ScanDocumentKind,
  type ScanFilter,
  type ScanMode,
} from "@/shared/contracts/document-scan"
import { buildInePdf } from "../lib/ine-pdf-builder"
import { buildMultipagePdf, pdfBytesToFile, type PdfPageInput } from "../lib/pdf-builder"
import { renderPageBlob } from "../lib/page-renderer"
import { base64ToBlob } from "../lib/raster"
import {
  createPageId,
  releasePages,
  updatePage,
} from "../lib/scan-pages-state"
import type {
  MoveDirection,
  RotationDegrees,
  ScanEngine,
  ScanPage,
  ScanStatus,
} from "../types/scanner-types"
import { rotateClockwise } from "../types/scanner-types"

export interface NativeScanOutcome {
  ok: boolean
  reason?: string
  cancelled?: boolean
  added: number
}

export interface FinalizedScan {
  file: File
  pageCount: number
  kind: ScanDocumentKind
}

export interface UseDocumentScannerResult {
  status: ScanStatus
  pages: ScanPage[]
  error: string | null
  nativeScannerAvailable: boolean
  nativeScanReason: string | null
  scanWithNative: (mode: ScanMode, pageLimit?: number) => Promise<NativeScanOutcome>
  addWebPage: (page: Omit<ScanPage, "id">, initialFilter?: ScanFilter) => Promise<ScanPage>
  removePage: (id: string) => void
  movePage: (id: string, direction: MoveDirection) => void
  rotatePage: (id: string) => Promise<void>
  setPageFilter: (id: string, filter: ScanFilter) => Promise<void>
  replacePageSource: (id: string, source: Blob, engine: ScanEngine) => Promise<void>
  reset: () => void
  setStatus: (status: ScanStatus) => void
  setError: (message: string | null) => void
  buildDocumentPdf: (title: string) => Promise<FinalizedScan>
  buildIneDocument: (title: string) => Promise<FinalizedScan>
}

const MAX_NATIVE_PAGES_PER_CALL = 10

export function useDocumentScanner(): UseDocumentScannerResult {
  const [pages, setPages] = useState<ScanPage[]>([])
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [nativeScanReason, setNativeScanReason] = useState<string | null>(null)
  const renderTokens = useRef<Map<string, number>>(new Map())

  const nativeScannerAvailable = useMemo(() => {
    if (typeof window === "undefined") return false
    return typeof window.LaVeinteApp?.scanDocument === "function"
  }, [])

  const nextToken = useCallback((id: string) => {
    const token = (renderTokens.current.get(id) ?? 0) + 1
    renderTokens.current.set(id, token)
    return token
  }, [])

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const target = prev.find((page) => page.id === id)
      if (target) releasePages([target])
      return prev.filter((page) => page.id !== id)
    })
  }, [])

  const movePage = useCallback((id: string, direction: MoveDirection) => {
    setPages((prev) => {
      const index = prev.findIndex((page) => page.id === id)
      if (index < 0) return prev
      const target = direction === "up" ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }, [])

  const addWebPage = useCallback(
    async (page: Omit<ScanPage, "id">, initialFilter: ScanFilter = "original"): Promise<ScanPage> => {
      const id = createPageId()
      const source = page.sourceBlob ?? page.blob
      try {
        const rendered = await renderPageBlob(source, initialFilter, 0)
        const full: ScanPage = {
          ...page,
          id,
          blob: rendered.blob,
          previewUrl: URL.createObjectURL(rendered.blob),
          width: rendered.width,
          height: rendered.height,
          filter: initialFilter,
          rotation: 0,
        }
        setPages((prev) => [...prev, full])
        return full
      } catch {
        const fallback: ScanPage = { ...page, id }
        setPages((prev) => [...prev, fallback])
        return fallback
      }
    },
    []
  )

  /**
   * Re-renderiza una página existente con el filtro/rotación indicados.
   * `sourceOverride` evita depender de lectura sincrónica del estado.
   */
  const rerender = useCallback(
    async (page: ScanPage, filter: ScanFilter, rotation: RotationDegrees, sourceOverride?: Blob) => {
      const id = page.id
      const token = nextToken(id)
      const source = sourceOverride ?? page.sourceBlob ?? page.blob
      try {
        const rendered = await renderPageBlob(source, filter, rotation)
        if (renderTokens.current.get(id) !== token) return
        const nextUrl = URL.createObjectURL(rendered.blob)
        setPages((prev) =>
          updatePage(prev, id, {
            blob: rendered.blob,
            previewUrl: nextUrl,
            width: rendered.width,
            height: rendered.height,
          })
        )
        if (page.previewUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(page.previewUrl)
          } catch {
            // ignore
          }
        }
      } catch (renderError) {
        setError(renderError instanceof Error ? renderError.message : "No se pudo aplicar el ajuste.")
      }
    },
    [nextToken]
  )

  const setPageFilter = useCallback(
    async (id: string, filter: ScanFilter) => {
      const page = pages.find((item) => item.id === id)
      if (!page) return
      setPages((prev) => updatePage(prev, id, { filter }))
      await rerender(page, filter, page.rotation)
    },
    [pages, rerender]
  )

  const rotatePage = useCallback(
    async (id: string) => {
      const page = pages.find((item) => item.id === id)
      if (!page) return
      const nextRotation = rotateClockwise(page.rotation)
      setPages((prev) => updatePage(prev, id, { rotation: nextRotation }))
      await rerender(page, page.filter, nextRotation)
    },
    [pages, rerender]
  )

  const replacePageSource = useCallback(
    async (id: string, source: Blob, engine: ScanEngine) => {
      const page = pages.find((item) => item.id === id)
      if (!page) return
      setPages((prev) => updatePage(prev, id, { sourceBlob: source, engine }))
      await rerender(page, page.filter, page.rotation, source)
    },
    [pages, rerender]
  )

  const reset = useCallback(() => {
    setPages((prev) => {
      releasePages(prev)
      return []
    })
    renderTokens.current.clear()
    setStatus("idle")
    setError(null)
    setNativeScanReason(null)
  }, [])

  const scanWithNative = useCallback(
    async (mode: ScanMode, pageLimit?: number): Promise<NativeScanOutcome> => {
      if (typeof window === "undefined" || typeof window.LaVeinteApp?.scanDocument !== "function") {
        return { ok: false, reason: "unsupported", added: 0 }
      }
      setNativeScanReason(null)
      try {
        const raw = await window.LaVeinteApp.scanDocument({
          mode,
          allowGallery: true,
          pageLimit: Math.min(pageLimit ?? MAX_NATIVE_PAGES_PER_CALL, MAX_NATIVE_PAGES_PER_CALL),
        })
        if (!isNativeScanResponse(raw)) {
          return { ok: false, reason: "failed", added: 0 }
        }
        if (!raw.ok) {
          setNativeScanReason(raw.reason ?? "failed")
          return {
            ok: false,
            reason: raw.reason ?? "failed",
            cancelled: raw.reason === "cancelled",
            added: 0,
          }
        }

        const payloads = (raw.pages ?? []).filter(isScannedPagePayload)
        const created: ScanPage[] = []
        for (const payload of payloads) {
          const original = base64ToBlob(payload.base64, payload.mimeType || "image/jpeg")
          let normalized: { blob: Blob; width: number; height: number }
          try {
            normalized = await renderPageBlob(original, "original", 0)
          } catch {
            normalized = { blob: original, width: payload.width, height: payload.height }
          }
          created.push({
            id: createPageId(),
            blob: normalized.blob,
            previewUrl: URL.createObjectURL(normalized.blob),
            width: normalized.width,
            height: normalized.height,
            filter: "original",
            rotation: 0,
            engine: "mlkit",
            sourceBlob: normalized.blob,
          })
        }

        if (created.length === 0) {
          return { ok: false, reason: "failed", added: 0 }
        }

        setPages((prev) => [...prev, ...created])
        return { ok: true, added: created.length }
      } catch (scanError) {
        const reason = scanError instanceof Error ? scanError.message : "failed"
        setNativeScanReason(reason)
        return { ok: false, reason, added: 0 }
      }
    },
    []
  )

  const toPdfInputs = useCallback((list: ScanPage[]): PdfPageInput[] => {
    return list.map((page) => ({ blob: page.blob, width: page.width, height: page.height }))
  }, [])

  const buildDocumentPdf = useCallback(
    async (title: string): Promise<FinalizedScan> => {
      if (pages.length === 0) throw new Error("No hay páginas para guardar.")
      const bytes = await buildMultipagePdf(toPdfInputs(pages), { title })
      const file = pdfBytesToFile(bytes, title)
      return { file, pageCount: pages.length, kind: "documento" }
    },
    [pages, toPdfInputs]
  )

  const buildIneDocument = useCallback(
    async (title: string): Promise<FinalizedScan> => {
      if (pages.length < INE_REQUIRED_PAGES) {
        throw new Error("El INE requiere el frente y el reverso.")
      }
      const front = pages[0]
      const back = pages[1]
      const bytes = await buildInePdf(
        { blob: front.blob, width: front.width, height: front.height },
        { blob: back.blob, width: back.width, height: back.height }
      )
      const file = pdfBytesToFile(bytes, title)
      return { file, pageCount: 1, kind: "ine" }
    },
    [pages]
  )

  return {
    status,
    pages,
    error,
    nativeScannerAvailable,
    nativeScanReason,
    scanWithNative,
    addWebPage,
    removePage,
    movePage,
    rotatePage,
    setPageFilter,
    replacePageSource,
    reset,
    setStatus,
    setError,
    buildDocumentPdf,
    buildIneDocument,
  }
}
