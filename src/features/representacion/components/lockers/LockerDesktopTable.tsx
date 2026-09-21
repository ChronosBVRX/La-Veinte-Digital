"use client";

import { useState } from "react";
import { LockerStatusBadge } from "./LockerStatusBadge";
import type { LockerReviewItem } from "@/features/representacion/services/worker-importer/types";

export interface LockerItem {
  id: string;
  locker_number: string;
  physical_code?: string | null;
  location?: string | null;
  section?: string | null;
  status: string;
  condition?: "ok" | "maintenance" | "blocked" | string | null;
  maintenance_reason?: string | null;
  zone_id?: string | null;
  bank_id?: string | null;
  zone?: { id: string; name: string; building?: string | null; floor?: string | null } | null;
  bank?: { id: string; name: string; rows?: number; columns?: number; orientation?: string } | null;
  row_position?: number | null;
  column_position?: number | null;
  position_label?: string | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
  archive_source?: string | null;
  reserved_for_worker_id?: string | null;
  active_assignment?: {
    id: string;
    assigned_at: string;
    status: string;
    union_workers?: {
      first_name: string;
      paternal_surname: string;
      maternal_surname?: string | null;
      employee_number: string;
    } | null;
  } | null;
  pending_review_item?: LockerReviewItem | null;
  pending_review_items_count?: number;
}

