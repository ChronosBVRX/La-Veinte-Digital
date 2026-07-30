import { Download } from "lucide-react"

interface Props {
  monthIndex?: number
  label?: string
}

export function CalendarioExportButton({ monthIndex, label }: Props) {
  const href = monthIndex !== undefined
    ? `/api/calendario?mes=${monthIndex}`
    : "/api/calendario"

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
