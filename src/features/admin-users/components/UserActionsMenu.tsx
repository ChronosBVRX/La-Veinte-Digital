"use client"

import { useEffect, useRef, useState } from "react"
import { DotsThreeVertical } from "@phosphor-icons/react"
import { IconButton } from "@/shared/components/ui/IconButton"
import type { AdminUserSummary } from "@/shared/contracts/admin-users"
import type { AdminUserActionKind } from "@/features/admin-users/components/UserActionDialog"

export interface UserMenuAction {
  kind: AdminUserActionKind | "detail"
  label: string
  destructive?: boolean
  disabled?: boolean
}

export function userMenuActions(user: AdminUserSummary): UserMenuAction[] {
  const actions: UserMenuAction[] = [
    { kind: "detail", label: "Ver ficha" },
    { kind: "role", label: user.role === "admin" ? "Cambiar a usuario" : "Conceder administrador" },
  ]

  if (user.accountStatus === "suspended") {
    actions.push({ kind: "reactivate", label: "Reactivar cuenta" })
  } else if (user.accountStatus !== "trashed") {
    actions.push({ kind: "suspend", label: "Suspender cuenta", destructive: true })
  }

  if (user.accountStatus === "trashed") {
    actions.push({ kind: "restore", label: "Restaurar desde papelera" })
  } else {
    actions.push({ kind: "trash", label: "Enviar a papelera", destructive: true })
  }

  actions.push({ kind: "revoke-sessions", label: "Cerrar todas las sesiones" })

  return actions
}

interface UserActionsMenuProps {
  user: AdminUserSummary
  onSelect: (action: UserMenuAction["kind"], user: AdminUserSummary) => void
}

export function UserActionsMenu({ user, onSelect }: UserActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const actions = userMenuActions(user)

  useEffect(() => {
    if (!open) return

    const onDocumentClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onDocumentClick)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onDocumentClick)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const select = (kind: UserMenuAction["kind"]) => {
    setOpen(false)
    onSelect(kind, user)
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <IconButton
        label={`Acciones para ${user.fullName ?? user.email ?? "la cuenta"}`}
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <DotsThreeVertical size={18} weight="bold" />
      </IconButton>

      {open && (
        <div
          role="menu"
          aria-label="Acciones de la cuenta"
          onKeyDown={onMenuKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 0.25rem)",
            right: 0,
            zIndex: 40,
            minWidth: "230px",
            maxWidth: "80vw",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            padding: "0.375rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.125rem",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.kind}
              role="menuitem"
              type="button"
              onClick={() => select(action.kind)}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                minHeight: "40px",
                padding: "0.5rem 0.625rem",
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.875rem",
                color: action.destructive ? "var(--error)" : "var(--fg)",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
