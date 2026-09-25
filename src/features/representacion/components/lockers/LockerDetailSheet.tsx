"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Z_INDEX } from "@/shared/constants/z-index";
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

interface EnrichedLockerItem extends LockerItem {
  condition?: string | null;
  maintenance_reason?: string | null;
  maintenance_notes?: string | null;
  zone_id?: string | null;
  bank_id?: string | null;
  row_position?: number | null;
  column_position?: number | null;
  position_label?: string | null;
  physical_code?: string | null;
  source?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
  archive_source?: string | null;
  reserved_for_worker_id?: string | null;
  reservation_reason?: string | null;
  reserved_until?: string | null;
  reserved_worker?: {
    id: string;
    employee_number: string;
    first_name: string;
    paternal_surname: string;
    maternal_surname?: string | null;
  } | null;
  zone?: { id: string; name: string; building?: string | null; floor?: string | null } | null;
  bank?: { id: string; name: string; rows?: number; columns?: number; orientation?: string } | null;
  active_assignment?: {
    id: string;
    worker_id: string;
    assigned_at: string;
    status: string;
    admin_override: boolean;
    admin_override_reason?: string | null;
    union_workers?: {
      id: string;
      employee_number: string;
      first_name: string;
      paternal_surname: string;
      maternal_surname?: string | null;
      category?: string | null;
      assignment?: string | null;
      turn?: string | null;
    } | null;
  } | null;
  pending_review_items_count?: number;
}

