// Parámetros de URL del Directorio de Trabajadores (Representación Sindical).
// Funciones puras y compartidas entre cliente, servidor y pruebas.
// No contiene PII: solo claves de filtro, orden y página.

export const WORKER_DIRECTORY_DEFAULT_PAGE_SIZE = 25;
export const WORKER_DIRECTORY_API_DEFAULT_PAGE_SIZE = 50;
export const WORKER_DIRECTORY_MAX_PAGE_SIZE = 50;

export type WorkerDirectorySortId =
  | "nombre_asc"
  | "nombre_desc"
  | "antiguedad_desc"
  | "antiguedad_asc"
  | "categoria_asc"
  | "matricula_asc";

export type WorkerDirectoryStatus = "vigentes" | "no_vigentes" | "activos" | "inactivos" | "todos";

export interface WorkerDirectorySortOption {
  id: WorkerDirectorySortId;
  label: string;
  dataAvailable: boolean;
}

export const WORKER_DIRECTORY_SORTS: readonly WorkerDirectorySortOption[] = [
  { id: "nombre_asc", label: "Nombre A-Z", dataAvailable: true },
  { id: "nombre_desc", label: "Nombre Z-A", dataAvailable: true },
  { id: "antiguedad_desc", label: "Mayor antigüedad", dataAvailable: true },
  { id: "antiguedad_asc", label: "Menor antigüedad", dataAvailable: true },
  { id: "categoria_asc", label: "Categoría", dataAvailable: true },
  { id: "matricula_asc", label: "Matrícula", dataAvailable: true },
] as const;

export const WORKER_DIRECTORY_DEFAULT_SORT: WorkerDirectorySortId = "nombre_asc";

export const WORKER_DIRECTORY_STATUS_OPTIONS: readonly { id: WorkerDirectoryStatus; label: string }[] = [
  { id: "vigentes", label: "Padrón vigente" },
  { id: "no_vigentes", label: "No vigentes / Histórico" },
  { id: "inactivos", label: "Inactivos" },
  { id: "todos", label: "Todos" },
] as const;

export interface WorkerDirectoryQuery {
  q: string;
  categories: string[];
  turns: string[];
  assignments: string[];
  status: WorkerDirectoryStatus;
  sort: WorkerDirectorySortId;
  page: number;
  pageSize: number;
}

export const EMPTY_WORKER_DIRECTORY_QUERY: WorkerDirectoryQuery = {
  q: "",
  categories: [],
  turns: [],
  assignments: [],
  status: "todos",
  sort: WORKER_DIRECTORY_DEFAULT_SORT,
  page: 1,
  pageSize: WORKER_DIRECTORY_DEFAULT_PAGE_SIZE,
};

const MAX_FILTER_VALUES = 20;
const MAX_FILTER_VALUE_LENGTH = 160;
const MAX_QUERY_LENGTH = 80;

function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().slice(0, MAX_FILTER_VALUE_LENGTH);
    if (!value) continue;
    const key = value.toLocaleLowerCase("es-MX");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= MAX_FILTER_VALUES) break;
  }
  return out;
}

function readList(params: URLSearchParams, key: string): string[] {
  const collected: string[] = [];
  for (const entry of params.getAll(key)) {
    for (const part of entry.split(",")) {
      collected.push(part);
    }
  }
  return normalizeList(collected);
}

export function isWorkerDirectorySortId(value: string): value is WorkerDirectorySortId {
  return WORKER_DIRECTORY_SORTS.some((s) => s.id === value);
}

export function isWorkerDirectoryStatus(value: string): value is WorkerDirectoryStatus {
  return value === "activos" || WORKER_DIRECTORY_STATUS_OPTIONS.some((s) => s.id === value);
}

