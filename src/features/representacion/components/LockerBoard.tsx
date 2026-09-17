"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { RepresentationSectionHeader } from "./ui";
import { LockerSummaryCards, type LockerSummaryCounts } from "./lockers/LockerSummaryCards";
import { LockerToolbar } from "./lockers/LockerToolbar";
import { LockerDesktopTable, type LockerItem } from "./lockers/LockerDesktopTable";
import { LockerMobileList } from "./lockers/LockerMobileList";
import { LockerAssignSheet } from "./lockers/LockerAssignSheet";
import { LockerDetailSheet } from "./lockers/LockerDetailSheet";
import { LockerReleaseModal } from "./lockers/LockerReleaseModal";

export function LockerBoard(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Estados de consulta sincronizados con URL
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";
  const initialSort = searchParams.get("sort") ?? "number_asc";
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const initialPageSize = parseInt(searchParams.get("pageSize") ?? "25", 10) || 25;

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Estados de datos
  const [lockers, setLockers] = useState<LockerItem[]>([]);
  const [counts, setCounts] = useState<LockerSummaryCounts | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales y Sheets laterales
  const [isAssignSheetOpen, setIsAssignSheetOpen] = useState(false);
  const [assignTargetLocker, setAssignTargetLocker] = useState<LockerItem | null>(null);

  const [detailLockerId, setDetailLockerId] = useState<string | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);

  const [releaseTarget, setReleaseTarget] = useState<{ assignmentId: string; lockerNumber: string } | null>(null);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);

  // Sincronizar parámetros en URL
  const updateUrlParams = useCallback(
    (newParams: { q?: string; status?: string; sort?: string; page?: number; pageSize?: number }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newParams.q !== undefined) {
        if (newParams.q) params.set("q", newParams.q);
        else params.delete("q");
      }
      if (newParams.status !== undefined) {
        if (newParams.status !== "all") params.set("status", newParams.status);
        else params.delete("status");
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

  // Carga de datos server-side con paginación
  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/union/lockers?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as {
        lockers?: LockerItem[];
        pagination?: { total: number; page: number; pageSize: number; totalPages: number };
        counts?: LockerSummaryCounts;
        error?: string;
      };

      if (!res.ok) throw new Error(j.error ?? "Error al cargar casilleros");

      setLockers(j.lockers ?? []);
      if (j.pagination) {
        setTotalPages(j.pagination.totalPages);
        setTotalFiltered(j.pagination.total);
      }
      if (j.counts) {
        setCounts(j.counts);
      }
    } catch {
      setError("No se pudieron cargar los casilleros. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [q, status, sort, page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on filter/page change
    void loadData();
  }, [loadData]);

  // Manejadores de Toolbar
  function handleSearchChange(newQ: string): void {
    setQ(newQ);
    setPage(1);
    updateUrlParams({ q: newQ, page: 1 });
  }

  function handleStatusChange(newStatus: string): void {
    setStatus(newStatus);
    setPage(1);
    updateUrlParams({ status: newStatus, page: 1 });
  }

  function handleSortChange(newSort: string): void {
    setSort(newSort);
    updateUrlParams({ sort: newSort });
  }

  function handlePageSizeChange(newSize: number): void {
    setPageSize(newSize);
    setPage(1);
    updateUrlParams({ pageSize: newSize, page: 1 });
  }

  function handleResetFilters(): void {
    setQ("");
    setStatus("all");
    setSort("number_asc");
    setPage(1);
    updateUrlParams({ q: "", status: "all", sort: "number_asc", page: 1 });
  }

  function handlePageChange(newPage: number): void {
    const valid = Math.max(1, Math.min(newPage, totalPages));
    setPage(valid);
    updateUrlParams({ page: valid });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Acciones de Locker
  function handleOpenAssign(locker?: LockerItem): void {
    setAssignTargetLocker(locker ?? null);
    setIsAssignSheetOpen(true);
  }

  function handleOpenDetail(lockerId: string): void {
    setDetailLockerId(lockerId);
    setIsDetailSheetOpen(true);
  }

  function handleOpenRelease(assignmentId: string, lockerNumber: string): void {
    setReleaseTarget({ assignmentId, lockerNumber });
    setIsReleaseModalOpen(true);
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
      setIsReleaseModalOpen(false);
      setReleaseTarget(null);
      void loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al liberar casillero.");
    } finally {
      setReleasing(false);
    }
  }

  async function handleSetStatus(lockerId: string, newStatus: string): Promise<void> {
    try {
      await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          locker_id: lockerId,
          status: newStatus,
        }),
      });
      void loadData();
    } catch {
      // Ignorar fallo puntual
    }
  }

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalFiltered);
  const hasActiveFilters = Boolean(q.trim()) || status !== "all" || sort !== "number_asc";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 1. ENCABEZADO INSTITUCIONAL CON ACCIONES PRINCIPALES */}
      <RepresentationSectionHeader
        title="Lockers"
        subtitle="Administra los casilleros de la delegación, sus asignaciones y pendientes."
        secondaryAction={
          <Link
            href="/representacion/lockers/importar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.5rem 0.875rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--fg)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              textDecoration: "none",
              minHeight: 40,
              whiteSpace: "nowrap",
            }}
          >
            Actualizar base de lockers
          </Link>
        }
        primaryAction={
          <Button
            variant="primary"
            onClick={() => handleOpenAssign()}
            style={{ minHeight: 40, whiteSpace: "nowrap" }}
          >
            + Asignar locker
          </Button>
        }
      />

      {/* 2. RESUMEN VISUAL CON 4 MÉTRICAS REALES Y TARJETA DE PENDIENTES */}
      <LockerSummaryCards
        counts={counts}
        onFilterPending={() => handleStatusChange("pending")}
      />

      {/* 3. BARRA DE HERRAMIENTAS: BUSCADOR UNIFICADO, ESTADOS EN ESPAÑOL, ORDEN NATURAL */}
      <LockerToolbar
        searchQuery={q}
        onSearchChange={handleSearchChange}
        statusFilter={status}
        onStatusChange={handleStatusChange}
        sortOrder={sort}
        onSortChange={handleSortChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
      />

      {/* 4. ERROR SI OCURRE */}
      {error ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius)",
            color: "#b91c1c",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void loadData()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {/* 5. VISUALIZACIÓN: TABLA DESKTOP (≥ 768px) O TARJETAS MOBILE (< 768px) */}
      {!loading && lockers.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "2rem" }} aria-hidden="true">
            🔍
          </span>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 700 }}>
            {status !== "all"
              ? `No encontramos lockers con estado "${status}"`
              : "No encontramos casilleros con la búsqueda ingresada"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", maxWidth: "44ch" }}>
            Prueba con otro término de búsqueda o limpia los filtros activos para ver la base completa.
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla Administrativa Compacta */}
          <div className="locker-desktop-only" style={{ display: "none" }}>
            <LockerDesktopTable
              lockers={lockers}
              onOpenDetail={handleOpenDetail}
              onOpenAssign={handleOpenAssign}
              onOpenRelease={handleOpenRelease}
              onSetStatus={handleSetStatus}
              loading={loading}
            />
          </div>

          {/* Vista Móvil: Tarjetas Compactas */}
          <div className="locker-mobile-only" style={{ display: "block" }}>
            <LockerMobileList
              lockers={lockers}
              onOpenDetail={handleOpenDetail}
              onOpenAssign={handleOpenAssign}
              onOpenRelease={handleOpenRelease}
              loading={loading}
            />
          </div>
        </>
      )}

      {/* 6. CONTROLES DE PAGINACIÓN SERVER-SIDE */}
      {totalFiltered > 0 ? (
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
            Mostrando <strong>{startRecord}–{endRecord}</strong> de{" "}
            <strong>{totalFiltered.toLocaleString("es-MX")}</strong> lockers
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Página anterior"
              style={{ minHeight: 36 }}
            >
              ‹ Anterior
            </Button>

            <span style={{ fontWeight: 600, color: "var(--fg)", padding: "0 0.25rem" }}>
              Página {page} de {totalPages}
            </span>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Página siguiente"
              style={{ minHeight: 36 }}
            >
              Siguiente ›
            </Button>
          </div>
        </div>
      ) : null}

      {/* 7. SHEETS Y MODALES */}
      <LockerAssignSheet
        isOpen={isAssignSheetOpen}
        onClose={() => {
          setIsAssignSheetOpen(false);
          setAssignTargetLocker(null);
        }}
        initialLocker={assignTargetLocker}
        onSuccess={() => void loadData()}
      />

      <LockerDetailSheet
        isOpen={isDetailSheetOpen}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setDetailLockerId(null);
        }}
        lockerId={detailLockerId}
        onOpenAssign={handleOpenAssign}
        onOpenRelease={handleOpenRelease}
        onSetStatus={handleSetStatus}
      />

      <LockerReleaseModal
        isOpen={isReleaseModalOpen}
        lockerNumber={releaseTarget?.lockerNumber ?? ""}
        onConfirm={handleConfirmRelease}
        onCancel={() => {
          setIsReleaseModalOpen(false);
          setReleaseTarget(null);
        }}
        loading={releasing}
      />

      {/* Estilos CSS para breakpoints responsivos de tabla vs móvil */}
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
