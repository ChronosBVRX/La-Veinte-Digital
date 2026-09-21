"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { RepresentationSectionHeader } from "../ui";

// Subcomponentes del módulo Lockers 2.0
import { LockerMetrics, type LockerMetricsData } from "./LockerMetrics";
import { LockerViewSwitcher, type LockerViewMode } from "./LockerViewSwitcher";
import { LockerZoneNavigator } from "./LockerZoneNavigator";
import { LockerZoneMap } from "./LockerZoneMap";
import { LockerQuickTooltip } from "./LockerQuickTooltip";
import { LockerDetailSheet } from "./LockerDetailSheet";
import { LockerAssignSheet } from "./LockerAssignSheet";
import { LockerReleaseModal } from "./LockerReleaseModal";
import { LockerMoveFlow } from "./LockerMoveFlow";
import { LockerSwapFlow } from "./LockerSwapFlow";
import { LockerZoneManager } from "./LockerZoneManager";
import { LockerBankEditor } from "./LockerBankEditor";
import { LockerIntegrityPanel } from "./LockerIntegrityPanel";
import { LockerAuditMode } from "./LockerAuditMode";

// Subcomponentes de Vistas Secundarias
import { LockerToolbar } from "./LockerToolbar";
import { LockerDesktopTable, type LockerItem } from "./LockerDesktopTable";
import { LockerMobileList } from "./LockerMobileList";
import { LockerCreateModal } from "./LockerCreateModal";
import { LockerEditModal } from "./LockerEditModal";
import { LockerArchiveModal } from "./LockerArchiveModal";
import { LockerHardDeleteModal } from "./LockerHardDeleteModal";
import { LockerBulkToolbar } from "./LockerBulkToolbar";
import { LockerPendingReviewList } from "../LockerPendingReviewList";
import { WaitlistPanel } from "../WaitlistPanel";

// Dominio y Contratos
import type { LockerZone, LockerBank, LockerMapItem, LockerMapResponse, LockerMapSummary } from "@/features/representacion/lib/lockers";

export interface LockerControlCenterProps {
  isAdmin?: boolean;
}