export function parseWorkerDirectoryQuery(params: URLSearchParams): WorkerDirectoryQuery {
  const rawStatus = (params.get("estado") ?? "").trim();
  const rawSort = (params.get("orden") ?? params.get("sort") ?? "").trim();
  const rawPage = Number.parseInt(params.get("pagina") ?? "", 10);
  const rawPageSize = Number.parseInt(params.get("limite") ?? "", 10);

  let status: WorkerDirectoryStatus = "todos";
  if (rawStatus === "activos") status = "activos";
  else if (isWorkerDirectoryStatus(rawStatus)) status = rawStatus;

  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    categories: readList(params, "categoria"),
    turns: readList(params, "turno"),
    assignments: readList(params, "adscripcion"),
    status,
    sort: isWorkerDirectorySortId(rawSort) ? rawSort : WORKER_DIRECTORY_DEFAULT_SORT,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize:
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(rawPageSize, WORKER_DIRECTORY_MAX_PAGE_SIZE)
        : WORKER_DIRECTORY_DEFAULT_PAGE_SIZE,
  };
}

export function workerDirectoryToSearchParams(query: WorkerDirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.categories.length > 0) params.set("categoria", query.categories.join(","));
  if (query.turns.length > 0) params.set("turno", query.turns.join(","));
  if (query.assignments.length > 0) params.set("adscripcion", query.assignments.join(","));
  if (query.status !== "todos") params.set("estado", query.status);
  if (query.sort !== WORKER_DIRECTORY_DEFAULT_SORT) params.set("orden", query.sort);
  if (query.page > 1) params.set("pagina", String(query.page));
  return params;
}

/**
 * Enlace al expediente del trabajador conservando búsqueda, filtros, orden y
 * página para el regreso (`volver`).
 */
export function workerDetailHref(workerId: string, query: WorkerDirectoryQuery): string {
  const back = workerDirectoryToSearchParams(query).toString();
  const base = `/representacion/trabajadores/${encodeURIComponent(workerId)}`;
  return back ? `${base}?volver=${encodeURIComponent(back)}` : base;
}

export function workerDirectoryHref(query: WorkerDirectoryQuery, extra?: Record<string, string>): string {
  const params = workerDirectoryToSearchParams(query);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/representacion/trabajadores?${qs}` : "/representacion/trabajadores";
}

/**
 * Reconstruye un enlace seguro de regreso al directorio a partir del parámetro
 * `volver` (query string del directorio). Descarta claves desconocidas.
 */
export function parseWorkerDirectoryReturnHref(volver: string | undefined | null): string {
  if (!volver) return "/representacion/trabajadores";
  try {
    const parsed = parseWorkerDirectoryQuery(new URLSearchParams(volver));
    return workerDirectoryHref(parsed);
  } catch {
    return "/representacion/trabajadores";
  }
}

export function toWorkerDirectoryApiParams(query: WorkerDirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.categories.length > 0) params.set("categoria", query.categories.join(","));
  if (query.turns.length > 0) params.set("turno", query.turns.join(","));
  if (query.assignments.length > 0) params.set("adscripcion", query.assignments.join(","));
  if (query.status !== "todos") params.set("estado", query.status);
  params.set("orden", query.sort);
  params.set("pagina", String(query.page));
  params.set("limite", String(query.pageSize));
  return params;
}

export function activeWorkerFilterCount(query: WorkerDirectoryQuery): number {
  return query.categories.length + query.turns.length + query.assignments.length + (query.status !== "todos" ? 1 : 0);
}

export function hasWorkerDirectoryFilters(query: WorkerDirectoryQuery): boolean {
  return query.q.length > 0 || activeWorkerFilterCount(query) > 0;
}

export function withWorkerDirectoryPatch(
  query: WorkerDirectoryQuery,
  patch: Partial<WorkerDirectoryQuery>,
): WorkerDirectoryQuery {
  const next: WorkerDirectoryQuery = { ...query, ...patch };
  // Cualquier cambio distinto de página regresa a la primera página.
  if (patch.page === undefined) next.page = 1;
  return next;
}

export function toggleWorkerFilterValue(values: string[], value: string): string[] {
  const exists = values.some((v) => v.toLocaleLowerCase("es-MX") === value.toLocaleLowerCase("es-MX"));
  if (exists) {
    return values.filter((v) => v.toLocaleLowerCase("es-MX") !== value.toLocaleLowerCase("es-MX"));
  }
  return [...values, value];
}

export function sanitizeWorkerSearchTerm(value: string): string {
  return value.replace(/[,()*\\%]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}
