"use client";

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { getWorkerDisplayName } from "../WorkerPicker";
import type { WorkerDirectoryRow } from "../../services/worker-directory";

function formatSeniority(years: number | null): string | null {
  if (years === null || years === undefined) return null;
  if (years <= 0) return "Menos de 1 año";
  return `${years} ${years === 1 ? "año" : "años"} de antigüedad`;
}

export function WorkerCard({ worker, href }: { worker: WorkerDirectoryRow; href: string }): React.JSX.Element {
  const seniority = formatSeniority(worker.seniority_years);

  return (
    <Link
      href={href}
      className="pressable"
      style={{
        display: "block",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "0.75rem 0.875rem",
        textDecoration: "none",
        color: "var(--fg)",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", overflowWrap: "anywhere" }}>
            {getWorkerDisplayName(worker)}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
            {worker.category || "Sin categoría"}
          </div>
        </div>
        {!worker.active ? (
          <span
            style={{
              flexShrink: 0,
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "var(--accent)",
              color: "var(--muted)",
              borderRadius: 999,
              padding: "0.125rem 0.5rem",
            }}
          >
            INACTIVO
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: "0.8125rem", color: "var(--fg)", marginTop: "0.5rem", overflowWrap: "anywhere" }}>
        {worker.turn || "Sin turno"}
        {worker.assignment ? ` · ${worker.assignment}` : ""}
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
          color: "var(--primary)",
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        Ver expediente
        <CaretRight size={14} weight="bold" />
      </div>
    </Link>
  );
}
