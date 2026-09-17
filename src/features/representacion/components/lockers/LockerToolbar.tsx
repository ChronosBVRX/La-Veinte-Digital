"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";

export function LockerToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortOrder,
  onSortChange,
  pageSize,
  onPageSizeChange,
  onResetFilters,
  hasActiveFilters,
  loading = false,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  sortOrder: string;
  onSortChange: (sort: string) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  loading?: boolean;
}): React.JSX.Element {
  const [localQ, setLocalQ] = useState(searchQuery);

  // Sincronizar localQ si searchQuery cambia externamente (ej. reset o query param)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local input with prop
    setLocalQ(searchQuery);
  }, [searchQuery]);

  // Debounce de 300ms para búsqueda automática sin bloquear UI
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQ !== searchQuery) {
        onSearchChange(localQ);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQ, searchQuery, onSearchChange]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "0.75rem 1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Buscador unificado con debounce */}
        <div style={{ flex: "1 1 260px", minWidth: "200px", position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.875rem",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            aria-label="Buscar por locker, matrícula o trabajador"
            placeholder="Buscar por locker, matrícula o trabajador…"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchChange(localQ);
              }
            }}
            style={{
              width: "100%",
              minHeight: 40,
              padding: "0.5rem 2rem 0.5rem 2.25rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg)",
              color: "var(--fg)",
              fontSize: "0.875rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {localQ ? (
            <button
              type="button"
              onClick={() => {
                setLocalQ("");
                onSearchChange("");
              }}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                fontSize: "1rem",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0.25rem",
                lineHeight: 1,
              }}
              aria-label="Limpiar campo de búsqueda"
            >
              ×
            </button>
          ) : null}
        </div>

        {/* Filtro de Estado 100% en español */}
        <div style={{ flex: "0 1 auto" }}>
          <label htmlFor="locker-status-filter" style={{ display: "none" }}>
            Filtrar por estado
          </label>
          <select
            id="locker-status-filter"
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{
              minHeight: 40,
              padding: "0.5rem 2rem 0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg)",
              color: "var(--fg)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <option value="all">Estado: Todos</option>
            <option value="available">Disponibles</option>
            <option value="assigned">Asignados</option>
            <option value="pending">Por revisar</option>
            <option value="maintenance">En mantenimiento</option>
            <option value="reserved">Reservados</option>
            <option value="blocked">Bloqueados</option>
          </select>
        </div>

        {/* Selector de Orden Natural */}
        <div style={{ flex: "0 1 auto" }}>
          <label htmlFor="locker-sort-order" style={{ display: "none" }}>
            Ordenar casilleros
          </label>
          <select
            id="locker-sort-order"
            aria-label="Ordenar por"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              minHeight: 40,
              padding: "0.5rem 2rem 0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg)",
              color: "var(--fg)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <option value="number_asc">Número ↑ (1, 2, 3…)</option>
            <option value="number_desc">Número ↓ (100, 99…)</option>
            <option value="worker_asc">Trabajador (A–Z)</option>
            <option value="status">Estado</option>
          </select>
        </div>

        {/* Tamaño de página */}
        <div style={{ flex: "0 1 auto" }}>
          <label htmlFor="locker-page-size" style={{ display: "none" }}>
            Elementos por página
          </label>
          <select
            id="locker-page-size"
            aria-label="Registros por página"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              minHeight: 40,
              padding: "0.5rem 1.75rem 0.5rem 0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg)",
              color: "var(--fg)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <option value={25}>25 por pág.</option>
            <option value={50}>50 por pág.</option>
          </select>
        </div>

        {/* Botón de limpiar filtros si hay búsqueda o filtro activo */}
        {hasActiveFilters ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onResetFilters}
            aria-label="Limpiar todos los filtros"
            style={{ whiteSpace: "nowrap", minHeight: 40 }}
          >
            Limpiar filtros
          </Button>
        ) : null}

        {/* Indicador sutil de carga */}
        {loading ? (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
            aria-live="polite"
          >
            Actualizando…
          </span>
        ) : null}
      </div>
    </div>
  );
}
