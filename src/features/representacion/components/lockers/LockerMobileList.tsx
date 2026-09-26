"use client";

import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { LockerStatusBadge } from "./LockerStatusBadge";
import type { LockerItem } from "./LockerDesktopTable";

export function LockerMobileList({
  lockers,
  onOpenDetail,
  onOpenAssign,
  onOpenRelease,
  onOpenEdit,
  onOpenArchive,
  loading = false,
}: {
  lockers: LockerItem[];
  onOpenDetail: (lockerId: string) => void;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
  onOpenEdit?: (locker: LockerItem) => void;
  onOpenArchive?: (locker: LockerItem) => void;
  loading?: boolean;
}): React.JSX.Element {
  if (loading && lockers.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }} aria-busy="true" aria-label="Cargando casilleros…">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              height: "90px",
              backgroundColor: "var(--accent)",
              borderRadius: "var(--radius)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {lockers.map((locker) => {
        const worker = locker.active_assignment?.union_workers;
        const pending = locker.pending_review_item;
        const isArchived = Boolean(locker.archived_at);

        const workerName = worker
          ? `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim()
          : pending?.source_worker_name
            ? pending.source_worker_name
            : null;

        const employeeNum = worker?.employee_number ?? pending?.source_employee_number ?? null;

        // Condición física badge
        const cond = locker.condition || "ok";
        const condColor =
          cond === "maintenance"
            ? { bg: "#fef3c7", fg: "#92400e", label: "Mantenimiento" }
            : cond === "blocked"
            ? { bg: "#fee2e2", fg: "#991b1b", label: "Bloqueado" }
            : { bg: "#f0fdf4", fg: "#166534", label: "OK" };

        const zoneName = locker.zone?.name || locker.location || null;
        const bankName = locker.bank?.name || null;

        return (
          <Card key={locker.id} padding="0.75rem 0.875rem">
            {/* Header: Número + Badges */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginBottom: "0.375rem",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--fg)" }}>
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
                  {locker.physical_code ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                      [{locker.physical_code}]
                    </span>
                  ) : null}
                </div>
                {zoneName ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                    📍 {zoneName} {bankName ? `· ${bankName}` : ""}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.35rem",
                    borderRadius: "999px",
                    backgroundColor: condColor.bg,
                    color: condColor.fg,
                  }}
                >
                  {condColor.label}
                </span>
                <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
              </div>
            </div>

            {/* Body: Información del trabajador o estado */}
            <div style={{ margin: "0.375rem 0 0.625rem", fontSize: "0.8125rem" }}>
              {worker ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>{workerName}</span>
                    {worker.source_import_state === "missing_in_source" ? (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          border: "1px solid #fde68a",
                        }}
                      >
                        ⚠️ No en SIAP
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    Matrícula {employeeNum}
                  </div>
                </div>
              ) : pending ? (
                <div style={{ color: "#9a3412" }}>
                  <div style={{ fontWeight: 600 }}>Persona en archivo:</div>
                  <div>{workerName} · Mat. {employeeNum ?? "Sin matrícula"}</div>
                </div>
              ) : (
                <div style={{ color: "var(--muted)" }}>Sin trabajador asignado</div>
              )}
            </div>

            {/* Actions: Botones táctiles accesibles (minHeight 38px) */}
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onOpenDetail(locker.id)}
                style={{ flex: "1 1 auto", minHeight: 38 }}
              >
                Ficha física
              </Button>

              {onOpenEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenEdit(locker)}
                  style={{ minHeight: 38 }}
                >
                  Editar
                </Button>
              ) : null}

              {locker.status === "available" || locker.status === "disponible" ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onOpenAssign(locker)}
                  style={{ flex: "1 1 auto", minHeight: 38 }}
                >
                  Asignar
                </Button>
              ) : null}

              {locker.active_assignment ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenRelease(locker.active_assignment!.id, locker.locker_number)}
                  style={{ color: "#dc2626", minHeight: 38 }}
                >
                  Liberar
                </Button>
              ) : null}

              {onOpenArchive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenArchive(locker)}
                  style={{ color: isArchived ? "#16a34a" : "#ea580c", minHeight: 38 }}
                >
                  {isArchived ? "Reactivar" : "Archivar"}
                </Button>
              ) : null}

              {pending ? (
                <Link
                  href={`/representacion/lockers?view=pending&q=${encodeURIComponent(locker.locker_number)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.35rem 0.625rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#c2410c",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    minHeight: 38,
                    flex: "1 1 auto",
                  }}
                >
                  Revisar incidencia
                </Link>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
