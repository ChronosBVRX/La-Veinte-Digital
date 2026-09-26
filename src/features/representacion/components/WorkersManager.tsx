"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowsDownUp, Plus } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";
import { Select } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { BottomSheet } from "@/shared/components/ui/BottomSheet";
import { useToast } from "@/shared/components/ui/Toast";
import {
  EMPTY_WORKER_DIRECTORY_QUERY,
  activeWorkerFilterCount,
  hasWorkerDirectoryFilters,
  toWorkerDirectoryApiParams,
  workerDetailHref,
  workerDirectoryHref,
  WORKER_DIRECTORY_SORTS,
  type WorkerDirectoryQuery,
  type WorkerDirectorySortId,
} from "../lib/worker-directory-params";
import type { WorkerDirectoryFacets, WorkerDirectoryRow } from "../services/worker-directory";
import {
  RepresentationSectionHeader,
  RepresentationSummaryMetrics,
  RepresentationMetricCard,
  RepresentationToolbar,
  RepresentationSearchInput,
  RepresentationFilterButton,
  RepresentationEmptyState,
} from "./ui";
import { WorkerActiveChips, WorkerFilterControls, WorkerSortList } from "./workers/WorkerFilters";
import { WorkerCard } from "./workers/WorkerCard";
import { WorkerCreateForm } from "./workers/WorkerCreateForm";
import { WorkerPagination } from "./workers/WorkerPagination";
import { WorkerTable } from "./workers/WorkerTable";

interface DirectorySummary {
  total: number;
  active: number;
  inactive: number;
  historical?: number;
  categoriesCount: number;
}

interface DirectoryResponse {
  workers?: WorkerDirectoryRow[];
  total?: number;
  options?: WorkerDirectoryFacets;
  summary?: DirectorySummary;
  error?: string;
}

