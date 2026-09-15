"use client";

import Link from "next/link";
import { getWorkerDisplayName } from "../WorkerPicker";
import type { WorkerDirectoryRow } from "../../services/worker-directory";

function formatSeniority(years: number | null): string {
  if (years === null || years === undefined) return "—";
  if (years <= 0) return "< 1 año";
  return `${years} ${years === 1 ? "año" : "años"}`;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "0.5rem 0.625rem",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5625rem 0.625rem",
  fontSize: "0.8125rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

export function WorkerTable({
  workers,
  buildHref,
}: {
  workers: WorkerDirectoryRow[];
  buildHref: (workerId: string) => string;
}): React.JSX.Element {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--card)" }}>
      <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
        <caption className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Directorio de trabajadores
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>Nombre</th>
            <th scope="col" style={thStyle}>Categoría</th>
            <th scope="col" style={thStyle}>Turno</th>
            <th scope="col" style={thStyle}>Adscripción</th>
            <th scope="col" style={thStyle}>Matrícula</th>
            <th scope="col" style={thStyle}>Antigüedad</th>
            <th scope="col" style={{ ...thStyle, textAlign: "right" }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id} className="union-worker-row">
              <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 260 }}>
                <span style={{ overflowWrap: "anywhere" }}>{getWorkerDisplayName(w)}</span>
                {!w.active ? (
                  <span style={{ marginLeft: "0.375rem", fontSize: "0.6875rem", color: "var(--muted)" }}>· Inactivo</span>
                ) : null}
              </td>
              <td style={{ ...tdStyle, maxWidth: 220 }}>{w.category || "—"}</td>
              <td style={tdStyle}>{w.turn || "—"}</td>
              <td style={{ ...tdStyle, maxWidth: 220 }}>{w.assignment || "—"}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{w.employee_number}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatSeniority(w.seniority_years)}</td>
              <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                <Link
                  href={buildHref(w.id)}
                  style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}
                >
                  Ver expediente
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .union-worker-row:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}
