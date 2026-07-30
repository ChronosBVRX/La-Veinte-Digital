"use client"

import { Download } from "lucide-react"
import { generateICS, downloadICS } from "@/features/calendario/services/calendarioData"

interface Props {
  monthIndex?: number
  label?: string
}

export function CalendarioExportButton({ monthIndex, label }: Props) {
  const filename = monthIndex !== undefined
    ? `calendario-imss-2026-${(monthIndex + 1).toString().padStart(2, "0")}.ics`
    : "calendario-imss-2026.ics"

  return (
    <button
      onClick={() => {
        const content = generateICS(2026, monthIndex)
        downloadICS(content, filename)
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.375rem",
        padding: "0.375rem 0.75rem", borderRadius: "var(--radius)",
        background: "var(--accent)", border: "1px solid var(--border)",
        cursor: "pointer", color: "var(--fg)", fontSize: "0.8125rem",
        fontWeight: 500, lineHeight: 1,
      }}
      title="Exportar a calendario"
    >
      <Download size={14} />
      {label ?? "Exportar"}
    </button>
  )
}
