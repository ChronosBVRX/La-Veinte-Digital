"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { LockerStatusBadge } from "./LockerStatusBadge";
import type { LockerItem } from "./LockerDesktopTable";

interface AssignmentHistoryRecord {
  id: string;
  status: string;
  assigned_at: string;
  released_at?: string | null;
  release_reason?: string | null;
  admin_override?: boolean;
  admin_override_reason?: string | null;
  worker?: {
    first_name: string;
    paternal_surname: string;
    maternal_surname?: string | null;
    employee_number: string;
  } | null;
}

export function LockerDetailSheet({
  isOpen,
  onClose,
  lockerId,
  onOpenAssign,
  onOpenRelease,
  onSetStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  lockerId: string | null;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
  onSetStatus: (lockerId: string, status: string) => void;
}): React.JSX.Element | null {
  const [locker, setLocker] = useState<LockerItem | null>(null);
  const [history, setHistory] = useState<AssignmentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !lockerId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch locker detail on id change
    setLoading(true);
    setError(null);

    fetch(`/api/union/lockers?locker_id=${lockerId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el detalle del casillero.");
        return res.json();
      })
      .then((j: { locker?: LockerItem; history?: AssignmentHistoryRecord[] }) => {
        if (!cancelled) {
          setLocker(j.locker ?? null);
          setHistory(j.history ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al consultar casillero.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, lockerId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function formatDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  const worker = locker?.active_assignment?.union_workers;
  const pending = locker?.pending_review_item;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "flex-end",
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(2px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-sheet-title"
    >
      <div style={{ position: "absolute", inset: 0 }} onClick={onClose} />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          height: "100%",
          backgroundColor: "var(--card)",
          boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <h2 id="detail-sheet-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
              {locker ? `Locker ${locker.locker_number}` : "Detalle del casillero"}
            </h2>
            {locker ? (
              <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} aria-busy="true">
              <div style={{ height: "40px", backgroundColor: "var(--accent)", borderRadius: "0.375rem" }} />
              <div style={{ height: "80px", backgroundColor: "var(--accent)", borderRadius: "0.375rem" }} />
              <div style={{ height: "120px", backgroundColor: "var(--accent)", borderRadius: "0.375rem" }} />
            </div>
          ) : error ? (
            <p role="alert" style={{ color: "#dc2626", fontSize: "0.875rem" }}>
              {error}
            </p>
          ) : locker ? (
            <>
              {/* Ubicación y sección */}
              {locker.location || locker.section ? (
                <div
                  style={{
                    backgroundColor: "var(--accent)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem 1rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>Ubicación física: </span>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {[locker.section ? `Sección ${locker.section}` : "", locker.location].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ) : null}

              {/* Información del trabajador asignado */}
              <div
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Trabajador asignado
                </span>
                {worker ? (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--fg)" }}>
                      {`${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim()}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      Matrícula: <strong>{worker.employee_number}</strong>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      Asignado desde: <strong>{formatDate(locker.active_assignment?.assigned_at)}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                    Sin asignación activa en este momento.
                  </div>
                )}
              </div>

              {/* Alerta de incidencia pendiente si existe */}
              {pending ? (
                <div
                  style={{
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: "var(--radius)",
                    padding: "0.875rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#9a3412" }}>
                    📋 Incidencia de importación pendiente
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#78350f" }}>
                    {pending.reason === "WORKER_NOT_FOUND" ? (
                      <span>
                        En el archivo este casillero figura para{" "}
                        <strong>{pending.source_worker_name || "Trabajador"}</strong> (Mat.{" "}
                        {pending.source_employee_number || "—"}), quien aún no aparece en el padrón activo.
                      </span>
                    ) : (
                      <span>
                        Caso registrado para revisión: {pending.source_notes || pending.reason}.
                      </span>
                    )}
                  </div>
                  <div>
                    <Link
                      href="/representacion/lockers/pendientes"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#ea580c",
                        textDecoration: "underline",
                      }}
                    >
                      Ir a resolver en bandeja de pendientes →
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Historial reciente */}
              <div>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                  Historial de movimientos
                </h3>
                {history.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {history.map((h) => {
                      const hwName = h.worker
                        ? `${h.worker.paternal_surname} ${h.worker.first_name}`.trim()
                        : "Trabajador";
                      return (
                        <div
                          key={h.id}
                          style={{
                            padding: "0.625rem 0.75rem",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            fontSize: "0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: h.status === "active" ? "#166534" : "var(--muted)" }}>
                              {h.status === "active" ? "● Asignación activa" : "○ Liberado"}
                            </span>
                            <span style={{ color: "var(--muted)" }}>{formatDate(h.assigned_at)}</span>
                          </div>
                          <div>
                            <strong>{hwName}</strong> (Mat. {h.worker?.employee_number ?? "—"})
                          </div>
                          {h.release_reason ? (
                            <div style={{ color: "var(--muted)", fontStyle: "italic" }}>
                              Motivo de liberación: {h.release_reason}
                            </div>
                          ) : null}
                          {h.admin_override && h.admin_override_reason ? (
                            <div style={{ color: "#b45309" }}>
                              Asignación justificada: {h.admin_override_reason}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
                    No hay movimientos registrados para este casillero.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer con acciones según estado */}
        {locker ? (
          <div
            style={{
              padding: "1rem 1.5rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              backgroundColor: "var(--card)",
            }}
          >
            {locker.active_assignment ? (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenRelease(locker.active_assignment!.id, locker.locker_number);
                }}
                style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
              >
                Liberar locker
              </Button>
            ) : locker.status === "available" ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    onSetStatus(locker.id, "maintenance");
                    onClose();
                  }}
                >
                  Mantenimiento
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onClose();
                    onOpenAssign(locker);
                  }}
                >
                  Asignar locker
                </Button>
              </>
            ) : locker.status === "maintenance" ? (
              <Button
                variant="primary"
                onClick={() => {
                  onSetStatus(locker.id, "available");
                  onClose();
                }}
              >
                Marcar disponible
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
