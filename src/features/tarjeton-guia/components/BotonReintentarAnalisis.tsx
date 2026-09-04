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
import { getPayPeriod } from "@/features/nomina/lib/periods"
import { institutionalToday } from "@/shared/lib/dates"
import type { ImportedPayslip } from "@/features/nomina/lib/types"

interface BotonReintentarAnalisisProps {
  periodRaw?: string
  size?: "sm" | "md"
  variant?: "primary" | "secondary" | "ghost"
  onCompleted?: (result: { earnings: number; deductions: number; netPay?: number }) => void
}

export function BotonReintentarAnalisis({
  periodRaw,
  size = "sm",
  variant = "secondary",
  onCompleted,
}: BotonReintentarAnalisisProps) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const processFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setFeedback("Analizando tarjetón...")

    try {
      const sourceBytes = new Uint8Array(await file.arrayBuffer())
      const { pdf, loadingTask } = await loadPdfDocument(sourceBytes.slice().buffer)
      const pageCount = pdf.numPages

      let { items, pageTexts } = await extractNativePdfText(loadingTask)
      const totalChars = pageTexts.join(" ").replace(/\s+/g, "").length

      if (totalChars < 100) {
        const canvases: HTMLCanvasElement[] = []
        for (let p = 1; p <= pageCount; p++) {
          const canvas = await renderPdfPageToCanvas(pdf, p)
          canvases.push(canvas)
        }
        const ocrResult = await runOcrFallback(canvases)
        items = ocrResult.items
      }

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
      const targetPeriodRaw = parsed.document.periodRaw || periodRaw || ""

      // Guardar PDF en IndexedDB para futuros reanálisis
      if (targetPeriodRaw) {
        void saveTarjetonPdfBlob(targetPeriodRaw, file, file.name)
      }

      // Actualizar o crear registro en localStorage en sitio
      const currentSlips = getPayslips()
      const existingSlip = currentSlips.find((s) => {
        const sPeriod = s.period?.id || s.period?.label || ""
        return targetPeriodRaw && sPeriod.includes(targetPeriodRaw)
      })

      const fallbackEarnings = parsed.payroll.earnings.reduce((s, l) => s + l.amount, 0)
      const fallbackDeductions = Math.abs(parsed.payroll.deductions.reduce((s, l) => s + l.amount, 0))

      const period =
        parsed.document.year && parsed.document.month && parsed.document.half
          ? getPayPeriod(parsed.document.year, parsed.document.month, parsed.document.half)
          : getPayPeriod(institutionalToday().getFullYear(), institutionalToday().getMonth() + 1, 1)

      const updatedSlip: ImportedPayslip = {
        id: existingSlip?.id || crypto.randomUUID(),
        userId: existingSlip?.userId || "local",
        period,
        categoryName: parsed.employee.categoryName || existingSlip?.categoryName,
        institutionalEntryDate: parsed.employee.entryDate || existingSlip?.institutionalEntryDate,
        earnings: parsed.payroll.earnings.map((l) => ({
          code: l.code || "",
          description: l.description,
          amount: l.amount,
          confirmedByUser: true,
          includeInNextProjection: true,
        })),
        deductions: parsed.payroll.deductions.map((l) => ({
          code: l.code || "",
          description: l.description,
          amount: l.amount,
          confirmedByUser: true,
          includeInNextProjection: true,
        })),
        totalEarnings: parsed.payroll.totalEarnings ?? fallbackEarnings,
        totalDeductions: parsed.payroll.totalDeductions ?? fallbackDeductions,
        netPay: parsed.payroll.netPay ?? fallbackEarnings - fallbackDeductions,
        source: "pdf",
        confirmedByUser: true,
      }

      savePayslip(updatedSlip)

      const earningsCount = parsed.payroll.earnings.length
      const deductionsCount = parsed.payroll.deductions.length

      setFeedback(
        `¡Análisis exitoso! ${earningsCount} percepciones y ${deductionsCount} deducciones recuperadas.`
      )

      if (onCompleted) {
        onCompleted({
          earnings: earningsCount,
          deductions: deductionsCount,
          netPay: parsed.payroll.netPay,
        })
      }
    } catch (err) {
      console.error("[BotonReintentarAnalisis] error al reprocesar:", err)
      setError("Ocurrió un problema al leer el archivo. Intenta seleccionarlo nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleRetryClick = async () => {
    setError(null)
    setFeedback(null)

    // 1. Buscar si tenemos el PDF en IndexedDB
    if (periodRaw) {
      const storedFile = await getTarjetonPdfBlob(periodRaw)
      if (storedFile) {
        await processFile(storedFile)
        return
      }
    }

    // 2. Si no lo tenemos, abrir selector de archivos
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    await processFile(file)
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
        {loading ? "Analizando..." : "Reintentar análisis"}
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
          }}
        >
          <WarningCircle size={14} weight="fill" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
