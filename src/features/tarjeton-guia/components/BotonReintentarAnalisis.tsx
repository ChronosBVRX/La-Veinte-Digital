"use client"

import { useRef, useState } from "react"
import { ArrowsClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { getTarjetonPdfBlob, saveTarjetonPdfBlob } from "@/shared/services/tarjeton-blob-storage"
import { getPayslips, savePayslip } from "@/shared/services/local-storage"
import { loadPdfDocument } from "@/features/tarjeton/lib/pdfjs-client"
import { extractNativePdfText } from "@/features/tarjeton/lib/extract-native-pdf"
import { runOcrFallback } from "@/features/tarjeton/lib/run-ocr-fallback"
import { renderPdfPageToCanvas } from "@/features/tarjeton/lib/render-pdf-page"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { buildImssLayoutRegions } from "@/features/tarjeton/lib/imss-layout-regions"
import { getPayPeriod } from "@/features/nomina/lib/periods"
import { institutionalToday } from "@/shared/lib/dates"
import type { ImportedPayslip } from "@/features/nomina/lib/types"

interface BotonReintentarAnalisisProps {
  periodRaw?: string
  documentId?: string
  sourceUri?: string
  size?: "sm" | "md"
  variant?: "primary" | "secondary" | "ghost"
  onCompleted?: (result: { earnings: number; deductions: number; netPay?: number }) => void
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

export function BotonReintentarAnalisis({
  periodRaw,
  documentId,
  sourceUri,
  size = "sm",
  variant = "secondary",
  onCompleted,
}: BotonReintentarAnalisisProps) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const processBytes = async (sourceBytes: Uint8Array, fileName = "tarjeton.pdf") => {
    setLoading(true)
    setError(null)
    setFeedback("Analizando tarjetón...")

    let pageCount = 0
    let textItemsCount = 0
    let candidateRowsCount = 0
    let perceptionsCount = 0
    let deductionsCount = 0

    try {
      // 1. Validar encabezado PDF
      const header = new TextDecoder().decode(sourceBytes.slice(0, 5))
      if (!header.startsWith("%PDF")) {
        throw new Error("El archivo recuperado no tiene un encabezado PDF válido.")
      }

      // 2. Cargar con PDF.js
      const { pdf, loadingTask } = await loadPdfDocument(sourceBytes.slice().buffer)
      pageCount = pdf.numPages

      // 3. Extraer texto nativo
      const { items: initialItems, pageTexts } = await extractNativePdfText(loadingTask)
      let items = initialItems
      textItemsCount = items.length

      // Imprimir muestra anonimizada de getTextContent en desarrollo
      if (process.env.NODE_ENV !== "production" && items.length > 0) {
        console.debug(
          "[BotonReintentarAnalisis] Muestra de items posicionales:",
          items.slice(0, 8).map((it) => ({
            text: it.text.replace(/\d{6,}/g, "******"),
            x: Math.round(it.x),
            y: Math.round(it.y),
            width: Math.round(it.width),
            page: it.page,
          }))
        )
      }

      const layout = buildImssLayoutRegions(items)
      candidateRowsCount = layout.lines.length

      // Si no hay texto nativo suficiente o la tabla está vacía, aplicar OCR a la primera página
      const totalChars = pageTexts.join(" ").replace(/\s+/g, "").length
      if (totalChars < 100 || (layout.earningsLines.length <= 1 && layout.deductionLines.length <= 1)) {
        try {
          const canvases: HTMLCanvasElement[] = []
          for (let p = 1; p <= pageCount; p++) {
            const canvas = await renderPdfPageToCanvas(pdf, p)
            canvases.push(canvas)
          }
          const ocrResult = await runOcrFallback(canvases)
          if (ocrResult.items.length > items.length) {
            items = ocrResult.items
            textItemsCount = items.length
          }
        } catch (ocrErr) {
          console.warn("[BotonReintentarAnalisis] OCR fallback omitido o fallido:", ocrErr)
        }
      }

      // 4. Parser completo
      const outcome = await parseImssTarjeton({
        items,
        pageCount,
        hashText: async (text) => `hash:${text.length}`,
      })

      if (!outcome.ok) {
        setError(outcome.message || "No se pudo interpretar el tarjetón.")
        setLoading(false)
        return
      }

      const parsed = outcome.parsed
      perceptionsCount = parsed.payroll.earnings.length
      deductionsCount = parsed.payroll.deductions.length
      const targetPeriodRaw = parsed.document.periodRaw || periodRaw || ""

      // 5. Guardar copia en IndexedDB
      if (targetPeriodRaw) {
        try {
          const blob = new Blob([sourceBytes.buffer as ArrayBuffer], { type: "application/pdf" })
          await saveTarjetonPdfBlob(targetPeriodRaw, blob, fileName)
        } catch (storageErr) {
          console.warn("[BotonReintentarAnalisis] Error guardando blob en IndexedDB:", storageErr)
        }
      }

      // 6. Actualizar registro en localStorage en sitio
      const currentSlips = getPayslips()
      const existingSlip = currentSlips.find((s) => {
        if (documentId && s.id === documentId) return true
        const sPeriod = typeof s.period === "string" ? s.period : s.period?.id || s.period?.label || s.periodRaw || ""
        return targetPeriodRaw && sPeriod.includes(targetPeriodRaw)
      })

      const fallbackEarnings = parsed.payroll.earnings.reduce((s, l) => s + l.amount, 0)
      const fallbackDeductions = Math.abs(parsed.payroll.deductions.reduce((s, l) => s + l.amount, 0))

      const period =
        parsed.document.year && parsed.document.month && parsed.document.half
          ? getPayPeriod(parsed.document.year, parsed.document.month, parsed.document.half)
          : existingSlip?.period || getPayPeriod(institutionalToday().getFullYear(), institutionalToday().getMonth() + 1, 1)

      const earningsLines = parsed.payroll.earnings.map((l) => ({
        code: l.code || "",
        description: l.description,
        amount: l.amount,
        confirmedByUser: true,
        includeInNextProjection: true,
      }))
      const deductionsLines = parsed.payroll.deductions.map((l) => ({
        code: l.code || "",
        description: l.description,
        amount: l.amount,
        confirmedByUser: true,
        includeInNextProjection: true,
      }))

      const updatedSlip: ImportedPayslip = {
        id: existingSlip?.id || documentId || crypto.randomUUID(),
        userId: existingSlip?.userId || "local",
        period,
        periodRaw: targetPeriodRaw || existingSlip?.periodRaw,
        categoryName: parsed.employee.categoryName || existingSlip?.categoryName,
        institutionalEntryDate: parsed.employee.entryDate || existingSlip?.institutionalEntryDate,
        earnings: earningsLines,
        deductions: deductionsLines,
        perceptions: earningsLines,
        totalEarnings: parsed.payroll.totalEarnings ?? fallbackEarnings,
        totalDeductions: parsed.payroll.totalDeductions ?? fallbackDeductions,
        netPay: parsed.payroll.netPay ?? fallbackEarnings - fallbackDeductions,
        netAmount: parsed.payroll.netPay ?? fallbackEarnings - fallbackDeductions,
        source: "pdf",
        confirmedByUser: true,
      }

      savePayslip(updatedSlip)

      // Verificar persistencia real
      const persistedSlips = getPayslips()
      const verified = persistedSlips.some((s) => s.id === updatedSlip.id && s.earnings.length > 0)

      // Telemetría obligatoria de desarrollo
      if (process.env.NODE_ENV !== "production") {
        console.info("[ReintentarAnalisis] Telemetry:", {
          handlerCalled: true,
          documentId: documentId ?? updatedSlip.id,
          sourceUriPresent: Boolean(sourceUri),
          originalBlobPresent: true,
          byteLength: sourceBytes.byteLength,
          pdfPages: pageCount,
          textItems: textItemsCount,
          candidateRows: candidateRowsCount,
          perceptionsParsed: perceptionsCount,
          deductionsParsed: deductionsCount,
          persistenceSucceeded: verified,
        })
      }

      setFeedback(
        `¡Análisis exitoso! ${perceptionsCount} percepciones y ${deductionsCount} deducciones recuperadas.`
      )

      if (onCompleted) {
        onCompleted({
          earnings: perceptionsCount,
          deductions: deductionsCount,
          netPay: parsed.payroll.netPay,
        })
      }
    } catch (err) {
      console.error("[BotonReintentarAnalisis] error al reprocesar:", err)
      setError("Ocurrió un problema al leer el archivo. Intenta seleccionarlo nuevamente.")

      if (process.env.NODE_ENV !== "production") {
        console.info("[ReintentarAnalisis] Telemetry:", {
          handlerCalled: true,
          documentId: documentId ?? null,
          sourceUriPresent: Boolean(sourceUri),
          originalBlobPresent: sourceBytes.byteLength > 0,
          byteLength: sourceBytes.byteLength,
          pdfPages: pageCount,
          textItems: textItemsCount,
          candidateRows: candidateRowsCount,
          perceptionsParsed: perceptionsCount,
          deductionsParsed: deductionsCount,
          persistenceSucceeded: false,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRetryClick = async () => {
    setError(null)
    setFeedback(null)

    // 1. Intentar recuperar desde IndexedDB
    if (periodRaw) {
      try {
        const storedFile = await getTarjetonPdfBlob(periodRaw)
        if (storedFile && storedFile.size > 0) {
          const bytes = new Uint8Array(await storedFile.arrayBuffer())
          await processBytes(bytes, storedFile.name)
          return
        }
      } catch (idbErr) {
        console.warn("[BotonReintentarAnalisis] Falló lectura de IndexedDB:", idbErr)
      }
    }

    // 2. Intentar recuperar desde Puente Nativo Android (window.LaVeinteApp)
    if (typeof window !== "undefined" && window.LaVeinteApp) {
      try {
        if (sourceUri && !sourceUri.startsWith("http") && !sourceUri.startsWith("blob")) {
          // Ruta de archivo local en Android (nunca fetch(content://...))
          const docContent = await window.LaVeinteApp.readNativeDocument(sourceUri)
          if (docContent?.data) {
            const bytes = base64ToUint8Array(docContent.data)
            await processBytes(bytes, docContent.name || "tarjeton.pdf")
            return
          }
        } else if (window.LaVeinteApp.listNativeDocuments) {
          const nativeDocs = await window.LaVeinteApp.listNativeDocuments()
          const target = nativeDocs.find(
            (d) =>
              (periodRaw && d.name.toLowerCase().includes(periodRaw.toLowerCase())) ||
              d.name.toLowerCase().includes("tarjeton") ||
              d.name.toLowerCase().endsWith(".pdf")
          ) || nativeDocs[0]

          if (target?.localPath) {
            const docContent = await window.LaVeinteApp.readNativeDocument(target.localPath)
            if (docContent?.data) {
              const bytes = base64ToUint8Array(docContent.data)
              await processBytes(bytes, docContent.name || target.name)
              return
            }
          }
        }
      } catch (nativeErr) {
        console.warn("[BotonReintentarAnalisis] Falló recuperación de puente nativo:", nativeErr)
      }
    }

    // 3. Intentar recuperar desde URL persistente o Blob URL web (NO content:// ni file://)
    if (sourceUri && (sourceUri.startsWith("http://") || sourceUri.startsWith("https://") || sourceUri.startsWith("blob:"))) {
      try {
        const res = await fetch(sourceUri)
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size > 0) {
            const bytes = new Uint8Array(await blob.arrayBuffer())
            await processBytes(bytes, "tarjeton.pdf")
            return
          }
        }
      } catch (fetchErr) {
        console.warn("[BotonReintentarAnalisis] Falló fetch de sourceUri:", fetchErr)
      }
    }

    // 4. Si comprobamos que el archivo original no existe en ningún almacenamiento:
    // Mostrar mensaje exacto requerido y permitir seleccionar nuevamente el archivo.
    if (process.env.NODE_ENV !== "production") {
      console.info("[ReintentarAnalisis] Telemetry:", {
        handlerCalled: true,
        documentId: documentId ?? null,
        sourceUriPresent: Boolean(sourceUri),
        originalBlobPresent: false,
        byteLength: 0,
        pdfPages: 0,
        textItems: 0,
        candidateRows: 0,
        perceptionsParsed: 0,
        deductionsParsed: 0,
        persistenceSucceeded: false,
      })
    }

    setError("No existe el archivo fuente para reprocesar. Sólo quedó guardado el resumen sin conceptos.")
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const bytes = new Uint8Array(await file.arrayBuffer())
    await processBytes(bytes, file.name)
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <Button
        variant={variant}
        size={size}
        loading={loading}
        onClick={handleRetryClick}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
      >
        <ArrowsClockwise size={14} />
        {loading ? "Analizando…" : "Reintentar análisis"}
      </Button>

      {feedback && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#166534",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            marginTop: "0.25rem",
          }}
        >
          <CheckCircle size={14} weight="fill" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            marginTop: "0.25rem",
            maxWidth: "28rem",
            lineHeight: 1.35,
          }}
        >
          <WarningCircle size={14} weight="fill" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
