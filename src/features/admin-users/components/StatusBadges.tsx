"use client"

import { Badge } from "@/shared/components/ui/Badge"
import type { AccountStatus, PlatformRole } from "@/shared/contracts/admin-users"
import { ACCOUNT_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "@/features/admin-users/lib/format"

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const variant = status === "active" ? "success" : status === "suspended" ? "warning" : "error"
  return <Badge variant={variant}>{ACCOUNT_STATUS_LABELS[status]}</Badge>
}

export function PlatformRoleBadge({ role }: { role: PlatformRole }) {
  return (
    <Badge variant={role === "admin" ? "info" : "neutral"}>
      {PLATFORM_ROLE_LABELS[role]}
    </Badge>
  )
}

export function EmailConfirmedBadge({ confirmed }: { confirmed: boolean }) {
  return (
    <Badge variant={confirmed ? "success" : "warning"}>
      {confirmed ? "Correo confirmado" : "Correo pendiente"}
    </Badge>
  )
}
