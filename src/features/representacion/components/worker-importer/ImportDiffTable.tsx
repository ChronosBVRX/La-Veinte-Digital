"use client";

import { useState } from "react";
import type { PreviewRow, RowStatus } from "../../services/worker-importer/types";
import { Input } from "@/shared/components/ui/Input";

interface ImportDiffTableProps {
  rows: PreviewRow[];
}

export function ImportDiffTable({ rows }: ImportDiffTableProps): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<RowStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchMatricula = r.matricula.toLowerCase().includes(q);
      const matchName = r.fullName.toLowerCase().includes(q);
      const matchCat = r.category.toLowerCase().includes(q);
      if (!matchMatricula && !matchName && !matchCat) return false;
    }
    return true;
  });

  function getStatusBadge(status: RowStatus): { label: string; bg: string; fg: string } {
    switch (status) {
      case "new":
        return { label: "Nuevo", bg: "#dcfce7", fg: "#15803d" };
      case "updated":
        return { label: "Modificado", bg: "#dbeafe", fg: "#1d4ed8" };
      case "unchanged":
        return { label: "Sin cambios", bg: "#f1f5f9", fg: "#475569" };
      case "warning":
        return { label: "Advertencia", bg: "#fef9c3", fg: "#a16207" };
      case "invalid":
        return { label: "Inválido", bg: "#fee2e2", fg: "#b91c1c" };
      case "conflict":
        return { label: "Conflicto", bg: "#f3e8ff", fg: "#7e22ce" };
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Controls: Search and Filter Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {(
            [
              { id: "all", label: `Todos (${rows.length})` },
              { id: "new", label: "Nuevos" },
              { id: "updated", label: "Modificados" },
              { id: "warning", label: "Advertencias" },
              { id: "conflict", label: "Conflictos" },
              { id: "invalid", label: "Inválidos" },
              { id: "unchanged", label: "Sin cambios" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid var(--border)",
                backgroundColor: statusFilter === filter.id ? "var(--fg)" : "var(--card)",
                color: statusFilter === filter.id ? "var(--bg)" : "var(--fg)",
                cursor: "pointer",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div style={{ width: "220px" }}>
          <Input
            placeholder="Buscar por matrícula o nombre…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.375rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--accent)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Fila</th>
              <th style={{ padding: "0.5rem" }}>Estado</th>
              <th style={{ padding: "0.5rem" }}>Matrícula</th>
              <th style={{ padding: "0.5rem" }}>Nombre del Trabajador</th>
              <th style={{ padding: "0.5rem" }}>Categoría</th>
              <th style={{ padding: "0.5rem" }}>Plaza</th>
              <th style={{ padding: "0.5rem" }}>RFC (Parcial)</th>
              <th style={{ padding: "0.5rem" }}>CURP (Parcial)</th>
              <th style={{ padding: "0.5rem" }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((r) => {
              const badge = getStatusBadge(r.status);
              const isExpanded = expandedRow === r.rowNumber;
              const hasDetails = (r.diff?.changes && r.diff.changes.length > 0) || r.issues.length > 0 || r.diff?.conflictReason;

              return (
                <tr
                  key={r.rowNumber}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: isExpanded ? "var(--accent)" : undefined,
                  }}
                >
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>{r.rowNumber}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.35rem",
                        borderRadius: "0.2rem",
                        backgroundColor: badge.bg,
                        color: badge.fg,
                        fontWeight: 600,
                        fontSize: "0.6875rem",
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem", fontWeight: 600 }}>{r.matricula}</td>
                  <td style={{ padding: "0.5rem" }}>{r.fullName}</td>
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>{r.category || "—"}</td>
                  <td style={{ padding: "0.5rem" }}>{r.plaza || "—"}</td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{r.maskedRfc || "—"}</td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{r.maskedCurp || "—"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {hasDetails ? (
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : r.rowNumber)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          padding: 0,
                        }}
                      >
                        {isExpanded ? "Ocultar ▲" : "Ver cambios ▼"}
                      </button>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 100 ? (
        <p style={{ fontSize: "0.6875rem", color: "var(--muted)", margin: 0, textAlign: "center" }}>
          Mostrando los primeros 100 de {filtered.length} registros coincidentes.
        </p>
      ) : null}

      {/* Expanded Detail Panel */}
      {expandedRow !== null ? (() => {
        const row = rows.find((r) => r.rowNumber === expandedRow);
        if (!row) return null;

        return (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--accent)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>
                Detalle de fila {row.rowNumber} · Matrícula {row.matricula} ({row.fullName})
              </span>
              <button
                type="button"
                onClick={() => setExpandedRow(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕ Cerrar
              </button>
            </div>

            {row.diff?.conflictReason ? (
              <div
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "#faf5ff",
                  border: "1px solid #d8b4fe",
                  color: "#6b21a8",
                }}
              >
                <strong>Motivo del conflicto:</strong> {row.diff.conflictReason}
              </div>
            ) : null}

            {row.diff?.changes && row.diff.changes.length > 0 ? (
              <div>
                <strong>Modificaciones detectadas:</strong>
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem" }}>
                  {row.diff.changes.map((c, i) => (
                    <li key={i}>
                      <strong>{c.label}:</strong>{" "}
                      <span style={{ textDecoration: "line-through", color: "#dc2626" }}>
                        {c.oldValue || "[Vacío]"}
                      </span>{" "}
                      →{" "}
                      <span style={{ fontWeight: 600, color: "#16a34a" }}>
                        {c.newValue || "[Vacío]"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {row.issues.length > 0 ? (
              <div>
                <strong>Observaciones / Advertencias:</strong>
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem" }}>
                  {row.issues.map((issue, idx) => (
                    <li
                      key={idx}
                      style={{
                        color: issue.severity === "error" ? "#dc2626" : "#ca8a04",
                      }}
                    >
                      [{issue.severity.toUpperCase()}] {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })() : null}
    </div>
  );
}
