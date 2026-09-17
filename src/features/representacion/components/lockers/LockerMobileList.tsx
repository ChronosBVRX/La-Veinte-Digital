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
  loading = false,
}: {
  lockers: LockerItem[];
  onOpenDetail: (lockerId: string) => void;
  onOpenAssign: (locker: LockerItem) => void;
  onOpenRelease: (assignmentId: string, lockerNumber: string) => void;
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

        const workerName = worker
          ? `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim()
          : pending?.source_worker_name
            ? pending.source_worker_name
            : null;

        const employeeNum = worker?.employee_number ?? pending?.source_employee_number ?? null;

        return (
          <Card key={locker.id} padding="0.75rem 0.875rem">
            {/* Header: Número + Badge */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.375rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--fg)" }}>
                  Locker {locker.locker_number}
                </span>
                {locker.section ? (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sec. {locker.section}</span>
                ) : null}
              </div>
              <LockerStatusBadge status={locker.status} hasPending={Boolean(pending)} />
            </div>

            {/* Body: Información del trabajador o estado */}
            <div style={{ margin: "0.375rem 0 0.625rem", fontSize: "0.8125rem" }}>
              {worker ? (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--fg)" }}>{workerName}</div>
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
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onOpenDetail(locker.id)}
                style={{ flex: "1 1 auto", minHeight: 38 }}
              >
                Ver detalle
              </Button>

              {locker.status === "available" ? (
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

              {pending ? (
                <Link
                  href="/representacion/lockers/pendientes"
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
                  Revisar
                </Link>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
