"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowCounterClockwise,
  ClockCounterClockwise,
  EnvelopeSimple,
  Handshake,
  Key,
  Prohibit,
  ShieldCheck,
  Trash,
  UserCircle,
} from "@phosphor-icons/react"
import { Modal } from "@/shared/components/ui/Modal"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Alert } from "@/shared/components/ui/Alert"
import { SkeletonText } from "@/shared/components/ui/Skeleton"
import { fetchAdminUserDetail, postAdminAction } from "@/features/admin-users/services/admin-users-client"
import type { AdminUserDetail } from "@/shared/contracts/admin-users"
import {
  ADMIN_ACTION_LABELS,
  formatDateTime,
  providerLabel,
  suspensionSummary,
  toolLabel,
} from "@/features/admin-users/lib/format"
import { AccountStatusBadge, EmailConfirmedBadge, PlatformRoleBadge } from "@/features/admin-users/components/StatusBadges"
import type { AdminUserActionKind, AdminUserActionTarget } from "@/features/admin-users/components/UserActionDialog"
import type {
  UnionRoleAction,
  UnionRoleTarget,
} from "@/features/admin-users/components/UnionRoleDialog"

interface UserDetailModalProps {
  open: boolean
  userId: string | null
  onClose: () => void
  onRequestAction: (action: AdminUserActionKind, target: AdminUserActionTarget) => void
  onRequestUnionRole: (target: UnionRoleTarget, action: UnionRoleAction) => void
  onCompleted: (message: string) => void
}

function activityLabel(event: AdminUserDetail["activity"][number]): string {
  switch (event.kind) {
    case "login":
      return "Inició sesión"
    case "payslip_import":
      return "Importó un tarjetón"
    case "tool_usage":
      return `Usó ${toolLabel(event.route)}`
    case "admin_action":
      return event.action ? (ADMIN_ACTION_LABELS[event.action] ?? event.action) : "Acción administrativa"
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", minWidth: 0 }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: "0.9375rem", color: "var(--fg)", overflowWrap: "anywhere", minWidth: 0 }}>
        {value}
      </span>
    </div>
  )
}

