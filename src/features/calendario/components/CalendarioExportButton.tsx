import { Download } from "lucide-react"
import { institutionalToday } from "@/shared/lib/dates"

interface Props {
  year?: number
  monthIndex?: number
  label?: string
}

export function CalendarioExportButton({ year, monthIndex, label }: Props) {
  const params = new URLSearchParams()
  if (year) params.set("anio", String(year))
  if (monthIndex !== undefined) params.set("mes", String(monthIndex))
  const qs = params.toString()
  const href = qs ? `/api/calendario?${qs}` : `/api/calendario?anio=${institutionalToday().getFullYear()}`

  return (
    <a
      href={href}
      download
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.375rem",
        padding: "0.375rem 0.75rem", borderRadius: "var(--radius)",
        background: "var(--accent)", border: "1px solid var(--border)",
        cursor: "pointer", color: "var(--fg)", fontSize: "0.8125rem",
        fontWeight: 500, lineHeight: 1, textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <Download size={14} />
      {label ?? "Exportar"}
    </a>
  )
}