export function LockerDesktopTable({
  lockers,
  onOpenDetail,
  onOpenAssign,
  onOpenRelease,
  onOpenEdit,
  onOpenArchive,
  onOpenHardDelete,
  onSetStatus: _onSetStatus,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  isAdmin = false,
  loading = false,
}: {
  lockers: LockerItem[];
  onOpenDetail: (lockerId: string) => void;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
  onOpenEdit?: (locker: LockerItem) => void;
  onOpenArchive?: (locker: LockerItem) => void;
  onOpenHardDelete?: (locker: LockerItem) => void;
  onSetStatus: (lockerId: string, newStatus: string) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAdmin?: boolean;
  loading?: boolean;
}): React.JSX.Element {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function formatDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  const allSelected = lockers.length > 0 && lockers.every((l) => selectedIds.includes(l.id));

  if (loading && lockers.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
        aria-busy="true"
        aria-label="Cargando casilleros…"
      >
        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                height: "44px",
                backgroundColor: "var(--accent)",
                borderRadius: "0.375rem",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflowX: "auto",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: "1050px",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
          textAlign: "left",
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: "var(--accent)",
              borderBottom: "1px solid var(--border)",
              color: "var(--muted)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {onToggleSelectAll ? (
              <th style={{ padding: "0.75rem 0.5rem 0.75rem 1rem", width: "40px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Seleccionar todos los casilleros visibles"
                  style={{ cursor: "pointer" }}
                />
              </th>
            ) : null}
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Locker</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Cód. Físico</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Ocupación</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Condición</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Ocupante / Matrícula</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Ubicación</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Origen</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Último mov.</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700, textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lockers.map((locker) => {
            const worker = locker.active_assignment?.union_workers;
            const pending = locker.pending_review_item;
            const isMenuOpen = openMenuId === locker.id;
            const isSelected = selectedIds.includes(locker.id);
            const isArchived = Boolean(locker.archived_at);

            const workerName = worker
              ? `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim()
              : pending?.source_worker_name
                ? `${pending.source_worker_name} (en archivo)`
                : "—";

            const employeeNum = worker?.employee_number ?? pending?.source_employee_number ?? "—";
            const movementDate = locker.active_assignment?.assigned_at ?? locker.updated_at;

            // Condición física badge
            const cond = locker.condition || "ok";
            const condColor =
              cond === "maintenance"
                ? { bg: "#fef3c7", fg: "#92400e", label: "Mantenimiento" }
                : cond === "blocked"
                ? { bg: "#fee2e2", fg: "#991b1b", label: "Bloqueado" }
                : { bg: "#f0fdf4", fg: "#166534", label: "OK" };

            // Ubicación formateada
            const zoneName = locker.zone?.name || locker.location || null;
            const bankName = locker.bank?.name || null;
            const positionText = locker.position_label
              ? locker.position_label
              : locker.row_position
              ? `F${locker.row_position}:C${locker.column_position ?? "-"}`
              : null;

            return (
              <tr
                key={locker.id}
                onClick={() => onOpenDetail(locker.id)}
                style={{
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "var(--accent)"
                    : isArchived
                    ? "rgba(100, 116, 139, 0.05)"
                    : "transparent",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = isArchived
                      ? "rgba(100, 116, 139, 0.05)"
                      : "transparent";
                  }
                }}
              >
                {/* Selection Checkbox */}
                {onToggleSelect ? (
                  <td
                    style={{ padding: "0.75rem 0.5rem 0.75rem 1rem", verticalAlign: "middle", textAlign: "center" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(locker.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(locker.id)}
                      aria-label={`Seleccionar locker ${locker.locker_number}`}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                ) : null}

                {/* Locker Number & Badges */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--fg)" }}>
                      Locker {locker.locker_number}
                    </span>
                    {isArchived ? (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        Archivado
                      </span>
                    ) : null}
                    {locker.section ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Sec. {locker.section}
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* Physical Code */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle", color: "var(--fg)", fontSize: "0.8125rem", fontFamily: "monospace" }}>
                  {locker.physical_code || "—"}
                </td>

                {/* Status Badge */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
                </td>

                {/* Condition Badge */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      backgroundColor: condColor.bg,
                      color: condColor.fg,
                    }}
                    title={locker.maintenance_reason || condColor.label}
                  >
                    {condColor.label}
                  </span>
                </td>

                {/* Worker Name & Employee Number */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    {worker ? (
                      <span style={{ fontWeight: 600, color: "var(--fg)" }}>{workerName}</span>
                    ) : pending ? (
                      <span style={{ color: "#9a3412", fontSize: "0.8125rem" }}>
                        ⚠️ {workerName}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}

                    {employeeNum !== "—" ? (
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--muted)" }}>
                        <span>Mat. </span><span>{employeeNum}</span>
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* Physical Location */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle", fontSize: "0.8125rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {zoneName || "Sin zona"}
                    </span>
                    {bankName || positionText ? (
                      <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {bankName ? bankName : ""}
                        {bankName && positionText ? " · " : ""}
                        {positionText ? positionText : ""}
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* Source */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle", color: "var(--muted)", fontSize: "0.75rem", textTransform: "capitalize" }}>
                  {locker.source || "—"}
                </td>

                {/* Movement Date */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle", color: "var(--muted)", fontSize: "0.8125rem" }}>
                  {formatDate(movementDate)}
                </td>

                {/* Context Menu Actions */}
                <td
                  style={{ padding: "0.75rem 1rem", verticalAlign: "middle", textAlign: "right", position: "relative" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(isMenuOpen ? null : locker.id)}
                    aria-label={`Acciones del locker ${locker.locker_number}`}
                    aria-expanded={isMenuOpen}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border)",
                      backgroundColor: isMenuOpen ? "var(--accent)" : "var(--card)",
                      color: "var(--fg)",
                      fontSize: "1.125rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    ⋯
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen ? (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 40 }}
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: "1rem",
                          top: "calc(100% - 0.25rem)",
                          zIndex: 50,
                          minWidth: "180px",
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                          padding: "0.375rem 0",
                          display: "flex",
                          flexDirection: "column",
                          textAlign: "left",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onOpenDetail(locker.id);
                          }}
                          style={menuItemStyle}
                        >
                          👁 Ver ficha física
                        </button>

                        {onOpenEdit ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenEdit(locker);
                            }}
                            style={menuItemStyle}
                          >
                            ✏️ Editar / Renumerar
                          </button>
                        ) : null}

                        {/* Asignar o Liberar según estado */}
                        {locker.status === "available" || locker.status === "disponible" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenAssign(locker);
                            }}
                            style={menuItemStyle}
                          >
                            ➕ Asignar locker
                          </button>
                        ) : null}

                        {locker.active_assignment ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenRelease(locker.active_assignment!.id, locker.locker_number);
                            }}
                            style={menuItemStyle}
                          >
                            🔓 Liberar casillero
                          </button>
                        ) : null}

                        {/* Archivar / Reactivar */}
                        {onOpenArchive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenArchive(locker);
                            }}
                            style={{
                              ...menuItemStyle,
                              color: isArchived ? "#15803d" : "#c2410c",
                            }}
                          >
                            {isArchived ? "♻️ Reactivar casillero" : "📦 Retirar / Archivar"}
                          </button>
                        ) : null}

                        {/* Eliminar definitivamente (solo si admin y habilitado) */}
                        {isAdmin && onOpenHardDelete ? (
                          <>
                            <div style={{ height: "1px", backgroundColor: "var(--border)", margin: "0.25rem 0" }} />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onOpenHardDelete(locker);
                              }}
                              style={{
                                ...menuItemStyle,
                                color: "#b91c1c",
                                fontWeight: 600,
                              }}
                            >
                              🗑 Eliminar definitivamente
                            </button>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.875rem",
  background: "none",
  border: "none",
  fontSize: "0.8125rem",
  color: "var(--fg)",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  transition: "background-color 0.1s ease",
};
