import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
  retryFailedDeliveriesAction,
} from "@/features/push/actions/campaign-actions"
import { ArrowLeft, Pause, Play, XCircle, ArrowClockwise, CheckCircle } from "@phosphor-icons/react/dist/ssr"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

interface PageProps {
  params: Promise<{ id: string }>
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceRoleClient(url, key)
}

export default async function DetalleCampanaPage({ params }: PageProps) {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) {
    redirect("/admin")
  }

  const { id } = await params
  const supabase = serviceClient()
  if (!supabase) {
    notFound()
  }

  const { data: campaign } = await supabase
    .from("push_campaigns")
    .select("*")
    .eq("id", id)
    .single()

  if (!campaign) {
    notFound()
  }

  // Consultar últimas 50 entregas
  const { data: deliveries } = await supabase
    .from("push_campaign_deliveries")
    .select("*")
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .limit(50)

  const isPaused = campaign.status === "PAUSED"
  const isProcessing = campaign.status === "PROCESSING" || campaign.status === "QUEUED"
  const isFinished = campaign.status === "COMPLETED" || campaign.status === "PARTIAL" || campaign.status === "FAILED" || campaign.status === "CANCELLED"

  const statusColor =
    campaign.status === "COMPLETED"
      ? "#059669"
      : campaign.status === "PROCESSING"
        ? "#0284c7"
        : campaign.status === "PAUSED"
          ? "#d97706"
          : campaign.status === "CANCELLED"
            ? "#64748b"
            : "#dc2626"

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href={campaign.announcement_id ? `/admin/avisos/${campaign.announcement_id}` : "/admin"} style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver
          </Button>
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "0.15rem 0.5rem",
              borderRadius: "0.25rem",
              background: `${statusColor}15`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
              textTransform: "uppercase",
            }}>
              {campaign.status}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              ID #{campaign.notification_id} · {campaign.purpose} ({campaign.audience})
            </span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            {campaign.snapshot_title}
          </h1>
        </div>

        {/* Botonera de control operativo */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {isProcessing && (
            <form action={pauseCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button variant="secondary" size="sm" type="submit">
                <Pause size={14} weight="bold" style={{ marginRight: "0.25rem" }} />
                Pausar
              </Button>
            </form>
          )}
          {isPaused && (
            <form action={resumeCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button variant="primary" size="sm" type="submit">
                <Play size={14} weight="bold" style={{ marginRight: "0.25rem" }} />
                Reanudar
              </Button>
            </form>
          )}
          {!isFinished && (
            <form action={cancelCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button variant="ghost" size="sm" type="submit">
                <XCircle size={14} weight="bold" style={{ marginRight: "0.25rem" }} />
                Cancelar pendientes
              </Button>
            </form>
          )}
          {campaign.failed_count > 0 && (
            <form action={retryFailedDeliveriesAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button variant="secondary" size="sm" type="submit">
                <ArrowClockwise size={14} weight="bold" style={{ marginRight: "0.25rem" }} />
                Reintentar fallidos ({campaign.failed_count})
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Métricas Agregadas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
        <Card padding="1rem" style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Cuentas</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{campaign.target_accounts}</span>
        </Card>
        <Card padding="1rem" style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Dispositivos</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{campaign.target_devices}</span>
        </Card>
        <Card padding="1rem" style={{ textAlign: "center", borderTop: "3px solid #059669" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Aceptadas FCM</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>{campaign.accepted_count}</span>
        </Card>
        <Card padding="1rem" style={{ textAlign: "center", borderTop: "3px solid #dc2626" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Fallidas</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>{campaign.failed_count}</span>
        </Card>
        <Card padding="1rem" style={{ textAlign: "center", borderTop: "3px solid #d97706" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Tokens Inválidos</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#d97706" }}>{campaign.invalid_tokens_count}</span>
        </Card>
        <Card padding="1rem" style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Omitidas</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{campaign.skipped_count}</span>
        </Card>
      </div>

      {/* Snapshot del mensaje enviado */}
      <Card padding="1.25rem">
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          Mensaje congelado al momento del envío
        </h3>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--fg)", lineHeight: 1.5 }}>
          {campaign.snapshot_body}
        </p>
        {campaign.snapshot_destination && (
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Destino URL: <code>{campaign.snapshot_destination}</code>
          </div>
        )}
      </Card>

      {/* Bitácora de entregas individuales */}
      <Card padding="1.25rem">
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
          Detalle de entregas (últimas 50)
        </h3>

        {!deliveries || deliveries.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8125rem" }}>No hay entregas registradas en esta campaña.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Dispositivo / Token</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Estado</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Intentos</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Detalle / Error</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((del) => (
                  <tr key={del.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {del.fcm_token ? `${del.fcm_token.slice(0, 16)}...` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.4rem",
                        borderRadius: "0.2rem",
                        background:
                          del.status === "ACCEPTED"
                            ? "#dcfce7"
                            : del.status === "FAILED"
                              ? "#fee2e2"
                              : del.status === "INVALID"
                                ? "#fef3c7"
                                : "var(--accent)",
                        color:
                          del.status === "ACCEPTED"
                            ? "#15803d"
                            : del.status === "FAILED"
                              ? "#b91c1c"
                              : del.status === "INVALID"
                                ? "#b45309"
                                : "var(--muted)",
                      }}>
                        {del.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{del.attempts}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>
                      {del.error_code || (del.accepted_at ? "Aceptada por Firebase" : "—")}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(del.updated_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