export function UserDetailModal({ open, userId, onClose, onRequestAction, onRequestUnionRole, onCompleted }: UserDetailModalProps) {
  const [loadedDetail, setLoadedDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quickPending, setQuickPending] = useState<string | null>(null)

  const load = useCallback(
    async (id: string, signal?: AbortSignal) => {
      // Sin setState síncrono: la carga inicial usa `loading` en true por
      // montaje (key del padre) y la recarga manual lo activa desde el evento.
      try {
        const data = await fetchAdminUserDetail(id, signal)
        setLoadedDetail(data)
        setError(null)
      } catch (loadError) {
        if (signal?.aborted) return
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la ficha.")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!open || !userId) return
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount (patrón del repo)
    void load(userId, controller.signal)
    return () => controller.abort()
  }, [open, userId, load])

  if (!open || !userId) return null

  // Si el usuario solicitado cambió, no se muestra información previa mientras
  // llega la nueva ficha (el padre remonta el modal con `key` por identificador).
  const detail = loadedDetail && loadedDetail.user.id === userId ? loadedDetail : null

  const buildTarget = (data: AdminUserDetail): AdminUserActionTarget => ({
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    role: data.user.role,
    accountStatus: data.status.accountStatus,
    rawStatus: data.status.rawStatus,
    permanentDeleteEnabled: data.permanentDeleteEnabled,
  })

  const buildUnionTarget = (data: AdminUserDetail): UnionRoleTarget => ({
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    memberships: data.union.memberships,
    delegations: data.union.delegations,
  })

  const runQuickAction = async (action: "resend-confirmation" | "password-recovery") => {
    if (!detail) return
    setQuickPending(action)
    try {
      const result = await postAdminAction(detail.user.id, action)
      onCompleted(result.message ?? "Operación aplicada.")
      await load(detail.user.id)
    } catch (quickError) {
      setError(quickError instanceof Error ? quickError.message : "No se pudo completar la operación.")
    } finally {
      setQuickPending(null)
    }
  }

  const isTrashed = detail?.status.rawStatus === "trashed"
  const isSuspended = detail?.status.rawStatus === "suspended"

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ficha administrativa"
      description="Estados técnicos y metadatos operativos. No se muestran documentos, tarjetones ni contenido privado."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {loading && !detail && <SkeletonText lines={6} />}

      {error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Alert variant="error">{error}</Alert>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoading(true)
              setError(null)
              void load(userId)
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {detail && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <AccountStatusBadge status={detail.status.accountStatus} />
            <PlatformRoleBadge role={detail.user.role} />
            <EmailConfirmedBadge confirmed={!!detail.user.emailConfirmedAt} />
          </div>

          {suspensionSummary(detail.status) && (
            <Alert variant={detail.status.suspensionExpired ? "info" : "warning"}>
              {suspensionSummary(detail.status)}
            </Alert>
          )}

          {detail.status.authSyncError && (
            <Alert variant="warning">
              Aviso de sincronización con Auth: {detail.status.authSyncError}
            </Alert>
          )}

          <Card padding="1rem">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <UserCircle size={18} weight="duotone" color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>Identidad y cuenta</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.875rem" }}>
              <DetailRow label="Nombre" value={detail.user.fullName ?? "—"} />
              <DetailRow label="Correo" value={detail.user.email ?? "—"} />
              <DetailRow label="Matrícula" value={detail.user.matricula ?? "—"} />
              <DetailRow label="Registro" value={formatDateTime(detail.user.registeredAt)} />
              <DetailRow label="Último acceso" value={formatDateTime(detail.user.lastSignInAt)} />
              <DetailRow
                label="Proveedores"
                value={detail.user.providers.length > 0 ? detail.user.providers.map(providerLabel).join(", ") : "—"}
              />
              <DetailRow label="Adscripción" value={detail.user.adscripcion ?? "—"} />
              <DetailRow label="Categoría" value={detail.user.categoria ?? "—"} />
              <DetailRow label="Sesiones revocadas" value={formatDateTime(detail.status.sessionsRevokedAt)} />
            </div>
          </Card>

          <Card padding="1rem">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <ShieldCheck size={18} weight="duotone" color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>Diagnóstico técnico</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.625rem" }}>
              {[
                { label: "Autenticación", value: detail.diagnostics.authentication },
                { label: "Perfil", value: detail.diagnostics.profile },
                { label: "Tarjetón", value: detail.diagnostics.payslip },
                { label: "Documentos", value: detail.diagnostics.documents },
                { label: "Almacenamiento", value: detail.diagnostics.storage },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.625rem 0.75rem",
                    background: "var(--bg)",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{item.label}</div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color:
                        item.value === "OK" || item.value === "DISPONIBLE"
                          ? "#047857"
                          : item.value === "ERROR"
                            ? "var(--error)"
                            : "var(--muted)",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Última sincronización: {formatDateTime(detail.diagnostics.lastSyncAt)} · Tarjetones:{" "}
              {detail.counts.payslips} · Documentos remotos: {detail.counts.remoteDocuments}
            </p>
          </Card>

          <Card padding="1rem">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Handshake size={18} weight="duotone" color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>Representación Sindical</h3>
            </div>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
              El acceso a Representación depende de la membresía sindical explícita (no del rol de
              plataforma). Los roles sindicales no otorgan acceso a Administración.
            </p>

            {detail.union.memberships.length === 0 ? (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--muted)" }}>
                Sin membresías sindicales registradas.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "0 0 0.75rem", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {detail.union.memberships.map((membership) => (
                  <li
                    key={membership.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: "0.5rem",
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <strong>{membership.delegationCode}</strong> ·{" "}
                      {membership.role === "union_admin" ? "Administrador Sindical" : "Representante Sindical"}{" "}
                      <span style={{ color: membership.active ? "#047857" : "var(--muted)", fontWeight: 600 }}>
                        ({membership.active ? "activo" : "inactivo"})
                      </span>
                    </span>
                    {membership.active && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onRequestUnionRole(buildUnionTarget(detail), { kind: "revoke", membership })
                        }
                      >
                        Retirar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="secondary"
              size="sm"
              disabled={detail.union.delegations.length === 0}
              onClick={() => onRequestUnionRole(buildUnionTarget(detail), { kind: "grant" })}
            >
              <Handshake size={16} weight="bold" /> Asignar rol sindical
            </Button>
            {detail.union.delegations.length === 0 && (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                No hay delegaciones activas disponibles.
              </p>
            )}
          </Card>

          <Card padding="1rem">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <ClockCounterClockwise size={18} weight="duotone" color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>Actividad reciente</h3>
            </div>
            {detail.activity.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>Sin eventos operativos registrados.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {detail.activity.map((event, index) => (
                  <li
                    key={`${event.kind}-${event.at}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      fontSize: "0.875rem",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: "0.5rem",
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {activityLabel(event)}
                      {typeof event.count === "number" && event.count > 0 ? ` (${event.count})` : ""}
                    </span>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDateTime(event.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="1rem">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem", fontWeight: 700 }}>Acciones administrativas</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRequestAction("role", buildTarget(detail))}
              >
                Cambiar rol
              </Button>
              {isSuspended ? (
                <Button variant="primary" size="sm" onClick={() => onRequestAction("reactivate", buildTarget(detail))}>
                  Reactivar
                </Button>
              ) : !isTrashed ? (
                <Button variant="secondary" size="sm" onClick={() => onRequestAction("suspend", buildTarget(detail))}>
                  <Prohibit size={16} weight="bold" /> Suspender
                </Button>
              ) : null}
              {isTrashed ? (
                <Button variant="primary" size="sm" onClick={() => onRequestAction("restore", buildTarget(detail))}>
                  <ArrowCounterClockwise size={16} weight="bold" /> Restaurar
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => onRequestAction("trash", buildTarget(detail))}>
                  <Trash size={16} weight="bold" /> Enviar a papelera
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRequestAction("revoke-sessions", buildTarget(detail))}
              >
                Cerrar sesiones
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={quickPending === "resend-confirmation"}
                disabled={!!detail.user.emailConfirmedAt}
                onClick={() => void runQuickAction("resend-confirmation")}
              >
                <EnvelopeSimple size={16} weight="bold" /> Reenviar confirmación
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={quickPending === "password-recovery"}
                onClick={() => void runQuickAction("password-recovery")}
              >
                <Key size={16} weight="bold" /> Recuperación de contraseña
              </Button>
              {isTrashed && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!detail.permanentDeleteEnabled}
                  onClick={() => onRequestAction("purge", buildTarget(detail))}
                >
                  Eliminar definitivamente
                </Button>
              )}
            </div>
            {isTrashed && !detail.permanentDeleteEnabled && (
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                La eliminación definitiva está deshabilitada en el servidor. La cuenta permanece recuperable.
              </p>
            )}
          </Card>
        </div>
      )}
    </Modal>
  )
}
