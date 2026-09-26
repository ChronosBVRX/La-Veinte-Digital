import { describe, it, expect } from "vitest";
import {
  EMPTY_WORKER_DIRECTORY_QUERY,
  activeWorkerFilterCount,
  hasWorkerDirectoryFilters,
  parseWorkerDirectoryQuery,
  parseWorkerDirectoryReturnHref,
  sanitizeWorkerSearchTerm,
  toWorkerDirectoryApiParams,
  toggleWorkerFilterValue,
  workerDetailHref,
  workerDirectoryHref,
  workerDirectoryToSearchParams,
  WORKER_DIRECTORY_DEFAULT_PAGE_SIZE,
  WORKER_DIRECTORY_MAX_PAGE_SIZE,
} from "@/features/representacion/lib/worker-directory-params";

describe("directorio sindical · parámetros de URL", () => {
  it("aplica valores por defecto cuando la URL está vacía", () => {
    const query = parseWorkerDirectoryQuery(new URLSearchParams());
    expect(query).toEqual(EMPTY_WORKER_DIRECTORY_QUERY);
    expect(query.pageSize).toBe(WORKER_DIRECTORY_DEFAULT_PAGE_SIZE);
    expect(query.sort).toBe("nombre_asc");
    expect(query.status).toBe("todos");
  });

  it("lee filtros combinados de la URL", () => {
    const query = parseWorkerDirectoryQuery(
      new URLSearchParams(
        "q=perez&categoria=T%C3%89CNICO+RADI%C3%93LOGO&turno=VESPERTINO&adscripcion=RAYOS+X&estado=inactivos&orden=nombre_desc&pagina=3",
      ),
    );
    expect(query.q).toBe("perez");
    expect(query.categories).toEqual(["TÉCNICO RADIÓLOGO"]);
    expect(query.turns).toEqual(["VESPERTINO"]);
    expect(query.assignments).toEqual(["RAYOS X"]);
    expect(query.status).toBe("inactivos");
    expect(query.sort).toBe("nombre_desc");
    expect(query.page).toBe(3);
  });

  it("acepta listas repetidas y separadas por coma, sin duplicados", () => {
    const params = new URLSearchParams();
    params.append("categoria", "A");
    params.append("categoria", "B,C");
    params.append("categoria", " b ");
    const query = parseWorkerDirectoryQuery(params);
    expect(query.categories).toEqual(["A", "B", "C"]);
  });

  it("ignora orden fuera del catálogo y página inválida", () => {
    const query = parseWorkerDirectoryQuery(new URLSearchParams("orden=hack&pagina=-4&limite=999"));
    expect(query.sort).toBe("nombre_asc");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(WORKER_DIRECTORY_MAX_PAGE_SIZE);
  });

  it("serializa solo lo distinto del estado por defecto", () => {
    const href = workerDirectoryHref({
      ...EMPTY_WORKER_DIRECTORY_QUERY,
      categories: ["A", "B"],
      turns: ["VESPERTINO"],
      page: 2,
    });
    expect(href).toContain("categoria=A%2CB");
    expect(href).toContain("turno=VESPERTINO");
    expect(href).toContain("pagina=2");
    expect(href).not.toContain("estado=");
    expect(href).not.toContain("orden=");
  });

  it("omite la query string cuando no hay filtros", () => {
    expect(workerDirectoryHref(EMPTY_WORKER_DIRECTORY_QUERY)).toBe("/representacion/trabajadores");
  });

  it("los parámetros de API conservan el tope de página y el orden", () => {
    const api = toWorkerDirectoryApiParams({
      ...EMPTY_WORKER_DIRECTORY_QUERY,
      status: "activos",
      sort: "antiguedad_desc",
      page: 4,
    });
    expect(api.get("estado")).toBe("activos");
    expect(api.get("orden")).toBe("antiguedad_desc");
    expect(api.get("pagina")).toBe("4");
    expect(api.get("limite")).toBe(String(WORKER_DIRECTORY_DEFAULT_PAGE_SIZE));
  });

  it("cuenta filtros activos y detecta ausencia de filtros", () => {
    expect(hasWorkerDirectoryFilters(EMPTY_WORKER_DIRECTORY_QUERY)).toBe(false);
    expect(activeWorkerFilterCount({ ...EMPTY_WORKER_DIRECTORY_QUERY, categories: ["A"], turns: ["B"], status: "activos" })).toBe(3);
    expect(hasWorkerDirectoryFilters({ ...EMPTY_WORKER_DIRECTORY_QUERY, q: "x" })).toBe(true);
  });

  it("alterna valores de filtro sin duplicar por mayúsculas", () => {
    const once = toggleWorkerFilterValue([], "Rayos X");
    expect(once).toEqual(["Rayos X"]);
    const twice = toggleWorkerFilterValue(once, "rayos x");
    expect(twice).toEqual([]);
  });

  it("sanea el término de búsqueda de sintaxis PostgREST", () => {
    expect(sanitizeWorkerSearchTerm("Pérez, (A)*%")).toBe("Pérez A");
    expect(sanitizeWorkerSearchTerm("  ")).toBe("");
  });

  it("construye el enlace al expediente con regreso conservando estado", () => {
    const query = { ...EMPTY_WORKER_DIRECTORY_QUERY, categories: ["A"], turns: ["V"], sort: "categoria_asc" as const, page: 2 };
    const href = workerDetailHref("w-1", query);
    expect(href.startsWith("/representacion/trabajadores/w-1?volver=")).toBe(true);
    const volver = decodeURIComponent(href.split("volver=")[1]);
    const back = parseWorkerDirectoryQuery(new URLSearchParams(volver));
    expect(back.categories).toEqual(["A"]);
    expect(back.turns).toEqual(["V"]);
    expect(back.sort).toBe("categoria_asc");
    expect(back.page).toBe(2);
  });

  it("regreso seguro: descarta parámetros desconocidos y no confía en el original", () => {
    const href = parseWorkerDirectoryReturnHref("categoria=A&rfc=PEPJ800101&admin=1&pagina=2");
    expect(href).toContain("categoria=A");
    expect(href).toContain("pagina=2");
    expect(href).not.toContain("rfc");
    expect(href).not.toContain("admin");
    expect(parseWorkerDirectoryReturnHref(null)).toBe("/representacion/trabajadores");
    expect(parseWorkerDirectoryReturnHref("%%%")).toBe("/representacion/trabajadores");
  });

  it("soporta estados vigentes y no_vigentes para filtrado institucional", () => {
    const vigentes = parseWorkerDirectoryQuery(new URLSearchParams("estado=vigentes"));
    expect(vigentes.status).toBe("vigentes");
    expect(workerDirectoryToSearchParams(vigentes).get("estado")).toBe("vigentes");

    const noVigentes = parseWorkerDirectoryQuery(new URLSearchParams("estado=no_vigentes"));
    expect(noVigentes.status).toBe("no_vigentes");
    expect(workerDirectoryToSearchParams(noVigentes).get("estado")).toBe("no_vigentes");
  });

  it("roundtrip: URL -> query -> URL es estable", () => {
    const first = parseWorkerDirectoryQuery(
      new URLSearchParams("q=juan&categoria=A,B&turno=V&adscripcion=R&estado=activos&orden=matricula_asc&pagina=5"),
    );
    const second = parseWorkerDirectoryQuery(workerDirectoryToSearchParams(first));
    expect(second).toEqual(first);
  });
});
