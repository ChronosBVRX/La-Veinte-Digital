"use client";

import { CaretRight } from "@phosphor-icons/react";
import { getWorkerDisplayName } from "../WorkerPicker";
import type { WorkerDirectoryRow } from "../../services/worker-directory";
import { RepresentationListCard, RepresentationStatusBadge } from "../ui";

function formatSeniority(years: number | null): string | null {
  if (years === null || years === undefined) return null;
  if (years <= 0) return "Menos de 1 año";
  return `${years} ${years === 1 ? "año" : "años"} de antigüedad`;
}

export function WorkerCard({ worker, href }: { worker: WorkerDirectoryRow; href: string }): React.JSX.Element {
  const seniority = formatSeniority(worker.seniority_years);

  return (
    <RepresentationListCard href={href}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", overflowWrap: "anywhere", color: "var(--fg)" }}>
            {getWorkerDisplayName(worker)}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
            {worker.category || "Sin categoría"}
          </div>
        </div>
        <RepresentationStatusBadge status={worker.active ? "activo" : "inactivo"} size="sm" />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.375rem",
          alignItems: "center",
          marginTop: "0.25rem",
          fontSize: "0.8125rem",
          color: "var(--fg)",
        }}
      >
        <span style={{ fontWeight: 600 }}>{worker.turn || "Sin turno"}</span>
        {worker.assignment ? <span style={{ color: "var(--muted)" }}>· {worker.assignment}</span> : null}
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
        Matrícula {worker.employee_number}
        {seniority ? ` · ${seniority}` : ""}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.25rem",
          marginTop: "0.5rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--border)",
          color: "var(--primary)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          minHeight: 38,
        }}
      >
        Ver expediente
        <CaretRight size={14} weight="bold" />
      </div>
    </RepresentationListCard>
  );
}
