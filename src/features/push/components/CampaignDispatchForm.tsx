"use client"

import { useActionState, useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import type { Announcement } from "@/shared/contracts/announcements"
import {
  sendLiveCampaignAction,
  sendTestSelfCampaignAction,
  type CampaignActionResponse,
} from "../actions/campaign-actions"
import {
  PaperPlaneTilt,
  DeviceMobile,
  Users,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
  RocketLaunch,
} from "@phosphor-icons/react"

interface CampaignDispatchFormProps {
  announcement: Announcement | null
  totalEligibleDevices: number
  myDevicesCount: number
}

export function CampaignDispatchForm({
  announcement,
  totalEligibleDevices,
  myDevicesCount,
}: CampaignDispatchFormProps) {
  const [confirmedLive, setConfirmedLive] = useState(false)

  const [testState, testAction, testPending] = useActionState(
    sendTestSelfCampaignAction,
    undefined as CampaignActionResponse | undefined
  )

  const [liveState, liveAction, livePending] = useActionState(
    sendLiveCampaignAction,
    undefined as CampaignActionResponse | undefined
  )

  const title = announcement?.title ?? ""
  const body = announcement?.push_summary || announcement?.body || ""
  const destination = announcement?.destination_path ?? ""

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Resumen del contenido a despachar */}
      <Card padding="1.5rem">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>
          Contenido de la Notificación Push
        </h3>

        <div style={{ background: "var(--accent)", borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Título:</span>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.9375rem", fontWeight: 600 }}>{title || "Sin título"}</p>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Mensaje / Resumen:</span>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.875rem", color: "var(--fg)" }}>{body || "Sin mensaje"}</p>
          </div>
          {destination && (
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Destino al pulsar:</span>
              <code style={{ display: "block", fontSize: "0.8125rem", color: "var(--primary)", marginTop: "0.15rem" }}>{destination}</code>
            </div>
          )}
        </div>
      </Card>

      {/* Estimación de Audiencia */}
      <Card padding="1.5rem">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>
          Audiencia Estimada
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", marginBottom: "0.25rem" }}>
              <Users size={20} weight="duotone" />
              <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Dispositivos Totales</span>
            </div>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--fg)" }}>{totalEligibleDevices}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Registrados y habilitados</span>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#059669", marginBottom: "0.25rem" }}>
              <DeviceMobile size={20} weight="duotone" />
              <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Tus Dispositivos</span>
            </div>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--fg)" }}>{myDevicesCount}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Para prueba propia</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          * Nota operativa: La cifra refleja tokens FCM registrados en la base de datos. La entrega real dependerá de que el teléfono conserve conexión y permisos activos en el sistema operativo.
        </p>
      </Card>

      {/* Paso 1: Prueba SELF */}
      <Card padding="1.5rem">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9375rem", fontWeight: 700 }}>
              Paso 1: Enviarme una prueba previa
            </h4>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Se enviará una notificación etiquetada como <code>[PRUEBA]</code> exclusivamente a tus dispositivos registrados.
            </p>
          </div>

          <form action={testAction}>
            <input type="hidden" name="announcement_id" value={announcement?.id ?? ""} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="body" value={body} />
            <input type="hidden" name="destination" value={destination} />
            <Button variant="secondary" size="md" type="submit" loading={testPending} disabled={myDevicesCount === 0}>
              <PaperPlaneTilt size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
              Enviarme prueba
            </Button>
          </form>
        </div>

        {testState?.ok && (
          <div style={{ marginTop: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#166534", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={18} weight="fill" />
            <span>Prueba despachada: {testState.accepted} aceptada(s) por Firebase de {testState.targetDevices} dispositivo(s).</span>
          </div>
        )}

        {testState?.error && (
          <div style={{ marginTop: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#991b1b", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <WarningCircle size={18} weight="fill" />
            <span>{testState.error}</span>
          </div>
        )}
      </Card>

      {/* Paso 2: Despacho Masivo LIVE */}
      <Card padding="1.5rem" style={{ border: "1px solid var(--primary)" }}>
        <h4 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
          Paso 2: Confirmar y Publicar Campaña LIVE
        </h4>
        <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
          Esta acción creará una campaña duradera en base de datos y despachará la notificación push a todos los dispositivos Android registrados de los trabajadores que permitan comunicados.
        </p>

        {liveState?.error && (
          <div style={{ marginBottom: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#991b1b", fontSize: "0.875rem" }}>
            {liveState.error}
          </div>
        )}

        {!confirmedLive ? (
          <Button variant="primary" size="md" onClick={() => setConfirmedLive(true)}>
            <RocketLaunch size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            Preparar envío general
          </Button>
        ) : (
          <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#92400e", fontWeight: 600, fontSize: "0.875rem" }}>
              <WarningCircle size={18} weight="bold" />
              <span>Confirmación de despacho masivo</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#78350f" }}>
              ¿Estás seguro de enviar esta notificación a <strong>{totalEligibleDevices} dispositivos</strong>? Una vez aceptada por Firebase no se puede cancelar.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
              <form action={liveAction}>
                <input type="hidden" name="announcement_id" value={announcement?.id ?? ""} />
                <input type="hidden" name="title" value={title} />
                <input type="hidden" name="body" value={body} />
                <input type="hidden" name="destination" value={destination} />
                <Button variant="primary" size="md" type="submit" loading={livePending}>
                  Sí, enviar ahora a todos
                </Button>
              </form>
              <Button variant="ghost" size="md" onClick={() => setConfirmedLive(false)} disabled={livePending}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
