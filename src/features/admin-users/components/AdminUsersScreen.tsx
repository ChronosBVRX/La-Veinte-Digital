"use client"

import { useEffect, useMemo, useState } from "react"
import { MagnifyingGlass, ArrowClockwise, FunnelSimple } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select } from "@/shared/components/ui/Input"
import { Alert } from "@/shared/components/ui/Alert"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { useToast } from "@/shared/components/ui/Toast"
import type { AdminUserListQuery, AdminUserPage, AdminUserSummary } from "@/shared/contracts/admin-users"
import { ADMIN_USERS_PAGE_SIZES, DEFAULT_ADMIN_USERS_QUERY } from "@/shared/contracts/admin-users"
import { useAdminUsers } from "@/features/admin-users/hooks/useAdminUsers"
import { formatDateTime } from "@/features/admin-users/lib/format"
import { AccountStatusBadge, PlatformRoleBadge } from "@/features/admin-users/components/StatusBadges"
import { UserActionsMenu } from "@/features/admin-users/components/UserActionsMenu"
import { UserDetailModal } from "@/features/admin-users/components/UserDetailModal"
import {
  UserActionDialog,
  type AdminUserActionKind,
  type AdminUserActionTarget,
} from "@/features/admin-users/components/UserActionDialog"
import {
  UnionRoleDialog,
  type UnionRoleAction,
  type UnionRoleTarget,
} from "@/features/admin-users/components/UnionRoleDialog"

interface AdminUsersScreenProps {
  initialPage: AdminUserPage | null
  initialError: boolean
}

const SORT_OPTIONS: { value: string; label: string; sort: AdminUserListQuery["sort"]; direction: AdminUserListQuery["direction"] }[] = [
  { value: "created_desc", label: "Registro (más recientes)", sort: "created_at", direction: "desc" },
  { value: "created_asc", label: "Registro (más antiguos)", sort: "created_at", direction: "asc" },
  { value: "signin_desc", label: "Último acceso", sort: "last_sign_in_at", direction: "desc" },
  { value: "email_asc", label: "Correo (A-Z)", sort: "email", direction: "asc" },
  { value: "name_asc", label: "Nombre (A-Z)", sort: "full_name", direction: "asc" },
]

function sortValue(query: AdminUserListQuery): string {
  const match = SORT_OPTIONS.find((option) => option.sort === query.sort && option.direction === query.direction)
  return match?.value ?? "created_desc"
}

