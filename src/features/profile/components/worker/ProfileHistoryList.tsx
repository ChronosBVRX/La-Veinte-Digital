"use client"
import type { WorkerDataEvent } from "@/shared/domain/worker"

const PRIORITY_ICONS: Record<string, string> = { info: "ℹ", important: "⚠", critical: "❗" }
const EVENT_LABELS: Record<string, string> = {
  profile_created: "Perfil creado",
  mode_changed: "Cambiaste de modo",
  tarjeton_imported: "Importaste un tarjetón",
  field_updated: "Actualizaste tu perfil",
  consent_granted: "Consentimiento otorgado",
  consent_revoked: "Consentimiento revocado",
  data_deleted: "Datos laborales eliminados",
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  return `Hace ${months} meses`
}

export function ProfileHistoryList({ events }: { events: WorkerDataEvent[] }) {
  if (events.length === 0) return null
  return (
    <div>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Historial</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {events.map((e) => (
          <div key={e.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.8125rem", padding: "0.375rem 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ flexShrink: 0 }}>{PRIORITY_ICONS[e.priority] ?? "ℹ"}</span>
            <span style={{ flex: 1 }}>{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{timeAgo(e.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
