"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowsDownUp, Funnel, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";
import { Input, Select } from "@/shared/components/ui/Input";
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
import { WorkerActiveChips, WorkerFilterControls, WorkerSortList } from "./workers/WorkerFilters";
import { WorkerCard } from "./workers/WorkerCard";
import { WorkerCreateForm } from "./workers/WorkerCreateForm";
import { WorkerEmptyState } from "./workers/WorkerEmptyState";
import { WorkerPagination } from "./workers/WorkerPagination";
import { WorkerTable } from "./workers/WorkerTable";

interface DirectoryResponse {
  workers?: WorkerDirectoryRow[];
  total?: number;
  options?: WorkerDirectoryFacets;
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<WorkerDirectoryQuery>(initialQuery);
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

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
        if (active && json.options) setOptions(json.options);
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
    if (searchDraft === query.q) return;
    const timer = setTimeout(() => {
      applyQuery({ ...query, q: searchDraft, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, query, applyQuery]);

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
    setDraft(query);
    setDraftTotal(null);
    setFiltersOpen(true);
  }

  function clearAll(): void {
    const next: WorkerDirectoryQuery = { ...EMPTY_WORKER_DIRECTORY_QUERY, pageSize: query.pageSize };
    setSearchDraft("");
    applyQuery(next);
  }

  function applyDraft(): void {
    setSearchDraft(draft.q);
    applyQuery(draft);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Input
            aria-label="Buscar trabajador"
            placeholder="Buscar por nombre, matrícula, categoría o adscripción…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyQuery({ ...query, q: searchDraft, page: 1 });
              }
            }}
            leadingIcon={<MagnifyingGlass size={16} />}
            trailingElement={
              searchDraft ? (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setSearchDraft("");
                    applyQuery({ ...query, q: "", page: 1 });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  <X size={14} weight="bold" />
                </button>
              ) : undefined
            }
          />
        </div>

        <Button
          variant={filterCount > 0 ? "primary" : "secondary"}
          size="sm"
          onClick={openFilters}
          leadingIcon={<Funnel size={15} />}
          fullWidth={false}
        >
          {filterCount > 0 ? `Filtros ${filterCount}` : "Filtros"}
        </Button>

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
        <Button
          className="mobile-only"
          variant="secondary"
          size="sm"
          onClick={() => setSortOpen(true)}
          leadingIcon={<ArrowsDownUp size={15} />}
        >
          {query.sort === "nombre_asc" ? "Ordenar" : sortLabel}
        </Button>

        <Button size="sm" onClick={() => setCreateOpen(true)} leadingIcon={<Plus size={15} weight="bold" />}>
          Nuevo trabajador
        </Button>

        <Link
          href="/representacion/administracion/actualizar-base"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.375rem 0.625rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--fg)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Importar / actualizar base
        </Link>
      </div>

      {hasFilters ? <WorkerActiveChips query={query} onChange={applyQuery} /> : null}

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
          {desktopFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
      </div>
      {desktopFiltersOpen ? (
        <Card className="desktop-only" padding="0.875rem">
          <WorkerFilterControls idPrefix="desktop" options={options} draft={query} onChange={applyQuery} />
        </Card>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          {loading ? "Cargando…" : `${total} ${total === 1 ? "trabajador" : "trabajadores"}`}
        </span>
        {loading && workers.length > 0 ? (
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Actualizando…</span>
        ) : null}
      </div>

      {error ? (
        <WorkerEmptyState variant="error" onRetry={() => setRefreshKey((key) => key + 1)} />
      ) : !loading && workers.length === 0 ? (
        <WorkerEmptyState variant="empty" query={hasFilters ? query.q : undefined} onClear={clearAll} />
      ) : (
        <>
          <div className="desktop-only">
            <WorkerTable workers={workers} buildHref={buildDetailHref} />
          </div>
          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {workers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} href={buildDetailHref(worker.id)} />
            ))}
          </div>
        </>
      )}

      <WorkerPagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        onPageChange={(page) => applyQuery({ ...query, page })}
      />

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
