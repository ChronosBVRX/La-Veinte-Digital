"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import type { LockerZone, LockerBank } from "@/features/representacion/lib/lockers";

export function LockerToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  inventoryFilter = "active",
  onInventoryChange,
  conditionFilter = "all",
  onConditionChange,
  locationFilter = "all",
  onLocationChange,
  zoneFilter = "all",
  onZoneChange,
  bankFilter: _bankFilter,
  onBankChange: _onBankChange,
  zones = [],
  banks: _banks,
  onOpenCreateModal,
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
  inventoryFilter?: string;
  onInventoryChange?: (inv: string) => void;
  conditionFilter?: string;
  onConditionChange?: (cond: string) => void;
  locationFilter?: string;
  onLocationChange?: (loc: string) => void;
  zoneFilter?: string;
  onZoneChange?: (zone: string) => void;
  bankFilter?: string;
  onBankChange?: (bank: string) => void;
  zones?: LockerZone[];
  banks?: LockerBank[];
  onOpenCreateModal?: () => void;
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

  const selectStyle: React.CSSProperties = {
    minHeight: 40,
    padding: "0.5rem 1.75rem 0.5rem 0.75rem",
    borderRadius: "0.375rem",
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
    fontSize: "0.8125rem",
    fontWeight: 500,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "0.875rem 1rem",
      }}
    >
      {/* Fila 1: Buscador + Botón Agregar Locker */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Buscador unificado con debounce */}
        <div style={{ flex: "1 1 280px", minWidth: "220px", position: "relative" }}>
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

        {/* Botón Primario + Agregar Locker */}
        {onOpenCreateModal ? (
          <Button
            variant="primary"
            onClick={onOpenCreateModal}
            style={{ minHeight: 40, whiteSpace: "nowrap" }}
          >
            + Agregar locker
          </Button>
        ) : null}
      </div>

      {/* Fila 2: Multifiltros combinados de Inventario */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Filtro Inventario: Activos / Archivados / Todos */}
        {onInventoryChange ? (
          <select
            aria-label="Filtrar por estado en inventario"
            value={inventoryFilter}
            onChange={(e) => onInventoryChange(e.target.value)}
            style={selectStyle}
          >
            <option value="active">Inventario: Activos</option>
            <option value="archived">Inventario: Archivados</option>
            <option value="all">Inventario: Todos</option>
          </select>
        ) : null}

        {/* Filtro de Estado de Ocupación */}
        <select
          id="locker-status-filter"
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Estado: Todos</option>
          <option value="available">Disponibles</option>
          <option value="assigned">Asignados</option>
          <option value="reserved">Reservados</option>
          <option value="pending">Por revisar</option>
          <option value="maintenance">En mantenimiento</option>
          <option value="blocked">Bloqueados</option>
        </select>

        {/* Filtro Condición Física */}
        {onConditionChange ? (
          <select
            aria-label="Filtrar por condición física"
            value={conditionFilter}
            onChange={(e) => onConditionChange(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Condición: Todas</option>
            <option value="ok">Buen estado (OK)</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="blocked">Bloqueado / Clausurado</option>
          </select>
        ) : null}

        {/* Filtro Ubicación Física */}
        {onLocationChange ? (
          <select
            aria-label="Filtrar por ubicación"
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Ubicación: Todas</option>
            <option value="located">Ubicados en mapa</option>
            <option value="unlocated">Sin ubicar</option>
          </select>
        ) : null}

        {/* Filtro de Zona específica */}
        {onZoneChange && zones.length > 0 ? (
          <select
            aria-label="Filtrar por zona"
            value={zoneFilter}
            onChange={(e) => onZoneChange(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Zona: Todas</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        ) : null}

        {/* Selector de Orden */}
        <select
          aria-label="Ordenar por"
          value={sortOrder}
          onChange={(e) => onSortChange(e.target.value)}
          style={selectStyle}
        >
          <option value="number_asc">Número ↑ (1, 2, 3…)</option>
          <option value="number_desc">Número ↓ (100, 99…)</option>
          <option value="worker_asc">Trabajador (A–Z)</option>
          <option value="status">Estado</option>
          <option value="condition">Condición física</option>
        </select>

        {/* Tamaño de página */}
        <select
          aria-label="Registros por página"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={25}>25 por pág.</option>
          <option value={50}>50 por pág.</option>
          <option value={100}>100 por pág.</option>
        </select>

        {/* Botón de limpiar filtros */}
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
