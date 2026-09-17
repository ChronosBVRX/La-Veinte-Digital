"use client";

import { useState } from "react";
import type { PreviewRow, RowStatus } from "../../services/worker-importer/types";
import { Input } from "@/shared/components/ui/Input";
import { Button } from "@/shared/components/ui/Button";

interface ImportDiffTableProps {
  rows: PreviewRow[];
  resolutions?: Record<number, Record<string, string>>;
  onResolveField?: (rowNumber: number, field: string, choice: "keep" | "excel") => void;
  onResolveAction?: (rowNumber: number, action: "resolve" | "skip") => void;
}

type FilterCategory = "all" | "new" | "update" | "conflict" | "invalid" | "lockers" | "unchanged";

export function ImportDiffTable({
  rows,
  resolutions = {},
  onResolveField,
  onResolveAction,
}: ImportDiffTableProps): React.JSX.Element {
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filtered = rows.filter((r) => {
    // Categoría de filtro
    if (filter === "new" && r.status !== "new") return false;
    if (filter === "update" && r.status !== "updated") return false;
    if (filter === "conflict" && r.status !== "conflict") return false;
    if (filter === "invalid" && r.status !== "invalid") return false;
    if (filter === "unchanged" && r.status !== "unchanged") return false;
    if (filter === "lockers") {
      const hasLocker = Boolean(r.lockerExcel || r.lockerCurrent || r.diff?.lockerChange);
      if (!hasLocker) return false;
    }

    // Buscador por nombre, matrícula o locker
    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      const matchMat = r.matricula.toLowerCase().includes(q);
      const matchNom = r.fullName.toLowerCase().includes(q);
      const matchLoc =
        (r.lockerExcel && r.lockerExcel.toLowerCase().includes(q)) ||
        (r.lockerCurrent && r.lockerCurrent.toLowerCase().includes(q));
      const matchCat = r.category && r.category.toLowerCase().includes(q);
      if (!matchMat && !matchNom && !matchLoc && !matchCat) return false;
    }

    return true;
  });

  function getStatusBadge(status: RowStatus): { label: string; bg: string; fg: string } {
    switch (status) {
      case "new":
        return { label: "Nuevo", bg: "#dcfce7", fg: "#15803d" };
      case "updated":
        return { label: "Actualizar", bg: "#dbeafe", fg: "#1d4ed8" };
      case "unchanged":
        return { label: "Sin cambios", bg: "#f1f5f9", fg: "#475569" };
      case "warning":
        return { label: "Revisar", bg: "#fef9c3", fg: "#a16207" };
      case "invalid":
        return { label: "Inválido", bg: "#fee2e2", fg: "#b91c1c" };
      case "conflict":
        return { label: "Conflicto", bg: "#f3e8ff", fg: "#7e22ce" };
      case "ignored":
        return { label: "Ignorado", bg: "#f3f4f6", fg: "#6b7280" };
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Controles: Filtros y Buscador */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {(
            [
              { id: "all", label: `Todos (${rows.length})` },
              { id: "new", label: "Nuevos" },
              { id: "update", label: "Actualizaciones" },
              { id: "conflict", label: "Conflictos" },
              { id: "lockers", label: "Lockers" },
              { id: "invalid", label: "Inválidos" },
              { id: "unchanged", label: "Sin cambios" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.625rem",
                borderRadius: "0.25rem",
                border: "1px solid var(--border)",
                backgroundColor: filter === f.id ? "var(--fg)" : "var(--card)",
                color: filter === f.id ? "var(--bg)" : "var(--fg)",
                cursor: "pointer",
                fontWeight: filter === f.id ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ width: "240px" }}>
          <Input
            placeholder="Buscar por nombre, matrícula o locker…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* VISTA DESKTOP: Tabla comparativa */}
      <div className="desktop-only" style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.375rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--accent)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.625rem" }}>Estado</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Matrícula</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Trabajador</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Categoría</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Turno</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Locker actual</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Locker Excel</th>
              <th style={{ padding: "0.5rem 0.625rem" }}>Cambios</th>
              <th style={{ padding: "0.5rem 0.625rem", textAlign: "right" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 150).map((r) => {
              const badge = getStatusBadge(r.status);
              const isExpanded = expandedRow === r.rowNumber;
              const hasDiff = (r.diff?.changes && r.diff.changes.length > 0) || r.diff?.lockerChange || r.diff?.conflictReason;
              const rowRes = resolutions[r.rowNumber] || {};
              const isSkipped = rowRes.action === "skip";

              return (
                <tr
                  key={r.rowNumber}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: isExpanded ? "var(--accent)" : undefined,
                    opacity: isSkipped ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: "0.5rem 0.625rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        backgroundColor: isSkipped ? "#e5e7eb" : badge.bg,
                        color: isSkipped ? "#374151" : badge.fg,
                      }}
                    >
                      {isSkipped ? "Omitido" : badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem", fontFamily: "monospace", fontWeight: 600 }}>
                    {r.matricula || "-"}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 500 }}>
                    {r.fullName || "-"}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem" }}>{r.category || "-"}</td>
                  <td style={{ padding: "0.5rem 0.625rem" }}>{r.turn || "-"}</td>
                  <td style={{ padding: "0.5rem 0.625rem" }}>
                    {r.lockerCurrent ? `Locker ${r.lockerCurrent}` : "-"}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem" }}>
                    {r.lockerExcel ? (
                      <span style={{ fontWeight: 600, color: r.lockerCurrent !== r.lockerExcel ? "var(--primary)" : undefined }}>
                        {r.lockerExcel}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem" }}>
                    {r.diff?.lockerChange?.action === "change_assignment" ? (
                      <span style={{ color: "#2563eb", fontWeight: 600 }}>
                        {r.diff.lockerChange.currentLocker} → {r.diff.lockerChange.excelLocker}
                      </span>
                    ) : r.diff?.changes && r.diff.changes.length > 0 ? (
                      <span>{r.diff.changes.length} cambio(s)</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem", textAlign: "right" }}>
                    {hasDiff || r.status === "conflict" ? (
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : r.rowNumber)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Ocultar" : "Revisar"}
                      </button>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VISTA MOBILE: Cards */}
      <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filtered.slice(0, 100).map((r) => {
          const badge = getStatusBadge(r.status);
          const isExpanded = expandedRow === r.rowNumber;
          const rowRes = resolutions[r.rowNumber] || {};
          const isSkipped = rowRes.action === "skip";

          return (
            <div
              key={r.rowNumber}
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                opacity: isSkipped ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>{r.fullName || "Sin nombre"}</h4>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                    Matrícula: {r.matricula || "S/M"}
                  </span>
                </div>
                <span
                  style={{
                    padding: "0.125rem 0.375rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    backgroundColor: isSkipped ? "#e5e7eb" : badge.bg,
                    color: isSkipped ? "#374151" : badge.fg,
                  }}
                >
                  {isSkipped ? "Omitido" : badge.label}
                </span>
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--fg)", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                <span><strong>Categoría:</strong> {r.category || "-"}</span>
                <span><strong>Turno:</strong> {r.turn || "-"}</span>
                {r.diff?.lockerChange ? (
                  <span>
                    <strong>Locker:</strong>{" "}
                    {r.diff.lockerChange.action === "change_assignment"
                      ? `${r.diff.lockerChange.currentLocker} → ${r.diff.lockerChange.excelLocker}`
                      : r.diff.lockerChange.excelLocker}
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: "0.25rem", display: "flex", justifyContent: "flex-end" }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setExpandedRow(isExpanded ? null : r.rowNumber)}
                >
                  {isExpanded ? "Ocultar" : "Revisar cambios"}
                </Button>
              </div>

              {isExpanded ? (
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--border)" }}>
                  <RowConflictResolutionPanel
                    row={r}
                    resolution={rowRes}
                    onResolveField={onResolveField}
                    onResolveAction={onResolveAction}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Panel expandido para desktop si está abierto */}
      {expandedRow !== null ? (
        <div className="desktop-only">
          {(() => {
            const r = rows.find((row) => row.rowNumber === expandedRow);
            if (!r) return null;
            const rowRes = resolutions[r.rowNumber] || {};
            return (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  marginTop: "0.25rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.875rem" }}>
                    Resolución y comparación para fila #{r.rowNumber} ({r.fullName})
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedRow(null)}>
                    Cerrar
                  </Button>
                </div>
                <RowConflictResolutionPanel
                  row={r}
                  resolution={rowRes}
                  onResolveField={onResolveField}
                  onResolveAction={onResolveAction}
                />
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

interface ResolutionPanelProps {
  row: PreviewRow;
  resolution: Record<string, string>;
  onResolveField?: (rowNumber: number, field: string, choice: "keep" | "excel") => void;
  onResolveAction?: (rowNumber: number, action: "resolve" | "skip") => void;
}

function RowConflictResolutionPanel({
  row,
  resolution,
  onResolveField,
  onResolveAction,
}: ResolutionPanelProps): React.JSX.Element {
  const isConflict = row.status === "conflict";
  const changes = row.diff?.changes ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem" }}>
      {row.diff?.conflictReason ? (
        <div
          role="alert"
          style={{
            padding: "0.5rem",
            borderRadius: "0.25rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
          }}
        >
          <strong>Motivo de conflicto:</strong> {row.diff.conflictReason}
        </div>
      ) : null}

      {changes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <strong>Discrepancias detectadas:</strong>
          {changes.map((c) => {
            const fieldChoice = resolution[c.field] ?? "excel";
            return (
              <div
                key={c.field}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.375rem",
                  backgroundColor: "var(--accent)",
                  borderRadius: "0.25rem",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{c.label}:</span>{" "}
                  <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>
                    {c.oldValue || "(vacío)"}
                  </span>{" "}
                  → <span style={{ fontWeight: 600, color: "var(--primary)" }}>{c.newValue || "(vacío)"}</span>
                </div>
                {onResolveField ? (
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <Button
                      size="sm"
                      variant={fieldChoice === "keep" ? "primary" : "secondary"}
                      onClick={() => onResolveField(row.rowNumber, c.field, "keep")}
                    >
                      Mantener actual
                    </Button>
                    <Button
                      size="sm"
                      variant={fieldChoice === "excel" ? "primary" : "secondary"}
                      onClick={() => onResolveField(row.rowNumber, c.field, "excel")}
                    >
                      Usar Excel
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {isConflict && onResolveAction ? (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
          <span>¿Cómo proceder con esta fila en conflicto?</span>
          <Button
            size="sm"
            variant={resolution.action === "skip" ? "primary" : "secondary"}
            onClick={() => onResolveAction(row.rowNumber, "skip")}
          >
            Omitir fila
          </Button>
          <Button
            size="sm"
            variant={resolution.action === "resolve" ? "primary" : "secondary"}
            onClick={() => onResolveAction(row.rowNumber, "resolve")}
          >
            Resolver y aplicar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
