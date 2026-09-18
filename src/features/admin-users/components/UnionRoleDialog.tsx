"use client"

import { useId, useState } from "react"
import { Modal } from "@/shared/components/ui/Modal"
import { Button } from "@/shared/components/ui/Button"
import { Select, Textarea } from "@/shared/components/ui/Input"
import { Alert } from "@/shared/components/ui/Alert"
import { postAdminAction } from "@/features/admin-users/services/admin-users-client"
import type {
  AdminUnionDelegation,
  AdminUnionMembership,
  UnionRoleName,
} from "@/shared/contracts/admin-users"

export type UnionRoleAction =
  | { kind: "grant" }
  | { kind: "revoke"; membership: AdminUnionMembership }

export interface UnionRoleTarget {
  id: string
  email: string | null
  fullName: string | null
  memberships: AdminUnionMembership[]
  delegations: AdminUnionDelegation[]
}

interface UnionRoleDialogProps {
  open: boolean
  target: UnionRoleTarget | null
  action: UnionRoleAction | null
  onClose: () => void
  onCompleted: (message: string) => void
}

const ROLE_LABELS: Record<UnionRoleName, string> = {
  union_rep: "Representante Sindical (union_rep)",
  union_admin: "Administrador Sindical (union_admin)",
}

export function UnionRoleDialog({ open, target, action, onClose, onCompleted }: UnionRoleDialogProps) {
  const formId = useId()
  const [reason, setReason] = useState("")
  const [delegationId, setDelegationId] = useState(() => target?.delegations[0]?.id ?? "")
  const [role, setRole] = useState<UnionRoleName>("union_rep")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El padre remonta con key por objetivo/acción: el formulario parte limpio
  // sin efectos de reseteo (foco estable, sin renders en cascada).

  if (!open || !target || !action) return null

  const isGrant = action.kind === "grant"
  const reasonValid = reason.trim().length >= 3
  const canSubmit = !pending && reasonValid && (!isGrant || !!delegationId)

  const submit = async () => {
    setError(null)

    if (!reasonValid) {
      setError("El motivo es obligatorio (mínimo 3 caracteres).")
      return
    }
    if (isGrant && !delegationId) {
      setError("Selecciona una delegación.")
      return
    }

    setPending(true)
    try {
      if (isGrant) {
        await postAdminAction(target.id, "union-role", {
          delegationId,
          role,
          active: true,
          reason: reason.trim(),
        })
      } else {
        await postAdminAction(target.id, "union-role", {
          delegationId: action.membership.delegationId,
          role: action.membership.role,
          active: false,
          reason: reason.trim(),
        })
      }

      onCompleted(
        isGrant
          ? "Rol sindical habilitado. El usuario ya puede acceder a Representación Sindical."
          : "Rol sindical retirado.",
      )
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
      title={isGrant ? "Asignar rol sindical" : "Retirar rol sindical"}
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
            variant={isGrant ? "primary" : "danger"}
            loading={pending}
            disabled={!canSubmit}
          >
            {isGrant ? "Habilitar acceso" : "Retirar rol"}
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
          {isGrant
            ? "Habilita el acceso a Representación Sindical otorgando una membresía explícita. No modifica el rol de plataforma."
            : "Retira la membresía sindical. Si el usuario no conserva otra membresía activa, perderá el acceso a Representación Sindical."}
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {isGrant ? (
          <>
            <Select
              label="Delegación"
              value={delegationId}
              onChange={(event) => setDelegationId(event.target.value)}
            >
              {target.delegations.length === 0 && <option value="">Sin delegaciones activas</option>}
              {target.delegations.map((delegation) => (
                <option key={delegation.id} value={delegation.id}>
                  {delegation.code} · {delegation.name}
                </option>
              ))}
            </Select>

            <Select
              label="Rol sindical"
              value={role}
              onChange={(event) => setRole(event.target.value as UnionRoleName)}
            >
              <option value="union_rep">{ROLE_LABELS.union_rep}</option>
              <option value="union_admin">{ROLE_LABELS.union_admin}</option>
            </Select>
          </>
        ) : (
          <Alert variant="warning">
            Se retirará: {ROLE_LABELS[action.membership.role]} en la delegación{" "}
            {action.membership.delegationCode}.
          </Alert>
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
