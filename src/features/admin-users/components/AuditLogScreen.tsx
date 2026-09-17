"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input, Select } from "@/shared/components/ui/Input"
import { Alert } from "@/shared/components/ui/Alert"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import type { AdminAuditEntry, AdminAuditPage, AdminAuditQuery } from "@/shared/contracts/admin-users"
import { ADMIN_AUDIT_ACTIONS, ADMIN_USERS_PAGE_SIZES } from "@/shared/contracts/admin-users"
import { fetchAdminAudit } from "@/features/admin-users/services/admin-users-client"
import { ADMIN_ACTION_LABELS, formatDateTime } from "@/features/admin-users/lib/format"

const EMPTY_QUERY: AdminAuditQuery = { page: 1, pageSize: 25 }

interface AuditLogScreenProps {
  initialPage: AdminAuditPage | null
  initialError: boolean
}

export function AuditLogScreen({ initialPage, initialError }: AuditLogScreenProps) {
  const [query, setQuery] = useState<AdminAuditQuery>(EMPTY_QUERY)
  const [data, setData] = useState<AdminAuditPage | null>(initialPage)
  const [loading, setLoading] = useState(!initialPage && !initialError)
  const [error, setError] = useState<string | null>(
    initialError ? "No se pudo cargar la bitácora administrativa." : null,
  )
  const skipInitialFetch = useRef(Boolean(initialPage))
  const requestId = useRef(0)

  const load = useCallback(async (nextQuery: AdminAuditQuery) => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const page = await fetchAdminAudit(nextQuery)
      if (currentRequest !== requestId.current) return
      setData(page)
    } catch (loadError) {
      if (currentRequest !== requestId.current) return
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la bitácora.")
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    void load(query)
  }, [load, query])

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))

  const updateQuery = (patch: Partial<AdminAuditQuery>) => {
    setQuery((previous) => {
      const next = { ...previous, ...patch }
      if (!("page" in patch)) next.page = 1
      return next
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card padding="1rem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", alignItems: "end" }}>
          <Select
            label="Acción"
            value={query.action ?? ""}
            onChange={(event) => updateQuery({ action: event.target.value || undefined })}
          >
            <option value="">Todas las acciones</option>
            {ADMIN_AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ADMIN_ACTION_LABELS[action] ?? action}
              </option>
            ))}
          </Select>

          <Input
            label="Desde"
            type="date"
            value={query.from ?? ""}
            onChange={(event) => updateQuery({ from: event.target.value || undefined })}
          />
          <Input
            label="Hasta"
            type="date"
            value={query.to ?? ""}
            onChange={(event) => updateQuery({ to: event.target.value || undefined })}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="secondary" size="md" onClick={() => setQuery(EMPTY_QUERY)}>
              Limpiar
            </Button>
            <Button variant="outline" size="md" onClick={() => void load(query)} loading={loading}>
              Actualizar
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Alert variant="error" title="No se pudo cargar la bitácora">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void load(query)}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {loading && !data && <SkeletonList rows={5} />}

      {!loading && !error && entries.length === 0 && (
        <Card padding="1.5rem">
          <p style={{ margin: 0, textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            No hay registros de auditoría para los filtros seleccionados.
          </p>
        </Card>
      )}

      {entries.length > 0 && (
        <>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            {total} {total === 1 ? "registro" : "registros"} · página {query.page} de {totalPages}
          </span>

          <Card padding="0" className="desktop-only">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Bitácora administrativa
                </caption>
                <thead>
                  <tr>
                    {["Fecha", "Acción", "Administrador", "Cuenta afectada", "Motivo", "Solicitud"].map((header) => (
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
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.875rem" }}>
                        {ADMIN_ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem", overflowWrap: "anywhere" }}>
                        {entry.actorName ?? entry.actorEmail ?? entry.actorId ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem", overflowWrap: "anywhere" }}>
                        {entry.targetName ?? entry.targetEmail ?? entry.entityId ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem", maxWidth: "260px" }}>
                        {entry.reason ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                        {entry.requestId ? entry.requestId.slice(0, 8) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {entries.map((entry) => (
              <AuditCard key={entry.id} entry={entry} />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={query.page <= 1 || loading} onClick={() => updateQuery({ page: query.page - 1 })}>
              Anterior
            </Button>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              Página {query.page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={query.page >= totalPages || loading}
              onClick={() => updateQuery({ page: query.page + 1 })}
            >
              Siguiente
            </Button>
            <div style={{ width: "170px", maxWidth: "100%" }}>
              <Select
                aria-label="Registros por página"
                value={String(query.pageSize)}
                onChange={(event) => updateQuery({ pageSize: Number(event.target.value) })}
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
    </div>
  )
}

function AuditCard({ entry }: { entry: AdminAuditEntry }) {
  return (
    <Card padding="1rem">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>
            {ADMIN_ACTION_LABELS[entry.action] ?? entry.action}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{formatDateTime(entry.createdAt)}</span>
        </div>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
          Administrador: {entry.actorName ?? entry.actorEmail ?? entry.actorId ?? "—"}
        </span>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
          Cuenta: {entry.targetName ?? entry.targetEmail ?? entry.entityId ?? "—"}
        </span>
        {entry.reason && (
          <span style={{ fontSize: "0.8125rem", overflowWrap: "anywhere" }}>Motivo: {entry.reason}</span>
        )}
      </div>
    </Card>
  )
}
