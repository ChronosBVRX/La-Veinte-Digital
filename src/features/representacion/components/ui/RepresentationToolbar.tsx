"use client";

import type { ReactNode } from "react";

export interface RepresentationToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  sort?: ReactNode;
  actions?: ReactNode;
  activeChips?: ReactNode;
  resultsInfo?: ReactNode;
  onClearAll?: () => void;
  hasActiveFilters?: boolean;
}

export function RepresentationToolbar({
  search,
  filters,
  sort,
  actions,
  activeChips,
  resultsInfo,
  onClearAll,
  hasActiveFilters = false,
}: RepresentationToolbarProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", width: "100%" }}>
      {/* Controles principales de toolbar */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          alignItems: "center",
          width: "100%",
        }}
      >
        {search ? (
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            {search}
          </div>
        ) : null}

        {filters ? <div style={{ flexShrink: 0 }}>{filters}</div> : null}
        {sort ? <div style={{ flexShrink: 0 }}>{sort}</div> : null}
        {actions ? <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>{actions}</div> : null}

        {hasActiveFilters && onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              whiteSpace: "nowrap",
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {/* Chips de filtros activos */}
      {activeChips ? <div>{activeChips}</div> : null}

      {/* Fila de información de resultados / paginación rápida */}
      {resultsInfo ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.8125rem",
            color: "var(--muted)",
            minHeight: "1.25rem",
          }}
        >
          {resultsInfo}
        </div>
      ) : null}
    </div>
  );
}
