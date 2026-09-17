"use client"

import { useId, useState } from "react"
import { Modal } from "@/shared/components/ui/Modal"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select, Textarea } from "@/shared/components/ui/Input"
import { Checkbox } from "@/shared/components/ui/Checkbox"
import { Alert } from "@/shared/components/ui/Alert"
import { postAdminAction } from "@/features/admin-users/services/admin-users-client"
import { ADMIN_TRASH_RETENTION_DAYS } from "@/shared/contracts/admin-users"
import type {
  AccountStatus,
  PlatformRole,
  SuspensionKind,
} from "@/shared/contracts/admin-users"

export type AdminUserActionKind =
  | "role"
  | "suspend"
  | "reactivate"
  | "trash"
  | "restore"
  | "revoke-sessions"
  | "purge"

export interface AdminUserActionTarget {
  id: string
  email: string | null
  fullName: string | null
  role: PlatformRole
  accountStatus: AccountStatus
  rawStatus: AccountStatus
  permanentDeleteEnabled: boolean
}

interface ActionCopy {
  title: string
  description: string
  confirmLabel: string
  destructive: boolean
}

const ACTION_COPY: Record<AdminUserActionKind, ActionCopy> = {
  role: {
    title: "Cambio de rol de plataforma",
    description: "El rol de plataforma controla el acceso a /admin. No modifica cargos sindicales.",
    confirmLabel: "Guardar rol",
    destructive: false,
  },
  suspend: {
    title: "Suspender cuenta",
    description:
      "La cuenta pierde acceso de inmediato en el servidor. Una suspensión temporal se libera automáticamente al vencer.",
    confirmLabel: "Suspender",
    destructive: true,
  },
  reactivate: {
    title: "Reactivar cuenta",
    description: "La cuenta recupera el acceso y se retira el bloqueo de autenticación.",
    confirmLabel: "Reactivar",
    destructive: false,
  },
  trash: {
    title: "Enviar a papelera",
    description: `La cuenta se bloquea y podrá eliminarse definitivamente después de ${ADMIN_TRASH_RETENTION_DAYS} días. Es recuperable durante ese periodo.`,
    confirmLabel: "Enviar a papelera",
    destructive: true,
  },
  restore: {
    title: "Restaurar cuenta",
    description: "La cuenta vuelve a estar activa y se cancela la eliminación programada.",
    confirmLabel: "Restaurar",
    destructive: false,
  },
  "revoke-sessions": {
    title: "Cerrar todas las sesiones",
    description: "Se revocan los tokens de actualización. El usuario deberá iniciar sesión de nuevo.",
    confirmLabel: "Cerrar sesiones",
    destructive: false,
  },
  purge: {
    title: "Eliminación definitiva",
    description:
      "Operación irreversible. Solo se permite en cuentas en papelera y queda bloqueada ante referencias que comprometan la integridad.",
    confirmLabel: "Eliminar definitivamente",
    destructive: true,
  },
}

function defaultEndsAt(): string {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

interface UserActionDialogProps {
  open: boolean
  action: AdminUserActionKind | null
  target: AdminUserActionTarget | null
  onClose: () => void
  onCompleted: (message: string) => void
}

export function UserActionDialog({ open, action, target, onClose, onCompleted }: UserActionDialogProps) {
  const formId = useId()
  const [reason, setReason] = useState("")
  const [role, setRole] = useState<PlatformRole>(() => (target?.role === "admin" ? "user" : "admin"))
  const [kind, setKind] = useState<SuspensionKind>("temporary")
  const [endsAt, setEndsAt] = useState(defaultEndsAt)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El componente se monta con una `key` por acción y objetivo (padre), de modo
  // que el estado del formulario parte limpio en cada apertura sin efectos de
  // reseteo (evita renders en cascada y conserva el foco de forma estable).

  if (!open || !action || !target) return null

  const copy = ACTION_COPY[action]
  const reasonIsValid = reason.trim().length >= 3
  const emailMatches =
    !!target.email && confirmEmail.trim().toLowerCase() === target.email.trim().toLowerCase()
  const canSubmit =
    !pending &&
    reasonIsValid &&
    (action !== "role" || role !== target.role) &&
    (action !== "trash" || confirmed) &&
    (action !== "purge" || (emailMatches && target.permanentDeleteEnabled))

  const submit = async () => {
    setError(null)

    if (!reasonIsValid) {
      setError("El motivo es obligatorio (mínimo 3 caracteres).")
      return
    }
    if (action === "role" && role === target.role) {
      setError("Seleccione un rol distinto al actual.")
      return
    }
    if (action === "trash" && !confirmed) {
      setError("Confirma que entiendes la retención y el bloqueo de la cuenta.")
      return
    }
    if (action === "purge") {
      if (!target.permanentDeleteEnabled) {
        setError("La eliminación definitiva está deshabilitada en el servidor.")
        return
      }
      if (!emailMatches) {
        setError("Escribe el correo exacto de la cuenta para confirmar.")
        return
      }
    }

    setPending(true)
    try {
      if (action === "role") {
        await postAdminAction(target.id, "role", { role, reason: reason.trim() })
      } else if (action === "suspend") {
        await postAdminAction(target.id, "suspend", {
          kind,
          endsAt: kind === "temporary" ? new Date(endsAt).toISOString() : null,
          reason: reason.trim(),
        })
      } else if (action === "purge") {
        await postAdminAction(target.id, "purge", {
          confirmEmail: confirmEmail.trim(),
          reason: reason.trim(),
        })
      } else if (action === "revoke-sessions") {
        await postAdminAction(target.id, "sessions/revoke", { reason: reason.trim() })
      } else {
        await postAdminAction(target.id, action, { reason: reason.trim() })
      }

      onCompleted(`${copy.confirmLabel}: operación aplicada correctamente.`)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo completar la operación.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      description={`${target.fullName ?? "Cuenta sin nombre"} · ${target.email ?? "sin correo"}`}
      size="sm"
      closeOnOverlay={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={copy.destructive ? "danger" : "primary"}
            loading={pending}
            disabled={!canSubmit}
          >
            {copy.confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
          {copy.description}
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {action === "role" && (
          <Select
            label="Rol de plataforma"
            value={role}
            onChange={(event) => setRole(event.target.value as PlatformRole)}
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </Select>
        )}

        {action === "suspend" && (
          <>
            <Select
              label="Tipo de suspensión"
              value={kind}
              onChange={(event) => setKind(event.target.value as SuspensionKind)}
            >
              <option value="temporary">Temporal (fecha de finalización)</option>
              <option value="indefinite">Indefinida</option>
            </Select>

            {kind === "temporary" && (
              <Input
                label="Finaliza el"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            )}
          </>
        )}

        {action === "trash" && (
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            label={
              <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                Entiendo que la cuenta quedará bloqueada y que la eliminación definitiva podrá
                ejecutarse después de {ADMIN_TRASH_RETENTION_DAYS} días.
              </span>
            }
          />
        )}

        {action === "purge" && (
          <>
            {!target.permanentDeleteEnabled && (
              <Alert variant="warning">
                La eliminación definitiva está deshabilitada en el servidor
                (ADMIN_PERMANENT_DELETE_ENABLED). Puedes dejar la cuenta en papelera.
              </Alert>
            )}
            <Input
              label={`Escribe el correo de la cuenta (${target.email ?? "sin correo"}) para confirmar`}
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </>
        )}

        <Textarea
          label="Motivo (obligatorio, queda en la bitácora)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          required
        />
      </form>
    </Modal>
  )
}