export function LockerControlCenter({ isAdmin = false }: LockerControlCenterProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // 1. Sincronización de Estado con URL
  const viewParam = searchParams.get("view");
  const initialView = (viewParam === "inventory" ? "table" : (viewParam as LockerViewMode)) || "map";
  const initialZone = searchParams.get("zone") || "all";
  const initialLockerParam = searchParams.get("locker") || null;
  const initialQ = searchParams.get("q") || "";
  const initialStatus = searchParams.get("status") || "all";
  const initialInventory = searchParams.get("inventory") || "active";
  const initialCondition = searchParams.get("condition") || "all";
  const initialLocation = searchParams.get("location") || "all";
  const initialSort = searchParams.get("sort") || "number_asc";
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const initialPageSize = parseInt(searchParams.get("pageSize") ?? "25", 10) || 25;

  const [currentView, setCurrentView] = useState<LockerViewMode>(initialView);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialZone);
  const [searchQuery, setSearchQuery] = useState<string>(initialQ);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [inventoryFilter, setInventoryFilter] = useState<string>(initialInventory);
  const [conditionFilter, setConditionFilter] = useState<string>(initialCondition);
  const [locationFilter, setLocationFilter] = useState<string>(initialLocation);
  const [sortOrder, setSortOrder] = useState<string>(initialSort);
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [selectedLockerIds, setSelectedLockerIds] = useState<string[]>([]);

  // Estados de modales de gestión física de inventario
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [lockerToEdit, setLockerToEdit] = useState<LockerItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [lockerToArchive, setLockerToArchive] = useState<LockerItem | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [lockerToDelete, setLockerToDelete] = useState<LockerItem | null>(null);
  const [isHardDeleteOpen, setIsHardDeleteOpen] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // 2. Datos del Mapa Físico
  const [zones, setZones] = useState<LockerZone[]>([]);
  const [banks, setBanks] = useState<LockerBank[]>([]);
  const [mapLockers, setMapLockers] = useState<LockerMapItem[]>([]);
  const [mapSummary, setMapSummary] = useState<LockerMapSummary | null>(null);
  const [unlocatedCount, setUnlocatedCount] = useState<number>(0);
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);
  const [waitlistCount, setWaitlistCount] = useState<number>(0);
  const [integrityIssuesCount, setIntegrityIssuesCount] = useState<number>(0);
  const [loadingMap, setLoadingMap] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // 3. Datos de la Tabla (vista "table")
  const [tableLockers, setTableLockers] = useState<LockerItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalFiltered, setTotalFiltered] = useState<number>(0);
  const [loadingTable, setLoadingTable] = useState<boolean>(false);

  // 4. Interacciones del Mapa: Tooltips y Destaques
  const [hoveredLocker, setHoveredLocker] = useState<LockerMapItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [highlightedLockerId, setHighlightedLockerId] = useState<string | null>(null);

  // 5. Modales y Paneles
  const [detailLockerId, setDetailLockerId] = useState<string | null>(initialLockerParam);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(Boolean(initialLockerParam));

  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [assignTargetLocker, setAssignTargetLocker] = useState<LockerItem | null>(null);

  const [isReleaseOpen, setIsReleaseOpen] = useState<boolean>(false);
  const [releaseTarget, setReleaseTarget] = useState<{ assignmentId: string; lockerNumber: string } | null>(null);
  const [releasing, setReleasing] = useState<boolean>(false);

  const [isMoveOpen, setIsMoveOpen] = useState<boolean>(false);
  const [moveSourceLocker, setMoveSourceLocker] = useState<LockerMapItem | null>(null);

  const [isSwapOpen, setIsSwapOpen] = useState<boolean>(false);
  const [swapSourceLocker, setSwapSourceLocker] = useState<LockerMapItem | null>(null);

  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState<boolean>(false);
  const [bankToEdit, setBankToEdit] = useState<LockerBank | null>(null);
  const [isBankEditorOpen, setIsBankEditorOpen] = useState<boolean>(false);

  const [showIntegrityPanel, setShowIntegrityPanel] = useState<boolean>(false);

  // Sincronizar parámetros en URL sin recargar
  const updateUrlParams = useCallback(
    (newParams: {
      view?: LockerViewMode;
      zone?: string;
      locker?: string | null;
      q?: string;
      status?: string;
      inventory?: string;
      condition?: string;
      location?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newParams.view !== undefined) {
        if (newParams.view !== "map") params.set("view", newParams.view);
        else params.delete("view");
      }
      if (newParams.zone !== undefined) {
        if (newParams.zone !== "all") params.set("zone", newParams.zone);
        else params.delete("zone");
      }
      if (newParams.locker !== undefined) {
        if (newParams.locker) params.set("locker", newParams.locker);
        else params.delete("locker");
      }
      if (newParams.q !== undefined) {
        if (newParams.q) params.set("q", newParams.q);
        else params.delete("q");
      }
      if (newParams.status !== undefined) {
        if (newParams.status !== "all") params.set("status", newParams.status);
        else params.delete("status");
      }
      if (newParams.inventory !== undefined) {
        if (newParams.inventory !== "active") params.set("inventory", newParams.inventory);
        else params.delete("inventory");
      }
      if (newParams.condition !== undefined) {
        if (newParams.condition !== "all") params.set("condition", newParams.condition);
        else params.delete("condition");
      }
      if (newParams.location !== undefined) {
        if (newParams.location !== "all") params.set("location", newParams.location);
        else params.delete("location");
      }
      if (newParams.sort !== undefined) {
        if (newParams.sort !== "number_asc") params.set("sort", newParams.sort);
        else params.delete("sort");
      }
      if (newParams.page !== undefined) {
        if (newParams.page > 1) params.set("page", String(newParams.page));
        else params.delete("page");
      }
      if (newParams.pageSize !== undefined) {
        if (newParams.pageSize !== 25) params.set("pageSize", String(newParams.pageSize));
        else params.delete("pageSize");
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  // 6. Carga de datos del Mapa Físico
  const loadMapData = useCallback(async (): Promise<void> => {
    setLoadingMap(true);
    setMapError(null);
    try {
      const res = await fetch(`/api/union/lockers/map?zone_id=all`, { cache: "no-store" });
      const data = (await res.json()) as LockerMapResponse;

      if (!res.ok) throw new Error(data.error || "No se pudo cargar el mapa de casilleros");

      setZones(data.zones ?? []);
      setBanks(data.banks ?? []);
      setMapLockers(data.lockers ?? []);
      if (data.summary) {
        setMapSummary(data.summary);
      }
      setUnlocatedCount(data.summary?.unlocated ?? data.counts?.unlocated ?? 0);
      setPendingReviewCount(data.summary?.pendingReview ?? data.counts?.pending_review ?? 0);
      if (data.summary?.waitlist !== undefined) {
        setWaitlistCount(data.summary.waitlist);
      }
      setIntegrityIssuesCount(data.summary?.integrityIssues ?? data.integrity_issues_count ?? 0);
    } catch (err: unknown) {
      setMapError(err instanceof Error ? err.message : "Error al cargar casilleros");
    } finally {
      setLoadingMap(false);
    }
  }, []);

  // 7. Carga de la lista de espera (recuento)
  const loadWaitlistCount = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/union/waitlist", { cache: "no-store" });
      const j = (await res.json()) as { waitlist?: unknown[] };
      if (res.ok && j.waitlist) {
        setWaitlistCount(j.waitlist.length);
      }
    } catch {
      // no-op
    }
  }, []);

  // 8. Carga de datos del Inventario Físico / Tabla
  const loadTableData = useCallback(async (): Promise<void> => {
    if (currentView !== "table") return;
    setLoadingTable(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (inventoryFilter !== "all") params.set("inventory", inventoryFilter);
      if (conditionFilter !== "all") params.set("condition", conditionFilter);
      if (locationFilter !== "all") params.set("location", locationFilter);
      if (selectedZoneId !== "all") params.set("zone", selectedZoneId);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (sortOrder) params.set("sort", sortOrder);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/union/lockers?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as {
        lockers?: LockerItem[];
        pagination?: { total: number; page: number; pageSize: number; totalPages: number };
      };
      if (res.ok) {
        setTableLockers(j.lockers ?? []);
        if (j.pagination) {
          setTotalPages(j.pagination.totalPages);
          setTotalFiltered(j.pagination.total);
        }
      }
    } finally {
      setLoadingTable(false);
    }
  }, [currentView, statusFilter, inventoryFilter, conditionFilter, locationFilter, selectedZoneId, searchQuery, sortOrder, page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetches on mount
    void loadMapData();
    void loadWaitlistCount();
  }, [loadMapData, loadWaitlistCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch table data when table tab or filters change
    void loadTableData();
  }, [loadTableData]);

  // Si se pasa ?locker=UUID al inicio, seleccionarlo y mostrar detalle
  useEffect(() => {
    if (initialLockerParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync url locker param into state
      setDetailLockerId(initialLockerParam);
      setIsDetailOpen(true);
      setHighlightedLockerId(initialLockerParam);
    }
  }, [initialLockerParam]);

  // Métricas canónicas para la barra superior (usando data.summary de la fuente de verdad)
  const metricsData: LockerMetricsData = useMemo(() => {
    if (mapSummary) {
      return {
        total: mapSummary.total,
        assigned: mapSummary.assigned,
        available: mapSummary.available,
        attention: mapSummary.affectedLockers ?? mapSummary.attention,
        maintenance: mapSummary.maintenance,
        unlocated: mapSummary.unlocated,
        waitlistCount: mapSummary.waitlist ?? waitlistCount,
        affectedLockers: mapSummary.affectedLockers,
        issueCount: mapSummary.issueCount ?? mapSummary.integrityIssues,
      };
    }
    const total = mapLockers.length;
    const assigned = mapLockers.filter((l) => l.effective_state.isAssigned || l.effective_state.kind === "assigned").length;
    const available = mapLockers.filter((l) => l.effective_state.isAvailable).length;
    const maintenance = mapLockers.filter((l) => l.condition === "maintenance" || (l.condition as string) === "damaged").length;
    const attention = integrityIssuesCount;

    return {
      total,
      assigned,
      available,
      attention,
      maintenance,
      unlocated: unlocatedCount,
      waitlistCount,
      affectedLockers: attention,
      issueCount: attention,
    };
  }, [mapSummary, mapLockers, integrityIssuesCount, unlocatedCount, waitlistCount]);

  // Manejo de cambio de vista
  function handleViewChange(newView: LockerViewMode): void {
    setCurrentView(newView);
    updateUrlParams({ view: newView });
  }

  // Manejo de cambio de zona
  function handleZoneSelect(zoneId: string): void {
    setSelectedZoneId(zoneId);
    updateUrlParams({ zone: zoneId });
  }

  // Manejo de búsqueda reactiva con brillo y auto-selección
  function handleSearchSubmit(query: string): void {
    setSearchQuery(query);
    updateUrlParams({ q: query });

    if (!query.trim()) {
      setHighlightedLockerId(null);
      return;
    }

    const cleanNum = query.replace(/^#/, "").trim();
    const normalize = (str: string): string => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normQ = normalize(cleanNum);

    // Buscar coincidencia en mapa
    const found = mapLockers.find((l) => {
      if (normalize(l.locker_number).includes(normQ)) return true;
      if (l.physical_code && normalize(l.physical_code).includes(normQ)) return true;
      if (l.occupant_name && normalize(l.occupant_name).includes(normQ)) return true;
      if (l.occupant_employee_number && normalize(l.occupant_employee_number).includes(normQ)) return true;
      if (l.active_assignment?.worker_name && normalize(l.active_assignment.worker_name).includes(normQ)) return true;
      if (l.active_assignment?.employee_number && normalize(l.active_assignment.employee_number).includes(normQ)) return true;
      if (l.pending_review?.source_worker_name && normalize(l.pending_review.source_worker_name).includes(normQ)) return true;
      if (l.pending_review?.source_employee_number && normalize(l.pending_review.source_employee_number).includes(normQ)) return true;
      return false;
    });

    if (found) {
      setHighlightedLockerId(found.id);
      if (found.zone_id) {
        setSelectedZoneId(found.zone_id);
        updateUrlParams({ zone: found.zone_id, locker: found.id });
      } else {
        setSelectedZoneId("unlocated");
        updateUrlParams({ zone: "unlocated", locker: found.id });
      }

      // Abrir detalle directamente
      setDetailLockerId(found.id);
      setIsDetailOpen(true);
    }
  }

  // Abrir detalle de casillero
  function handleLockerClick(locker: LockerMapItem): void {
    setDetailLockerId(locker.id);
    setIsDetailOpen(true);
    setHighlightedLockerId(locker.id);
    updateUrlParams({ locker: locker.id });
  }

  function handleCloseDetail(): void {
    setIsDetailOpen(false);
    setDetailLockerId(null);
    updateUrlParams({ locker: null });
  }

  // Hover Tooltip
  function handleLockerHover(e: React.MouseEvent<HTMLDivElement>, locker: LockerMapItem): void {
    setHoveredLocker(locker);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }

  function handleLockerLeave(): void {
    setHoveredLocker(null);
    setTooltipPosition(null);
  }

  // Operaciones atómicas
  function handleOpenAssignFromLocker(lockerItem?: LockerItem | LockerMapItem): void {
    if (lockerItem) {
      const itemAsMap = lockerItem as LockerMapItem;
      const itemAsTable = lockerItem as LockerItem;
      setAssignTargetLocker({
        id: lockerItem.id,
        locker_number: lockerItem.locker_number,
        location: itemAsTable.location || itemAsMap.zone_name || "",
        section: itemAsTable.section || itemAsMap.bank_name || "",
        status: lockerItem.status,
      });
    } else {
      setAssignTargetLocker(null);
    }
    setIsAssignOpen(true);
  }

  function handleOpenRelease(assignmentId: string, lockerNumber: string): void {
    setReleaseTarget({ assignmentId, lockerNumber });
    setIsReleaseOpen(true);
  }

  async function handleConfirmRelease(reason: string): Promise<void> {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release",
          assignment_id: releaseTarget.assignmentId,
          release_reason: reason,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "No se pudo liberar el casillero.");
      }
      setIsReleaseOpen(false);
      setReleaseTarget(null);
      void loadMapData();
      void loadTableData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al liberar casillero.");
    } finally {
      setReleasing(false);
    }
  }

  function handleOpenMove(locker: LockerItem | LockerMapItem): void {
    const mapItem = mapLockers.find((l) => l.id === locker.id) || (locker as LockerMapItem);
    setMoveSourceLocker(mapItem);
    setIsMoveOpen(true);
  }

  function handleOpenSwap(locker: LockerItem | LockerMapItem): void {
    const mapItem = mapLockers.find((l) => l.id === locker.id) || (locker as LockerMapItem);
    setSwapSourceLocker(mapItem);
    setIsSwapOpen(true);
  }

  async function handleSetStatus(
    lockerId: string,
    newStatus: string,
    options?: { condition?: string; maintenance_reason?: string }
  ): Promise<void> {
    try {
      await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          locker_id: lockerId,
          status: newStatus,
          condition: options?.condition,
          maintenance_reason: options?.maintenance_reason,
        }),
      });
      void loadMapData();
      void loadTableData();
    } catch {
      // no-op
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. ENCABEZADO INSTITUCIONAL DE REPRESENTACIÓN */}
      <RepresentationSectionHeader
        title="Lockers — Delegación XXI"
        subtitle="Centro visual y operativo de casilleros. Mapa digital del inventario físico, asignaciones y estado en tiempo real."
        secondaryAction={
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              href="/api/union/lockers/export"
              download="lockers_delegacion_xxi.csv"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.45rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
                minHeight: 38,
              }}
            >
              Descargar CSV
            </a>

            <Link
              href="/representacion/lockers/importar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.45rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
                minHeight: 38,
              }}
            >
              Actualizar base
            </Link>

            <Button
              variant="secondary"
              onClick={() => setIsZoneManagerOpen(true)}
              style={{ minHeight: 38, whiteSpace: "nowrap", fontSize: "0.8125rem" }}
            >
              ⚙ Zonas y Muebles
            </Button>
          </div>
        }
        primaryAction={
          <Button
            variant="primary"
            onClick={() => handleOpenAssignFromLocker()}
            style={{ minHeight: 38, whiteSpace: "nowrap" }}
          >
            + Asignar casillero
          </Button>
        }
      />

      {/* 2. TARJETAS DE MÉTRICAS */}
      <LockerMetrics
        metrics={metricsData}
        activeFilter={statusFilter}
        onFilterClick={(filter) => {
          if (filter === "attention") {
            setShowIntegrityPanel(true);
          } else if (filter === "waitlist") {
            handleViewChange("waitlist");
          } else {
            setStatusFilter(filter);
            if (currentView === "table") {
              setPage(1);
              updateUrlParams({ status: filter, page: 1 });
            }
          }
        }}
      />

      {/* 3. SELECTOR DE VISTAS (MAPA, LISTA, PENDIENTES, LISTA DE ESPERA, RECORRIDO) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <LockerViewSwitcher
          currentView={currentView}
          onViewChange={handleViewChange}
          pendingCount={pendingReviewCount}
          waitlistCount={waitlistCount}
        />

        {currentView === "map" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ position: "relative" }}>
              <input
                type="search"
                placeholder="Buscar casillero # o trabajador..."
                value={searchQuery}
                onChange={(e) => handleSearchSubmit(e.target.value)}
                style={{
                  padding: "0.45rem 0.75rem 0.45rem 2rem",
                  fontSize: "0.8125rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--fg)",
                  minWidth: "260px",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "0.65rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.8125rem",
                  color: "var(--muted)",
                  pointerEvents: "none",
                }}
              >
                🔍
              </span>
            </div>

            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setHighlightedLockerId(null);
                  updateUrlParams({ q: "" });
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 4. CONTENIDO PRINCIPAL SEGÚN LA VISTA SELECCIONADA */}

      {/* === VISTA 1: MAPA DIGITAL FÍSICO (DEFAULT) === */}
      {currentView === "map" && (
        <div>
          {/* Navegación por zonas y pisos */}
          <LockerZoneNavigator
            zones={zones}
            selectedZoneId={selectedZoneId}
            unlocatedCount={unlocatedCount}
            totalLockersCount={mapLockers.length}
            onSelectZone={handleZoneSelect}
            isAdmin={isAdmin}
            onConfigureZones={() => {
              if (isAdmin) setIsZoneManagerOpen(true);
            }}
          />

          {loadingMap ? (
            <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
              <LoadingSpinner text="Cargando mapa físico de casilleros..." />
            </div>
          ) : mapError ? (
            <div
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{mapError}</span>
              <Button variant="secondary" size="sm" onClick={() => void loadMapData()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <LockerZoneMap
              zones={zones}
              banks={banks}
              lockers={mapLockers}
              selectedZoneId={selectedZoneId}
              highlightedLockerId={highlightedLockerId}
              onLockerClick={handleLockerClick}
              onLockerHover={handleLockerHover}
              onLockerLeave={handleLockerLeave}
              isAdmin={isAdmin}
              onConfigureMap={() => {
                if (isAdmin) setIsZoneManagerOpen(true);
              }}
              onEditBank={(bank) => {
                if (isAdmin) {
                  setBankToEdit(bank);
                  setIsBankEditorOpen(true);
                }
              }}
            />
          )}

          {/* Tooltip flotante al pasar el mouse */}
          <LockerQuickTooltip locker={hoveredLocker} position={tooltipPosition} />
        </div>
      )}

      {/* === VISTA 2: LISTA ADMINISTRATIVA (TABLA TRADICIONAL) === */}
      {currentView === "table" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <LockerToolbar
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setPage(1);
              updateUrlParams({ q, page: 1 });
            }}
            statusFilter={statusFilter}
            onStatusChange={(st) => {
              setStatusFilter(st);
              setPage(1);
              updateUrlParams({ status: st, page: 1 });
            }}
            inventoryFilter={inventoryFilter}
            onInventoryChange={(inv) => {
              setInventoryFilter(inv);
              setPage(1);
              updateUrlParams({ inventory: inv, page: 1 });
            }}
            conditionFilter={conditionFilter}
            onConditionChange={(cond) => {
              setConditionFilter(cond);
              setPage(1);
              updateUrlParams({ condition: cond, page: 1 });
            }}
            locationFilter={locationFilter}
            onLocationChange={(loc) => {
              setLocationFilter(loc);
              setPage(1);
              updateUrlParams({ location: loc, page: 1 });
            }}
            zoneFilter={selectedZoneId}
            onZoneChange={(z) => {
              setSelectedZoneId(z);
              setPage(1);
              updateUrlParams({ zone: z, page: 1 });
            }}
            zones={zones}
            banks={banks}
            onOpenCreateModal={() => setIsCreateOpen(true)}
            sortOrder={sortOrder}
            onSortChange={(s) => {
              setSortOrder(s);
              updateUrlParams({ sort: s });
            }}
            pageSize={pageSize}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
              updateUrlParams({ pageSize: ps, page: 1 });
            }}
            onResetFilters={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setInventoryFilter("active");
              setConditionFilter("all");
              setLocationFilter("all");
              setSelectedZoneId("all");
              setSortOrder("number_asc");
              setPage(1);
              updateUrlParams({
                q: "",
                status: "all",
                inventory: "active",
                condition: "all",
                location: "all",
                zone: "all",
                sort: "number_asc",
                page: 1,
              });
            }}
            hasActiveFilters={
              Boolean(searchQuery.trim()) ||
              statusFilter !== "all" ||
              inventoryFilter !== "active" ||
              conditionFilter !== "all" ||
              locationFilter !== "all" ||
              selectedZoneId !== "all" ||
              sortOrder !== "number_asc"
            }
            loading={loadingTable}
          />

          {loadingTable ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <LoadingSpinner text="Cargando inventario de casilleros..." />
            </div>
          ) : tableLockers.length === 0 ? (
            <Card padding="2.5rem 1.5rem" style={{ textAlign: "center" }}>
              <span style={{ fontSize: "2rem" }} aria-hidden="true">🔍</span>
              <h3 style={{ margin: "0.5rem 0", fontSize: "1.0625rem", fontWeight: 700 }}>
                No encontramos casilleros con el filtro seleccionado
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--muted)" }}>
                Prueba con otro término de búsqueda o limpia los filtros para ver el inventario completo.
              </p>
            </Card>
          ) : (
            <>
              {/* Escritorio */}
              <div className="locker-desktop-only" style={{ display: "none" }}>
                <LockerDesktopTable
                  lockers={tableLockers}
                  onOpenDetail={(id) => {
                    setDetailLockerId(id);
                    setIsDetailOpen(true);
                  }}
                  onOpenAssign={handleOpenAssignFromLocker}
                  onOpenRelease={handleOpenRelease}
                  onOpenEdit={(locker) => {
                    setLockerToEdit(locker);
                    setIsEditOpen(true);
                  }}
                  onOpenArchive={(locker) => {
                    setLockerToArchive(locker);
                    setIsArchiveOpen(true);
                  }}
                  onOpenHardDelete={(locker) => {
                    setLockerToDelete(locker);
                    setIsHardDeleteOpen(true);
                  }}
                  onSetStatus={handleSetStatus}
                  selectedIds={selectedLockerIds}
                  onToggleSelect={(id) => {
                    setSelectedLockerIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    );
                  }}
                  onToggleSelectAll={() => {
                    setSelectedLockerIds((prev) =>
                      prev.length === tableLockers.length ? [] : tableLockers.map((l) => l.id)
                    );
                  }}
                  isAdmin={isAdmin}
                  loading={loadingTable}
                />
              </div>

              {/* Móvil */}
              <div className="locker-mobile-only" style={{ display: "block" }}>
                <LockerMobileList
                  lockers={tableLockers}
                  onOpenDetail={(id) => {
                    setDetailLockerId(id);
                    setIsDetailOpen(true);
                  }}
                  onOpenAssign={handleOpenAssignFromLocker}
                  onOpenRelease={handleOpenRelease}
                  onOpenEdit={(locker) => {
                    setLockerToEdit(locker);
                    setIsEditOpen(true);
                  }}
                  onOpenArchive={(locker) => {
                    setLockerToArchive(locker);
                    setIsArchiveOpen(true);
                  }}
                  loading={loadingTable}
                />
              </div>

              {/* Paginación */}
              {totalFiltered > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: "0.8125rem",
                    color: "var(--muted)",
                  }}
                >
                  <div>
                    Mostrando <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalFiltered)}</strong> de{" "}
                    <strong>{totalFiltered.toLocaleString("es-MX")}</strong> casilleros
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const prev = Math.max(1, page - 1);
                        setPage(prev);
                        updateUrlParams({ page: prev });
                      }}
                      disabled={page <= 1 || loadingTable}
                    >
                      ‹ Anterior
                    </Button>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const next = Math.min(totalPages, page + 1);
                        setPage(next);
                        updateUrlParams({ page: next });
                      }}
                      disabled={page >= totalPages || loadingTable}
                    >
                      Siguiente ›
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* === VISTA 3: PENDIENTES DE REVISIÓN === */}
      {currentView === "pending" && (
        <LockerPendingReviewList />
      )}

      {/* === VISTA 4: LISTA DE ESPERA SINDICAL === */}
      {currentView === "waitlist" && (
        <WaitlistPanel />
      )}

      {/* === VISTA 5: RECORRIDO FÍSICO (AUDITORÍA PASO A PASO) === */}
      {currentView === "audit" && (
        <LockerAuditMode
          zones={zones}
          banks={banks}
          lockers={mapLockers}
          onOpenLockerDetail={(id) => {
            setDetailLockerId(id);
            setIsDetailOpen(true);
          }}
          onExit={() => handleViewChange("map")}
          onRefreshData={() => {
            void loadMapData();
            void loadTableData();
          }}
        />
      )}

      {/* 5. MODALES Y PANELES LATERALES */}

      {/* Panel de Integridad y Salud de Casilleros */}
      {showIntegrityPanel && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg)",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              padding: "1.5rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Centro de Salud e Integridad de Casilleros
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowIntegrityPanel(false)}>
                ✕ Cerrar
              </Button>
            </div>
            <LockerIntegrityPanel
              onLocateLocker={(lockerId) => {
                setShowIntegrityPanel(false);
                setDetailLockerId(lockerId);
                setIsDetailOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Ficha Lateral de Detalle del Locker */}
      <LockerDetailSheet
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        lockerId={detailLockerId}
        onOpenAssign={(locker) => handleOpenAssignFromLocker(locker)}
        onOpenRelease={handleOpenRelease}
        onOpenMove={handleOpenMove}
        onOpenSwap={handleOpenSwap}
        onOpenEdit={(locker) => {
          setLockerToEdit(locker);
          setIsEditOpen(true);
        }}
        onOpenArchive={(locker) => {
          setLockerToArchive(locker);
          setIsArchiveOpen(true);
        }}
        onOpenHardDelete={(locker) => {
          setLockerToDelete(locker);
          setIsHardDeleteOpen(true);
        }}
        onSetStatus={handleSetStatus}
        isAdmin={isAdmin}
      />

      {/* Modal de Asignación */}
      <LockerAssignSheet
        isOpen={isAssignOpen}
        onClose={() => {
          setIsAssignOpen(false);
          setAssignTargetLocker(null);
        }}
        initialLocker={assignTargetLocker}
        onSuccess={() => {
          void loadMapData();
          void loadTableData();
        }}
      />

      {/* Modal de Liberación */}
      <LockerReleaseModal
        isOpen={isReleaseOpen}
        lockerNumber={releaseTarget?.lockerNumber ?? ""}
        onConfirm={handleConfirmRelease}
        onCancel={() => {
          setIsReleaseOpen(false);
          setReleaseTarget(null);
        }}
        loading={releasing}
      />

      {/* Modal de Movimiento de Ocupante */}
      <LockerMoveFlow
        isOpen={isMoveOpen}
        onClose={() => {
          setIsMoveOpen(false);
          setMoveSourceLocker(null);
        }}
        sourceLocker={moveSourceLocker}
        onSuccess={() => {
          void loadMapData();
          void loadTableData();
        }}
      />

      {/* Modal de Permuta de Casilleros (Admin) */}
      {isAdmin && (
        <LockerSwapFlow
          isOpen={isSwapOpen}
          onClose={() => {
            setIsSwapOpen(false);
            setSwapSourceLocker(null);
          }}
          sourceLocker={swapSourceLocker}
          onSuccess={() => {
            void loadMapData();
            void loadTableData();
          }}
        />
      )}

      {/* Modal de Configuración de Zonas y Muebles (Admin) */}
      {isAdmin && (
        <LockerZoneManager
          isOpen={isZoneManagerOpen}
          onClose={() => setIsZoneManagerOpen(false)}
          zones={zones}
          banks={banks}
          onSuccess={() => {
            void loadMapData();
          }}
        />
      )}

      {/* Modal Editor de Mueble Específico (Admin) */}
      {isAdmin && isBankEditorOpen && (
        <LockerBankEditor
          isOpen={isBankEditorOpen}
          onClose={() => {
            setIsBankEditorOpen(false);
            setBankToEdit(null);
          }}
          zone={zones.find((z) => z.id === bankToEdit?.zone_id) || zones[0] || null}
          bankToEdit={bankToEdit}
          onSuccess={() => {
            setIsBankEditorOpen(false);
            setBankToEdit(null);
            void loadMapData();
          }}
        />
      )}
      {/* Barra de Acciones Masivas */}
      <LockerBulkToolbar
        selectedIds={selectedLockerIds}
        onClearSelection={() => setSelectedLockerIds([])}
        onSuccess={(msg) => {
          setFeedbackMessage(msg);
          void loadTableData();
          void loadMapData();
        }}
        zones={zones}
        banks={banks}
      />

      {/* Modal Crear Locker Físico */}
      <LockerCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(createdNumber) => {
          setFeedbackMessage(`Casillero ${createdNumber} creado con éxito.`);
          void loadTableData();
          void loadMapData();
        }}
        zones={zones}
        banks={banks}
      />

      {/* Modal Editar / Renumerar Locker Físico */}
      <LockerEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setLockerToEdit(null);
        }}
        onSuccess={(updatedNumber) => {
          setFeedbackMessage(`Casillero ${updatedNumber} actualizado con éxito.`);
          void loadTableData();
          void loadMapData();
        }}
        locker={lockerToEdit}
        zones={zones}
        banks={banks}
      />

      {/* Modal Archivar / Reactivar Locker */}
      <LockerArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => {
          setIsArchiveOpen(false);
          setLockerToArchive(null);
        }}
        onSuccess={(lockerNumber, isRestored) => {
          setFeedbackMessage(
            isRestored
              ? `Casillero ${lockerNumber} reactivado en el inventario.`
              : `Casillero ${lockerNumber} retirado del inventario.`
          );
          void loadTableData();
          void loadMapData();
        }}
        locker={lockerToArchive}
      />

      {/* Modal Eliminación Definitiva (Admin Excepcional) */}
      {isAdmin && (
        <LockerHardDeleteModal
          isOpen={isHardDeleteOpen}
          onClose={() => {
            setIsHardDeleteOpen(false);
            setLockerToDelete(null);
          }}
          onSuccess={(deletedNumber) => {
            setFeedbackMessage(`Registro de casillero ${deletedNumber} eliminado definitivamente.`);
            void loadTableData();
            void loadMapData();
          }}
          locker={lockerToDelete}
        />
      )}

      {/* Toast de Feedback */}
      {feedbackMessage ? (
        <div
          style={{
            position: "fixed",
            bottom: selectedLockerIds.length > 0 ? "6rem" : "1.5rem",
            right: "1.5rem",
            zIndex: 95,
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span>✓ {feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* CSS para breakpoints de tabla vs móvil */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .locker-desktop-only {
            display: block !important;
          }
          .locker-mobile-only {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .locker-desktop-only {
            display: none !important;
          }
          .locker-mobile-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