export function LockerDetailSheet({
  isOpen,
  onClose,
  lockerId,
  onOpenAssign,
  onOpenRelease,
  onOpenMove,
  onOpenSwap,
  onOpenEdit,
  onOpenArchive,
  onOpenHardDelete,
  onSetStatus: _onSetStatus,
  isAdmin = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  lockerId: string | null;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
  onOpenMove?: (locker: LockerItem) => void;
  onOpenSwap?: (locker: LockerItem) => void;
  onOpenEdit?: (locker: LockerItem) => void;
  onOpenArchive?: (locker: LockerItem) => void;
  onOpenHardDelete?: (locker: LockerItem) => void;
  onSetStatus: (lockerId: string, status: string, options?: { condition?: string; maintenance_reason?: string }) => void;
  isAdmin?: boolean;
}): React.JSX.Element | null {
  const [locker, setLocker] = useState<EnrichedLockerItem | null>(null);
  const [history, setHistory] = useState<AssignmentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !lockerId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- set loading state on sheet open
    setLoading(true);
    setError(null);

    fetch(`/api/union/lockers?locker_id=${lockerId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el detalle del casillero.");
        return res.json();
      })
      .then((j: { locker?: EnrichedLockerItem; history?: AssignmentHistoryRecord[] }) => {
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
  if (typeof document === "undefined") return null;

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
  const isAvailable = locker?.status === "available" || locker?.status === "disponible";
  const isAssigned = locker?.status === "assigned" || locker?.status === "ocupado";
  const isArchived = Boolean(locker?.archived_at);

  const cond = locker?.condition || "ok";
  const condColor =
    cond === "maintenance"
      ? { bg: "#fef3c7", fg: "#92400e", label: "Mantenimiento / Dañado" }
      : cond === "blocked"
      ? { bg: "#fee2e2", fg: "#991b1b", label: "Bloqueado / Clausurado" }
      : { bg: "#f0fdf4", fg: "#166534", label: "Buen estado (OK)" };

  const pendingCount = locker?.pending_review_items_count ?? (pending ? 1 : 0);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.dialog,
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
          maxWidth: "500px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <h2 id="detail-sheet-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
              {locker ? `Locker ${locker.locker_number}` : "Ficha física de casillero"}
            </h2>
            {locker ? (
              <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
            ) : null}
            {isArchived ? (
              <span
                style={{
                  fontSize: "0.6875rem",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "9999px",
                  fontWeight: 700,
                }}
              >
                Archivado
              </span>
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
              {/* Banner de Archivado (si aplica) */}
              {isArchived ? (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "var(--radius)",
                    padding: "0.875rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                    📦 Casillero Retirado del Inventario Activo
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    Archivado el {formatDate(locker.archived_at)}. Motivo: <em>«{locker.archive_reason || "Sin motivo especificado"}»</em>
                  </div>
                </div>
              ) : null}

              {/* Banner de Conciliación (Integración Bidireccional) */}
              {pendingCount > 0 ? (
                <div
                  style={{
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: "var(--radius)",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#c2410c", fontWeight: 700, fontSize: "0.875rem" }}>
                    <span>⚠️</span>
                    <span>Participa en {pendingCount} {pendingCount === 1 ? "incidencia" : "incidencias"} de conciliación</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "#9a3412", margin: 0, lineHeight: 1.4 }}>
                    {pending?.source_worker_name
                      ? `En el archivo figura relacionado con ${pending.source_worker_name} (Mat. ${pending.source_employee_number || "S/N"}).`
                      : "Este casillero tiene discrepancias entre el padrón y el archivo de importación."}
                  </p>
                  <div>
                    <Link
                      href={`/representacion/lockers?view=pending&q=${encodeURIComponent(locker.locker_number)}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Button variant="secondary" size="sm">
                        Resolver en Asistente de Conciliación →
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Ficha de Identificación Física y Ubicación */}
              <div
                style={{
                  backgroundColor: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  fontSize: "0.8125rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem" }}>
                    Identificación Física y Ubicación
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      backgroundColor: condColor.bg,
                      color: condColor.fg,
                    }}
                  >
                    {condColor.label}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <div>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Código / Placa:</span>
                    <div style={{ fontWeight: 700, color: "var(--fg)", fontFamily: "monospace" }}>
                      {locker.physical_code || "Sin código de placa"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Zona:</span>
                    <div style={{ fontWeight: 700, color: "var(--fg)" }}>
                      {locker.zone?.name || locker.location || "Sin ubicar"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Mueble / Banco:</span>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {locker.bank?.name || "Sin mueble"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Posición en mueble:</span>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {locker.position_label
                        ? locker.position_label
                        : locker.row_position
                        ? `Fila ${locker.row_position}, Col. ${locker.column_position ?? "-"}`
                        : "No especificada"}
                    </div>
                  </div>
                </div>

                {locker.maintenance_reason ? (
                  <div style={{ marginTop: "0.25rem", color: "#92400e", fontSize: "0.75rem", backgroundColor: "#fffbeb", padding: "0.35rem 0.6rem", borderRadius: "0.25rem" }}>
                    <strong>Nota condición:</strong> {locker.maintenance_reason}
                  </div>
                ) : null}

                {locker.notes ? (
                  <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.75rem" }}>
                    <strong>Observaciones:</strong> {locker.notes}
                  </div>
                ) : null}
              </div>

              {/* Reserva Activa (si aplica) */}
              {locker.reserved_for_worker_id ? (
                <div
                  style={{
                    backgroundColor: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: "var(--radius)",
                    padding: "0.875rem 1rem",
                    fontSize: "0.8125rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div style={{ color: "#6b21a8", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                    ⏳ Casillero Reservado
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {locker.reserved_worker
                      ? `${locker.reserved_worker.first_name} ${locker.reserved_worker.paternal_surname} (Mat. ${locker.reserved_worker.employee_number})`
                      : "Trabajador reservado"}
                  </div>
                  {locker.reservation_reason ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Motivo: {locker.reservation_reason}
                    </div>
                  ) : null}
                  {locker.reserved_until ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Válida hasta: {formatDate(locker.reserved_until)}
                    </div>
                  ) : null}
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
                  Ocupante Actual
                </span>
                {worker ? (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--fg)" }}>
                      {worker.first_name} {worker.paternal_surname} {worker.maternal_surname ?? ""}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      Matrícula: <strong style={{ color: "var(--fg)" }}>{worker.employee_number}</strong>
                    </div>
                    {worker.category && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                        Categoría: {worker.category}
                      </div>
                    )}
                    {(worker.assignment || worker.turn) && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                        {[worker.assignment, worker.turn].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {locker.active_assignment?.assigned_at && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem", borderTop: "1px solid var(--border)", paddingTop: "0.35rem" }}>
                        Asignado desde: <strong>{formatDate(locker.active_assignment.assigned_at)}</strong>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                      <Link
                        href={`/representacion/trabajadores?q=${encodeURIComponent(worker.employee_number)}`}
                        style={{ textDecoration: "none" }}
                      >
                        <Button variant="secondary" size="sm">
                          Ver expediente de trabajador
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                    Sin trabajador asignado actualmente.
                  </p>
                )}
              </div>

              {/* Acciones de Gestión Física y Operativa */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "1rem",
                  backgroundColor: "var(--accent)",
                  borderRadius: "var(--radius)",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Acciones de Inventario Físico
                </span>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {/* Editar ficha / Renumerar */}
                  {onOpenEdit ? (
                    <Button variant="secondary" size="sm" onClick={() => onOpenEdit(locker)}>
                      ✏️ Editar datos / Renumerar
                    </Button>
                  ) : null}

                  {/* Asignación y liberación */}
                  {isAvailable && (
                    <Button variant="primary" size="sm" onClick={() => onOpenAssign(locker)}>
                      Asignar a trabajador
                    </Button>
                  )}

                  {isAssigned && locker.active_assignment && (
                    <>
                      {onOpenMove && (
                        <Button variant="secondary" size="sm" onClick={() => onOpenMove(locker)}>
                          Cambiar de casillero
                        </Button>
                      )}
                      {isAdmin && onOpenSwap && (
                        <Button variant="secondary" size="sm" onClick={() => onOpenSwap(locker)}>
                          Intercambiar (Swap)
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenRelease(locker.active_assignment!.id, locker.locker_number)}
                        style={{ color: "#dc2626" }}
                      >
                        Liberar casillero
                      </Button>
                    </>
                  )}

                  {/* Archivar / Reactivar */}
                  {onOpenArchive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenArchive(locker)}
                      style={{ color: isArchived ? "#16a34a" : "#ea580c" }}
                    >
                      {isArchived ? "♻️ Reactivar casillero" : "📦 Retirar / Archivar"}
                    </Button>
                  ) : null}

                  {/* Eliminar definitivamente (solo admin) */}
                  {isAdmin && onOpenHardDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenHardDelete(locker)}
                      style={{ color: "#dc2626", fontWeight: 600 }}
                    >
                      🗑 Eliminar definitivamente
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Historial de asignaciones */}
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
                  Historial de Movimientos
                </span>
                {history.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
                    No hay movimientos registrados para este casillero.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "2px solid var(--border)", paddingLeft: "1rem" }}>
                    {history.map((record) => (
                      <div key={record.id} style={{ position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: "-1.35rem",
                            top: "0.25rem",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: record.status === "active" ? "#2563eb" : "#94a3b8",
                          }}
                        />
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(record.assigned_at)}
                        </div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                          {record.worker
                            ? `${record.worker.first_name} ${record.worker.paternal_surname} (Mat. ${record.worker.employee_number})`
                            : "Trabajador no especificado"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: record.status === "active" ? "#16a34a" : "var(--muted)" }}>
                          {record.status === "active" ? "● Asignación activa" : `Liberado: ${record.release_reason || "Sin motivo"}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
