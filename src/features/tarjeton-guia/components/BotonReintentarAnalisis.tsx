import { useRef, useState } from "react"
import { ArrowsClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { analyzeAndPersistPayslip } from "@/features/tarjeton/services/analyze-and-persist-payslip"

interface BotonReintentarAnalisisProps {
  periodRaw?: string
  documentId?: string
  sourceUri?: string
  size?: "sm" | "md"
  variant?: "primary" | "secondary" | "ghost"
  onCompleted?: (result: { earnings: number; deductions: number; netPay?: number }) => void
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

  const executeAnalysis = async (options: Parameters<typeof analyzeAndPersistPayslip>[1] = {}) => {
    setLoading(true)
    setError(null)
    setFeedback("Analizando tarjetón...")

    try {
      const res = await analyzeAndPersistPayslip(documentId, {
        periodRaw,
        sourceUri,
        ...options,
        onProgress: (_status, message) => {
          setFeedback(message)
        },
      })

      if (res.ok) {
        setFeedback(
          `¡Análisis exitoso! ${res.earningsCount} percepciones y ${res.deductionsCount} deducciones recuperadas.`
        )
        if (onCompleted) {
          onCompleted({
            earnings: res.earningsCount,
            deductions: res.deductionsCount,
            netPay: res.netPay,
          })
        }
      } else {
        setError(res.error || "No fue posible interpretar los conceptos.")
        if (res.error?.includes("No se encontró el documento PDF")) {
          fileInputRef.current?.click()
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar el tarjetón."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRetryClick = async () => {
    await executeAnalysis()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    await executeAnalysis({ blob: file, fileName: file.name, force: true })
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
