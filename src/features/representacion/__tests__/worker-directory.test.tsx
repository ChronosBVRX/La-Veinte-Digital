// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/representacion/trabajadores",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string | { pathname: string };
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

import { WorkersManager } from "@/features/representacion/components/WorkersManager";
import {
  EMPTY_WORKER_DIRECTORY_QUERY,
  parseWorkerDirectoryQuery,
  type WorkerDirectoryQuery,
} from "@/features/representacion/lib/worker-directory-params";

const DISPLAY_NAME = "Pérez López Juan";

const OPTIONS = {
  categories: ["AUXILIAR UNIVERSAL", "TÉCNICO RADIÓLOGO"],
  turns: ["MATUTINO", "VESPERTINO"],
  assignments: ["HOSPITALIZACIÓN", "RAYOS X"],
};

function worker(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-00000000000${id}`,
    employee_number: `10000${id}`,
    first_name: "Juan",
    paternal_surname: "Pérez",
    maternal_surname: "López",
    siap_full_name: "",
    category: "TÉCNICO RADIÓLOGO",
    assignment: "RAYOS X",
    turn: "VESPERTINO",
    schedule: null,
    rest_days: null,
    active: true,
    seniority_years: 8,
    employment_start_date: null,
    ...overrides,
  };
}

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

function listCalls(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/union/workers" && !url.searchParams.has("facets") && !url.searchParams.has("count"));
}

function lastListCall(): URL | undefined {
  const calls = listCalls();
  return calls[calls.length - 1];
}

function renderDirectory(initialQuery?: Partial<WorkerDirectoryQuery>) {
  return render(<WorkersManager initialQuery={{ ...EMPTY_WORKER_DIRECTORY_QUERY, ...initialQuery }} />);
}

beforeEach(() => {
  replaceMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.searchParams.has("facets")) {
      return jsonResponse({ workers: [], total: 0, options: OPTIONS });
    }
    if (url.searchParams.has("count")) {
      return jsonResponse({ total: 2 });
    }
    return jsonResponse({ workers: [worker("1"), worker("2")], total: 2, hasMore: false, options: OPTIONS });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Directorio de trabajadores · búsqueda", () => {
  it("carga el padrón y muestra el total", async () => {
    renderDirectory();
    expect(await screen.findAllByText(DISPLAY_NAME)).not.toHaveLength(0);
    expect(screen.getAllByText("2 trabajadores").length).toBeGreaterThan(0);
  });

  it("busca al presionar Enter y sincroniza la URL", async () => {
    renderDirectory();
    const input = screen.getByLabelText("Buscar trabajador");
    fireEvent.change(input, { target: { value: "perez" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("q")).toBe("perez");
    });
    expect(replaceMock).toHaveBeenCalledWith("/representacion/trabajadores?q=perez", { scroll: false });
  });

  it("aplica búsqueda con debounce al escribir", async () => {
    renderDirectory();
    const input = screen.getByLabelText("Buscar trabajador");
    fireEvent.change(input, { target: { value: "lopez" } });

    await waitFor(
      () => {
        expect(lastListCall()?.searchParams.get("q")).toBe("lopez");
      },
      { timeout: 2000 },
    );
  });
});

describe("Directorio de trabajadores · filtros", () => {
  it("filtra por categoría desde el sheet móvil y muestra el conteo antes de aplicar", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    const category = await screen.findByLabelText("TÉCNICO RADIÓLOGO");
    fireEvent.click(category);

    const apply = await screen.findByRole("button", { name: "Ver 2 trabajadores" }, { timeout: 2000 });
    fireEvent.click(apply);

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("categoria")).toBe("TÉCNICO RADIÓLOGO");
    });
  });

  it("combina categoría + turno + adscripción", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    fireEvent.click(await screen.findByLabelText("TÉCNICO RADIÓLOGO"));
    fireEvent.click(screen.getByLabelText("VESPERTINO"));
    fireEvent.click(screen.getByLabelText("RAYOS X"));
    fireEvent.click(await screen.findByRole("button", { name: /Ver \d+ trabajadores/ }, { timeout: 2000 }));

    await waitFor(() => {
      const params = lastListCall()?.searchParams;
      expect(params?.get("categoria")).toBe("TÉCNICO RADIÓLOGO");
      expect(params?.get("turno")).toBe("VESPERTINO");
      expect(params?.get("adscripcion")).toBe("RAYOS X");
    });
  });

  it("multi-select: dos categorías se combinan con OR en un mismo parámetro", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    fireEvent.click(await screen.findByLabelText("TÉCNICO RADIÓLOGO"));
    fireEvent.click(screen.getByLabelText("AUXILIAR UNIVERSAL"));
    fireEvent.click(await screen.findByRole("button", { name: /Ver \d+ trabajadores/ }, { timeout: 2000 }));

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("categoria")).toBe("TÉCNICO RADIÓLOGO,AUXILIAR UNIVERSAL");
    });
  });

  it("filtra por estado inactivos", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    fireEvent.click(await screen.findByLabelText("Inactivos"));
    fireEvent.click(await screen.findByRole("button", { name: /Ver \d+ trabajadores/ }, { timeout: 2000 }));

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("estado")).toBe("inactivos");
    });
  });

  it("muestra chips de filtros activos y los limpia todos", async () => {
    renderDirectory({ q: "perez", categories: ["TÉCNICO RADIÓLOGO"], turns: ["VESPERTINO"] });
    await screen.findAllByText(DISPLAY_NAME);

    expect(screen.getAllByText("TÉCNICO RADIÓLOGO").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Quitar filtro TÉCNICO RADIÓLOGO")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar todos" }));

    await waitFor(() => {
      const params = lastListCall()?.searchParams;
      expect(params?.get("q")).toBeNull();
      expect(params?.get("categoria")).toBeNull();
      expect(params?.get("turno")).toBeNull();
    });
    expect(replaceMock).toHaveBeenCalledWith("/representacion/trabajadores", { scroll: false });
  });

  it("quita un chip individual", async () => {
    renderDirectory({ categories: ["TÉCNICO RADIÓLOGO"], turns: ["VESPERTINO"] });
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByLabelText("Quitar filtro VESPERTINO"));

    await waitFor(() => {
      const params = lastListCall()?.searchParams;
      expect(params?.get("categoria")).toBe("TÉCNICO RADIÓLOGO");
      expect(params?.get("turno")).toBeNull();
    });
  });
});

describe("Directorio de trabajadores · ordenamiento", () => {
  it("ordena Z-A desde el selector de escritorio", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.change(screen.getByLabelText("Ordenar trabajadores"), { target: { value: "nombre_desc" } });

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("orden")).toBe("nombre_desc");
    });
  });

  it("ordena por mayor antigüedad desde el sheet móvil", async () => {
    renderDirectory();
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: "Ordenar" }));
    fireEvent.click(await screen.findByLabelText("Mayor antigüedad"));

    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("orden")).toBe("antiguedad_desc");
    });
  });
});

describe("Directorio de trabajadores · paginación y estados", () => {
  it("pagina sin perder los filtros aplicados", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.searchParams.has("facets")) return jsonResponse({ options: OPTIONS });
      if (url.searchParams.has("count")) return jsonResponse({ total: 60 });
      return jsonResponse({ workers: [worker("1"), worker("2")], total: 60, hasMore: true });
    });

    renderDirectory({ categories: ["TÉCNICO RADIÓLOGO"] });
    await screen.findAllByText(DISPLAY_NAME);

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    await waitFor(() => {
      const params = lastListCall()?.searchParams;
      expect(params?.get("pagina")).toBe("2");
      expect(params?.get("categoria")).toBe("TÉCNICO RADIÓLOGO");
    });
  });

  it("muestra estado vacío con opción de limpiar filtros", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.searchParams.has("facets")) return jsonResponse({ options: OPTIONS });
      if (url.searchParams.has("count")) return jsonResponse({ total: 0 });
      return jsonResponse({ workers: [], total: 0, hasMore: false });
    });

    renderDirectory({ q: "nadie" });
    expect(await screen.findByText("Sin resultados")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => {
      expect(lastListCall()?.searchParams.get("q")).toBeNull();
    });
  });

  it("muestra estado de error y reintenta", async () => {
    let fail = true;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.searchParams.has("facets")) return jsonResponse({ options: OPTIONS });
      if (url.searchParams.has("count")) return jsonResponse({ total: 0 });
      if (fail) throw new Error("network");
      return jsonResponse({ workers: [worker("1")], total: 1, hasMore: false });
    });

    renderDirectory();
    expect(await screen.findByText("No se pudo cargar el directorio")).toBeDefined();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findAllByText(DISPLAY_NAME)).not.toHaveLength(0);
  });
});

describe("Directorio de trabajadores · expediente y estado en URL", () => {
  it("abre el expediente conservando búsqueda, filtros, orden y página", async () => {
    renderDirectory({ q: "perez", categories: ["TÉCNICO RADIÓLOGO"], sort: "nombre_desc", page: 3 });
    await screen.findAllByText(DISPLAY_NAME);

    const links = screen.getAllByRole("link", { name: /Ver expediente/ });
    const href = links[0]?.getAttribute("href") ?? "";
    expect(href).toContain("/representacion/trabajadores/00000000-0000-4000-8000-000000000001?volver=");

    const volver = new URLSearchParams(decodeURIComponent(href.split("?volver=")[1]));
    const back = parseWorkerDirectoryQuery(volver);
    expect(back.q).toBe("perez");
    expect(back.categories).toEqual(["TÉCNICO RADIÓLOGO"]);
    expect(back.sort).toBe("nombre_desc");
    expect(back.page).toBe(3);
  });

  it("restaura filtros iniciales desde la URL del servidor", async () => {
    renderDirectory({ categories: ["AUXILIAR UNIVERSAL"], turns: ["MATUTINO"], status: "activos" });
    await screen.findAllByText(DISPLAY_NAME);

    await waitFor(() => {
      const params = lastListCall()?.searchParams;
      expect(params?.get("categoria")).toBe("AUXILIAR UNIVERSAL");
      expect(params?.get("turno")).toBe("MATUTINO");
      expect(params?.get("estado")).toBe("activos");
    });
    expect(screen.getByLabelText("Quitar filtro AUXILIAR UNIVERSAL")).toBeDefined();
  });
});
