"use client";

import { useState } from "react";
import Link from "next/link";
import { LockerStatusBadge } from "./LockerStatusBadge";
import type { LockerReviewItem } from "@/features/representacion/services/worker-importer/types";

export interface LockerItem {
  id: string;
  locker_number: string;
  location?: string;
  section?: string;
  status: string;
  notes?: string;
  updated_at?: string;
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
}

export function LockerDesktopTable({
  lockers,
  onOpenDetail,
  onOpenAssign,
  onOpenRelease,
  onSetStatus,
  loading = false,
}: {
  lockers: LockerItem[];
  onOpenDetail: (lockerId: string) => void;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
  onSetStatus: (lockerId: string, newStatus: string) => void;
  loading?: boolean;
}): React.JSX.Element {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function formatDate(iso?: string): string {
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
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <table
        style={{
          width: "100%",
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
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Locker</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Estado</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Trabajador</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Matrícula</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Último movimiento</th>
            <th style={{ padding: "0.75rem 1rem", fontWeight: 700, textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lockers.map((locker) => {
            const worker = locker.active_assignment?.union_workers;
            const pending = locker.pending_review_item;
            const isMenuOpen = openMenuId === locker.id;

            const workerName = worker
              ? `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim()
              : pending?.source_worker_name
                ? `${pending.source_worker_name} (en archivo)`
                : "—";

            const employeeNum = worker?.employee_number ?? pending?.source_employee_number ?? "—";
            const movementDate = locker.active_assignment?.assigned_at ?? locker.updated_at;

            return (
              <tr
                key={locker.id}
                onClick={() => onOpenDetail(locker.id)}
                style={{
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Locker Number */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--fg)" }}>
                      Locker {locker.locker_number}
                    </span>
                    {locker.section ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Sec. {locker.section}
                      </span>
                    ) : null}
                  </div>
                  {locker.location ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{locker.location}</div>
                  ) : null}
                </td>

                {/* Status Badge */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
                </td>

                {/* Worker Name */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  {worker ? (
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>{workerName}</span>
                  ) : pending ? (
                    <span style={{ color: "#9a3412", fontSize: "0.8125rem" }}>
                      ⚠️ {workerName}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>

                {/* Employee Number */}
                <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
                  {employeeNum !== "—" ? (
                    <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--fg)" }}>
                      {employeeNum}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
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
                          minWidth: "160px",
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
                          style={{
                            padding: "0.5rem 0.875rem",
                            border: "none",
                            background: "none",
                            fontSize: "0.8125rem",
                            color: "var(--fg)",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          👁️ Ver detalle
                        </button>

                        {locker.status === "available" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onOpenAssign(locker);
                            }}
                            style={{
                              padding: "0.5rem 0.875rem",
                              border: "none",
                              background: "none",
                              fontSize: "0.8125rem",
                              color: "var(--primary)",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
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
                            style={{
                              padding: "0.5rem 0.875rem",
                              border: "none",
                              background: "none",
                              fontSize: "0.8125rem",
                              color: "#dc2626",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            🔓 Liberar locker
                          </button>
                        ) : null}

                        {locker.status === "available" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onSetStatus(locker.id, "maintenance");
                            }}
                            style={{
                              padding: "0.5rem 0.875rem",
                              border: "none",
                              background: "none",
                              fontSize: "0.8125rem",
                              color: "#b45309",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            🔧 Marcar mantenimiento
                          </button>
                        ) : null}

                        {locker.status === "maintenance" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onSetStatus(locker.id, "available");
                            }}
                            style={{
                              padding: "0.5rem 0.875rem",
                              border: "none",
                              background: "none",
                              fontSize: "0.8125rem",
                              color: "#166534",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            ✅ Marcar disponible
                          </button>
                        ) : null}

                        {pending ? (
                          <Link
                            href="/representacion/lockers/pendientes"
                            style={{
                              padding: "0.5rem 0.875rem",
                              fontSize: "0.8125rem",
                              color: "#c2410c",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontWeight: 600,
                            }}
                          >
                            📋 Revisar incidencia
                          </Link>
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