export function WorkersManager({ initialQuery }: { initialQuery: WorkerDirectoryQuery }): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState<WorkerDirectoryQuery>(initialQuery);
  const [searchDraft, setSearchDraft] = useState(initialQuery.q);
  const [workers, setWorkers] = useState<WorkerDirectoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [options, setOptions] = useState<WorkerDirectoryFacets | null>(null);
  const [summary, setSummary] = useState<DirectorySummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<WorkerDirectoryQuery>(initialQuery);
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  const initialQueryKey = useMemo(() => workerDirectoryHref(initialQuery), [initialQuery]);
  const [prevQueryKey, setPrevQueryKey] = useState(initialQueryKey);

  if (initialQueryKey !== prevQueryKey) {
    setPrevQueryKey(initialQueryKey);
    setQuery(initialQuery);
    setSearchDraft(initialQuery.q);
    setDraft(initialQuery);
  }

  const applyQuery = useCallback(
    (next: WorkerDirectoryQuery) => {
      setQuery(next);
      router.replace(workerDirectoryHref(next), { scroll: false });
    },
    [router],
  );

  const apiParams = useMemo(() => toWorkerDirectoryApiParams(query).toString(), [query]);

  useEffect(() => {
    let active = true;
    async function loadOptions(): Promise<void> {
      try {
        const res = await fetch("/api/union/workers?facets=1", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DirectoryResponse;
        if (active) {
          if (json.options) setOptions(json.options);
          if (json.summary) setSummary(json.summary);
        }
      } catch {
        // Las opciones de filtro no bloquean el directorio.
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/union/workers?${apiParams}`, { cache: "no-store", signal: controller.signal });
        const json = (await res.json()) as DirectoryResponse;
        if (!res.ok) throw new Error(json.error ?? "Error");
        if (!active) return;
        setWorkers(json.workers ?? []);
        setTotal(typeof json.total === "number" ? json.total : 0);
        if (json.summary) setSummary(json.summary);
      } catch {
        if (!active || controller.signal.aborted) return;
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [apiParams, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync searchDraft if query.q changes externally
    setSearchDraft(query.q);
  }, [query.q]);

  const applySearch = useCallback((targetText?: string) => {
    const raw = targetText !== undefined ? targetText : searchDraft;
    const nextQ = raw.trim();
    applyQuery({
      ...query,
      q: nextQ,
      page: 1,
    });
  }, [searchDraft, query, applyQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchDraft("");
    applyQuery({
      ...query,
      q: "",
      page: 1,
    });
  }, [query, applyQuery]);

  useEffect(() => {
    if (!filtersOpen) return;
    const params = toWorkerDirectoryApiParams(draft);
    params.set("count", "1");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/union/workers?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { total?: number };
        if (typeof json.total === "number") setDraftTotal(json.total);
      } catch {
        setDraftTotal(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [filtersOpen, draft]);

  const filterCount = activeWorkerFilterCount(query);
  const hasFilters = hasWorkerDirectoryFilters(query);
  const buildDetailHref = useCallback((workerId: string) => workerDetailHref(workerId, query), [query]);

  function openFilters(): void {
    setDraft({ ...query, q: searchDraft });
    setDraftTotal(null);
    setFiltersOpen(true);
  }

  function clearAll(): void {
    const next: WorkerDirectoryQuery = { ...EMPTY_WORKER_DIRECTORY_QUERY, pageSize: query.pageSize };
    setSearchDraft("");
    applyQuery(next);
  }

  function applyDraft(): void {
    applyQuery({ ...draft, q: searchDraft.trim(), page: 1 });
    setFiltersOpen(false);
  }

  function clearDraft(): void {
    const next: WorkerDirectoryQuery = { ...EMPTY_WORKER_DIRECTORY_QUERY, pageSize: query.pageSize };
    setDraft(next);
    setSearchDraft("");
    applyQuery(next);
    setFiltersOpen(false);
  }

  const sortLabel = WORKER_DIRECTORY_SORTS.find((option) => option.id === query.sort)?.label ?? "Ordenar";

  // Métricas calculadas o del backend
  const displayTotal = summary?.total ?? (total > 0 ? total : workers.length);
  const displayActive = summary?.active ?? workers.filter((w) => w.active).length;
  const displayHistorical = summary?.historical ?? 0;
  const displayInactive = summary?.inactive ?? Math.max(0, displayTotal - displayActive - displayHistorical);
  const displayCategories = summary?.categoriesCount || (options?.categories.length ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 1. ENCABEZADO UNIFICADO CON ACCIONES PRINCIPALES */}
      <RepresentationSectionHeader
        title="Trabajadores"
        subtitle="Padrón de la Delegación XXI. Busca, filtra por categoría, turno o adscripción y abre el expediente."
        secondaryAction={
          <Link
            href="/representacion/trabajadores/importar"
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
              minHeight: 38,
              whiteSpace: "nowrap",
            }}
          >
            Actualizar base de trabajadores
          </Link>
        }
        primaryAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            leadingIcon={<Plus size={15} weight="bold" />}
            style={{ minHeight: 38, whiteSpace: "nowrap" }}
          >
            Nuevo trabajador
          </Button>
        }
      />

      {/* 2. RESUMEN DE MÉTRICAS EN TIEMPO REAL */}
      <RepresentationSummaryMetrics>
        <RepresentationMetricCard
          label="Padrón vigente"
          value={displayActive}
          icon="✓"
          accentColor="#166534"
          loading={loading && !summary && total === 0}
        />
        <RepresentationMetricCard
          label="No vigentes / Histórico"
          value={displayHistorical}
          icon="⚠️"
          accentColor="#b45309"
          loading={loading && !summary && total === 0}
        />
        <RepresentationMetricCard
          label="Inactivos"
          value={displayInactive}
          icon="⏸"
          accentColor={displayInactive > 0 ? "var(--muted)" : undefined}
          loading={loading && !summary && total === 0}
        />
        <RepresentationMetricCard
          label="Categorías"
          value={displayCategories}
          icon="🏷️"
          accentColor="#1e40af"
          loading={loading && !summary && total === 0}
        />
      </RepresentationSummaryMetrics>

      {/* 3. BARRA DE HERRAMIENTAS UNIFICADA */}
      <RepresentationToolbar
        search={
          <RepresentationSearchInput
            ariaLabel="Buscar trabajador"
            placeholder="Buscar por nombre, matrícula, categoría o adscripción…"
            value={searchDraft}
            onChange={setSearchDraft}
            onSearchSubmit={() => applySearch()}
            onClear={handleClearSearch}
            showSearchButton={true}
            searchButtonLabel="Buscar"
          />
        }
        filters={
          <RepresentationFilterButton
            activeCount={filterCount}
            onClick={openFilters}
          />
        }
        sort={
          <>
            <div className="desktop-only" style={{ width: 176 }}>
              <Select
                aria-label="Ordenar trabajadores"
                value={query.sort}
                onChange={(e) => applyQuery({ ...query, sort: e.target.value as WorkerDirectorySortId, page: 1 })}
              >
                {WORKER_DIRECTORY_SORTS.filter((option) => option.dataAvailable).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mobile-only">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSortOpen(true)}
                leadingIcon={<ArrowsDownUp size={15} />}
                style={{ minHeight: 38, whiteSpace: "nowrap" }}
              >
                {query.sort === "nombre_asc" ? "Ordenar" : sortLabel}
              </Button>
            </div>
          </>
        }
        hasActiveFilters={hasFilters}
        activeChips={hasFilters ? <WorkerActiveChips query={query} onChange={applyQuery} /> : null}
        resultsInfo={
          <>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              {loading ? "Cargando…" : `${total} ${total === 1 ? "trabajador" : "trabajadores"}`}
            </span>
            {loading && workers.length > 0 ? (
              <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>Actualizando resultados…</span>
            ) : null}
          </>
        }
      />

      {/* Panel colapsable de filtros en desktop */}
      <div className="desktop-only">
        <button
          type="button"
          onClick={() => setDesktopFiltersOpen((prev) => !prev)}
          aria-expanded={desktopFiltersOpen}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--primary)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {desktopFiltersOpen ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
        </button>
      </div>
      {desktopFiltersOpen ? (
        <Card className="desktop-only" padding="0.875rem">
          <WorkerFilterControls idPrefix="desktop" options={options} draft={query} onChange={applyQuery} />
        </Card>
      ) : null}

      {/* 4. ÁREA DE CONTENIDO */}
      {error ? (
        <RepresentationEmptyState
          variant="error"
          title="No se pudo cargar el directorio"
          description="Ocurrió un error al cargar la información. Verifica tu conexión e intenta de nuevo."
          onAction={() => setRefreshKey((key) => key + 1)}
          actionLabel="Reintentar"
        />
      ) : !loading && workers.length === 0 ? (
        <RepresentationEmptyState
          variant={hasFilters ? "filtered" : "empty"}
          title={hasFilters ? "Sin resultados" : "Directorio vacío"}
          description={
            hasFilters
              ? "No hay trabajadores que coincidan con la búsqueda o filtros aplicados."
              : "Aún no se cuenta con trabajadores en el padrón de esta delegación."
          }
          onAction={hasFilters ? clearAll : undefined}
          actionLabel={hasFilters ? "Limpiar filtros" : undefined}
        />
      ) : (
        <div
          style={{
            opacity: loading ? 0.65 : 1,
            transition: "opacity 0.15s ease",
            pointerEvents: loading ? "none" : "auto",
          }}
        >
          <div className="desktop-only">
            <WorkerTable workers={workers} buildHref={buildDetailHref} />
          </div>
          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {workers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} href={buildDetailHref(worker.id)} />
            ))}
          </div>
        </div>
      )}

      {/* 5. PAGINACIÓN */}
      <WorkerPagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        onPageChange={(page) => applyQuery({ ...query, page })}
      />

      {/* 6. BOTTOM SHEETS MÓVILES */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" height="large">
        <WorkerFilterControls idPrefix="mobile" options={options} draft={draft} onChange={setDraft} />
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)",
            position: "sticky",
            bottom: 0,
            background: "var(--card)",
          }}
        >
          <Button variant="secondary" onClick={clearDraft} fullWidth>
            Limpiar
          </Button>
          <Button onClick={applyDraft} fullWidth>
            {draftTotal === null
              ? "Ver resultados"
              : `Ver ${draftTotal} ${draftTotal === 1 ? "trabajador" : "trabajadores"}`}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title="Ordenar por">
        <WorkerSortList
          value={query.sort}
          onChange={(sort) => {
            applyQuery({ ...query, sort, page: 1 });
            setSortOpen(false);
          }}
        />
      </BottomSheet>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Alta de trabajador" height="large">
        <WorkerCreateForm
          onCreated={(displayName) => {
            setCreateOpen(false);
            toast(`${displayName} registrado. Ya puede usarse en todos los trámites.`, "success");
            setRefreshKey((key) => key + 1);
          }}
        />
      </BottomSheet>
    </div>
  );
}