export function AdminUsersScreen({ initialPage, initialError }: AdminUsersScreenProps) {
  const { query, setQuery, refresh, status, data, error, updating } = useAdminUsers(initialPage, initialError)
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<{ kind: AdminUserActionKind; target: AdminUserActionTarget } | null>(null)
  const [unionDialog, setUnionDialog] = useState<{ target: UnionRoleTarget; action: UnionRoleAction } | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery({ search: searchInput.trim() || undefined })
    }, 350)
    return () => window.clearTimeout(handle)
  }, [searchInput, setQuery])

  const users = data?.users ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const hasFilters = Boolean(
    query.search || query.status || query.role || query.registeredFrom || query.registeredTo,
  )

  const openActionFromRow = (kind: string, user: AdminUserSummary) => {
    if (kind === "detail") {
      setDetailId(user.id)
      return
    }

    setActionDialog({
      kind: kind as AdminUserActionKind,
      target: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountStatus: user.accountStatus,
        rawStatus: user.accountStatus,
        permanentDeleteEnabled: false,
      },
    })
  }

  const handleCompleted = (message: string) => {
    toast(message, "success")
    refresh()
  }

  const statusOptions = useMemo(
    () => (
      <>
        <option value="">Todos los estados</option>
        <option value="active">Activos</option>
        <option value="suspended">Suspendidos</option>
        <option value="trashed">En papelera</option>
      </>
    ),
    [],
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card padding="1rem">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
            alignItems: "end",
          }}
        >
          <Input
            label="Buscar"
            placeholder="Nombre, correo o matrícula"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            icon={<MagnifyingGlass size={16} />}
            type="search"
          />

          <Select
            label="Estado"
            value={query.status ?? ""}
            onChange={(event) =>
              setQuery({ status: (event.target.value || undefined) as AdminUserListQuery["status"] })
            }
          >
            {statusOptions}
          </Select>

          <Select
            label="Rol"
            value={query.role ?? ""}
            onChange={(event) => setQuery({ role: (event.target.value || undefined) as AdminUserListQuery["role"] })}
          >
            <option value="">Todos los roles</option>
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </Select>

          <Select
            label="Ordenar por"
            value={sortValue(query)}
            onChange={(event) => {
              const option = SORT_OPTIONS.find((item) => item.value === event.target.value)
              if (option) setQuery({ sort: option.sort, direction: option.direction })
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Input
            label="Registrados desde"
            type="date"
            value={query.registeredFrom ?? ""}
            onChange={(event) => setQuery({ registeredFrom: event.target.value || undefined })}
          />

          <Input
            label="Registrados hasta"
            type="date"
            value={query.registeredTo ?? ""}
            onChange={(event) => setQuery({ registeredTo: event.target.value || undefined })}
          />

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSearchInput("")
                setQuery({ ...DEFAULT_ADMIN_USERS_QUERY })
              }}
              disabled={!hasFilters && !searchInput}
            >
              <FunnelSimple size={16} weight="bold" /> Limpiar
            </Button>
            <Button variant="outline" size="md" onClick={refresh} loading={updating}>
              <ArrowClockwise size={16} weight="bold" /> Actualizar
            </Button>
          </div>
        </div>
      </Card>

      {error && status === "error" && (
        <Alert variant="error" title="No se pudo cargar el listado">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {error && status === "ready" && (
        <Alert variant="warning">{error}</Alert>
      )}

      {status === "loading" && <SkeletonList rows={6} />}

      {status === "ready" && users.length === 0 && (
        <Card padding="1.5rem">
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Sin resultados</p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
              No se encontraron cuentas con los filtros aplicados.
            </p>
            {hasFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchInput("")
                  setQuery({ ...DEFAULT_ADMIN_USERS_QUERY })
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </Card>
      )}

      {status === "ready" && users.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              {total} {total === 1 ? "cuenta" : "cuentas"} · página {query.page} de {totalPages}
              {updating ? " · actualizando…" : ""}
            </span>
          </div>

          {/* Tabla en escritorio */}
          <Card padding="0" className="desktop-only">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Listado de usuarios administrados
                </caption>
                <thead>
                  <tr>
                    {["Nombre / Correo", "Rol", "Estado", "Matrícula", "Registro", "Último acceso", "Acciones"].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        style={{
                          textAlign: "left",
                          padding: "0.75rem 1rem",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--muted)",
                          borderBottom: "1px solid var(--border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const suspension = user.accountStatus === "suspended" && user.suspensionEndsAt
                      ? formatDateTime(user.suspensionEndsAt)
                      : null
                    return (
                      <tr key={user.id}>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", minWidth: 0 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", minWidth: 0 }}>
                            <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{user.fullName ?? "Sin nombre"}</span>
                            <span style={{ fontSize: "0.8125rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
                              {user.email ?? "sin correo"}
                            </span>
                            {!user.profileComplete && (
                              <span style={{ fontSize: "0.75rem", color: "#b45309" }}>Perfil incompleto</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
                          <PlatformRoleBadge role={user.role} />
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <AccountStatusBadge status={user.accountStatus} />
                            {suspension && (
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Hasta {suspension}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}>
                          {user.matricula ?? "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                          {formatDateTime(user.registeredAt)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                          {formatDateTime(user.lastSignInAt)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                          <UserActionsMenu user={user} onSelect={openActionFromRow} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tarjetas en móvil */}
          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {users.map((user) => (
              <Card key={user.id} padding="1rem">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{user.fullName ?? "Sin nombre"}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
                        {user.email ?? "sin correo"}
                      </div>
                    </div>
                    <UserActionsMenu user={user} onSelect={openActionFromRow} />
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    <PlatformRoleBadge role={user.role} />
                    <AccountStatusBadge status={user.accountStatus} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                    <span>Matrícula: {user.matricula ?? "—"}</span>
                    <span>Registro: {formatDateTime(user.registeredAt)}</span>
                    <span>Último acceso: {formatDateTime(user.lastSignInAt)}</span>
                    {user.accountStatus === "suspended" && user.suspensionEndsAt && (
                      <span>Suspendido hasta: {formatDateTime(user.suspensionEndsAt)}</span>
                    )}
                  </div>

                  {!user.profileComplete && (
                    <span style={{ fontSize: "0.75rem", color: "#b45309" }}>Perfil incompleto</span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={query.page <= 1 || updating}
              onClick={() => setQuery({ page: query.page - 1 })}
            >
              Anterior
            </Button>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              Página {query.page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={query.page >= totalPages || updating}
              onClick={() => setQuery({ page: query.page + 1 })}
            >
              Siguiente
            </Button>
            <div style={{ width: "170px", maxWidth: "100%" }}>
              <Select
                aria-label="Resultados por página"
                value={String(query.pageSize)}
                onChange={(event) => setQuery({ pageSize: Number(event.target.value) })}
              >
                {ADMIN_USERS_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </>
      )}

      <UserDetailModal
        key={detailId ?? "sin-detalle"}
        open={!!detailId}
        userId={detailId}
        onClose={() => setDetailId(null)}
        onRequestAction={(kind, target) => {
          setDetailId(null)
          setActionDialog({ kind, target })
        }}
        onRequestUnionRole={(target, action) => {
          setDetailId(null)
          setUnionDialog({ target, action })
        }}
        onCompleted={handleCompleted}
      />

      <UserActionDialog
        key={actionDialog ? `${actionDialog.kind}-${actionDialog.target.id}` : "sin-accion"}
        open={!!actionDialog}
        action={actionDialog?.kind ?? null}
        target={actionDialog?.target ?? null}
        onClose={() => setActionDialog(null)}
        onCompleted={handleCompleted}
      />

      <UnionRoleDialog
        key={unionDialog ? `${unionDialog.action.kind}-${unionDialog.target.id}` : "sin-union"}
        open={!!unionDialog}
        target={unionDialog?.target ?? null}
        action={unionDialog?.action ?? null}
        onClose={() => setUnionDialog(null)}
        onCompleted={handleCompleted}
      />
    </div>
  )
}
