// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/representacion/lockers",
  useSearchParams: () => new URLSearchParams(),
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

import {
  naturalCompare,
  getLockerStatusLabel,
  getLockerStatusBadge,
} from "@/features/representacion/lib/lockers";
import { LockerSummaryCards } from "../components/lockers/LockerSummaryCards";
import { LockerToolbar } from "../components/lockers/LockerToolbar";
import { LockerDesktopTable, type LockerItem } from "../components/lockers/LockerDesktopTable";
import { LockerMobileList } from "../components/lockers/LockerMobileList";
import { LockerAssignSheet } from "../components/lockers/LockerAssignSheet";
import { LockerDetailSheet } from "../components/lockers/LockerDetailSheet";
import { LockerReleaseModal } from "../components/lockers/LockerReleaseModal";
import { LockerStatusBadge } from "../components/lockers/LockerStatusBadge";

const MOCK_LOCKERS: LockerItem[] = [
  {
    id: "l-1",
    locker_number: "1",
    status: "available",
    location: "Piso 1",
    section: "A",
  },
  {
    id: "l-2",
    locker_number: "2",
    status: "assigned",
    active_assignment: {
      id: "asg-2",
      assigned_at: "2026-09-16T12:00:00Z",
      status: "active",
      union_workers: {
        first_name: "María",
        paternal_surname: "López",
        maternal_surname: "García",
        employee_number: "12345678",
      },
    },
  },
  {
    id: "l-3",
    locker_number: "3",
    status: "available",
    pending_review_item: {
      id: "p-3",
      delegation_id: "del-1",
      locker_id: "l-3",
      locker_number: "3",
      source_batch_id: "b-1",
      source_row_number: 14,
      source_employee_number: "87654321",
      source_worker_name: "Juan Pérez",
      source_notes: "Trabajador no en padrón",
      reason: "WORKER_NOT_FOUND",
      status: "pending",
      resolved_by: null,
      resolved_at: null,
      resolution: null,
      metadata: {},
      created_at: "2026-09-17T08:00:00Z",
      updated_at: "2026-09-17T08:00:00Z",
    },
  },
  {
    id: "l-10",
    locker_number: "10",
    status: "maintenance",
  },
];

describe("Rediseño UX/UI de Lockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Etiquetas de estado 100% en español (Eliminación de inglés)", () => {
    it("traduce todos los estados del backend a español", () => {
      expect(getLockerStatusLabel("available")).toBe("Disponible");
      expect(getLockerStatusLabel("assigned")).toBe("Asignado");
      expect(getLockerStatusLabel("maintenance")).toBe("Mantenimiento");
      expect(getLockerStatusLabel("blocked")).toBe("Bloqueado");
      expect(getLockerStatusLabel("reserved")).toBe("Reservado");
      expect(getLockerStatusLabel("pending")).toBe("Por revisar");

      // Plurales para filtros
      expect(getLockerStatusLabel("available", { plural: true })).toBe("Disponibles");
      expect(getLockerStatusLabel("assigned", { plural: true })).toBe("Asignados");
      expect(getLockerStatusLabel("maintenance", { plural: true })).toBe("En mantenimiento");
      expect(getLockerStatusLabel("blocked", { plural: true })).toBe("Bloqueados");
    });

    it("renderiza badges con puntos indicadores y contraste accesible", () => {
      const { container } = render(<LockerStatusBadge status="available" />);
      expect(container.textContent).toContain("Disponible");
      expect(container.textContent).not.toContain("available");

      const { container: pendingContainer } = render(
        <LockerStatusBadge status="assigned" hasPending={true} />
      );
      expect(pendingContainer.textContent).toContain("Por revisar");
    });
  });

  describe("2. Orden natural numérico de casilleros", () => {
    it("ordena números naturalmente (1, 2, 3... 10... 100) en lugar de orden lexicográfico (1, 10, 100, 2)", () => {
      const numbers = ["10", "1", "100", "2", "20", "25", "3", "99"];
      const sorted = [...numbers].sort(naturalCompare);
      expect(sorted).toEqual(["1", "2", "3", "10", "20", "25", "99", "100"]);
    });

    it("soporta identificadores con letras de sección en orden natural", () => {
      const mixed = ["L-10", "L-1", "L-2", "L-20"];
      const sorted = [...mixed].sort(naturalCompare);
      expect(sorted).toEqual(["L-1", "L-2", "L-10", "L-20"]);
    });
  });

  describe("3. Resumen visual de 4 métricas y tarjeta de pendientes", () => {
    it("renderiza las 4 métricas principales con datos reales", () => {
      render(
        <LockerSummaryCards
          counts={{
            total: 1199,
            assigned: 357,
            available: 842,
            reserved: 0,
            maintenance: 0,
            blocked: 0,
            pending: 885,
          }}
        />
      );

      expect(screen.getByText("Total de lockers")).toBeDefined();
      expect(screen.getByText("1,199")).toBeDefined();

      expect(screen.getByText("Asignados")).toBeDefined();
      expect(screen.getByText("357")).toBeDefined();

      expect(screen.getByText("Disponibles")).toBeDefined();
      expect(screen.getByText("842")).toBeDefined();

      expect(screen.getByText("Por revisar")).toBeDefined();
      expect(screen.getByText("885")).toBeDefined();
    });

    it("muestra tarjeta ámbar suave cuando hay pendientes con enlace directo", () => {
      render(
        <LockerSummaryCards
          counts={{
            total: 1199,
            assigned: 357,
            available: 842,
            reserved: 0,
            maintenance: 0,
            blocked: 0,
            pending: 885,
          }}
        />
      );

      expect(screen.getByText(/Información por revisar/i)).toBeDefined();
      expect(screen.getByText(/885 pendientes/i)).toBeDefined();
      const link = screen.getByRole("link", { name: /Revisar pendientes/i });
      expect(link.getAttribute("href")).toBe("/representacion/lockers/pendientes");
    });

    it("muestra banner verde de información al día si pendientes es 0", () => {
      render(
        <LockerSummaryCards
          counts={{
            total: 1199,
            assigned: 357,
            available: 842,
            reserved: 0,
            maintenance: 0,
            blocked: 0,
            pending: 0,
          }}
        />
      );

      expect(screen.getByText("Información al día")).toBeDefined();
      expect(screen.getByText(/No tienes pendientes por revisar/i)).toBeDefined();
    });
  });

  describe("4. Barra de herramientas unificada", () => {
    it("incluye buscador debounced con placeholder en español", () => {
      const onSearch = vi.fn();
      render(
        <LockerToolbar
          searchQuery=""
          onSearchChange={onSearch}
          statusFilter="all"
          onStatusChange={vi.fn()}
          sortOrder="number_asc"
          onSortChange={vi.fn()}
          pageSize={25}
          onPageSizeChange={vi.fn()}
          onResetFilters={vi.fn()}
          hasActiveFilters={false}
        />
      );

      const input = screen.getByPlaceholderText("Buscar por locker, matrícula o trabajador…");
      expect(input).toBeDefined();

      fireEvent.change(input, { target: { value: "42" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSearch).toHaveBeenCalledWith("42");
    });

    it("presenta selector de estado con opciones en español", () => {
      const onStatus = vi.fn();
      render(
        <LockerToolbar
          searchQuery=""
          onSearchChange={vi.fn()}
          statusFilter="all"
          onStatusChange={onStatus}
          sortOrder="number_asc"
          onSortChange={vi.fn()}
          pageSize={25}
          onPageSizeChange={vi.fn()}
          onResetFilters={vi.fn()}
          hasActiveFilters={false}
        />
      );

      const select = screen.getByLabelText("Filtrar por estado");
      fireEvent.change(select, { target: { value: "available" } });
      expect(onStatus).toHaveBeenCalledWith("available");
    });

    it("permite limpiar filtros cuando hay una búsqueda o filtro activo", () => {
      const onReset = vi.fn();
      render(
        <LockerToolbar
          searchQuery="Pérez"
          onSearchChange={vi.fn()}
          statusFilter="assigned"
          onStatusChange={vi.fn()}
          sortOrder="number_asc"
          onSortChange={vi.fn()}
          pageSize={25}
          onPageSizeChange={vi.fn()}
          onResetFilters={onReset}
          hasActiveFilters={true}
        />
      );

      const clearBtn = screen.getByRole("button", { name: /Limpiar todos los filtros/i });
      fireEvent.click(clearBtn);
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe("5. Tabla administrativa de escritorio", () => {
    it("renderiza columnas administrativas y filas con nombres y matrículas", () => {
      const onOpenDetail = vi.fn();
      render(
        <LockerDesktopTable
          lockers={MOCK_LOCKERS}
          onOpenDetail={onOpenDetail}
          onOpenAssign={vi.fn()}
          onOpenRelease={vi.fn()}
          onSetStatus={vi.fn()}
        />
      );

      expect(screen.getByText("Locker 1")).toBeDefined();
      expect(screen.getByText("Locker 2")).toBeDefined();
      expect(screen.getByText("Locker 3")).toBeDefined();
      expect(screen.getByText("López García María")).toBeDefined();
      expect(screen.getByText("12345678")).toBeDefined();

      // Clic en fila abre detalle
      fireEvent.click(screen.getByText("Locker 2"));
      expect(onOpenDetail).toHaveBeenCalledWith("l-2");
    });

    it("abre menú contextual ⋯ con opciones dependientes del estado", () => {
      const onOpenAssign = vi.fn();
      render(
        <LockerDesktopTable
          lockers={MOCK_LOCKERS}
          onOpenDetail={vi.fn()}
          onOpenAssign={onOpenAssign}
          onOpenRelease={vi.fn()}
          onSetStatus={vi.fn()}
        />
      );

      const menuBtn = screen.getByLabelText("Acciones del locker 1");
      fireEvent.click(menuBtn);

      const assignOption = screen.getByText("➕ Asignar locker");
      fireEvent.click(assignOption);
      expect(onOpenAssign).toHaveBeenCalledWith(MOCK_LOCKERS[0]);
    });
  });

  describe("6. Lista móvil de tarjetas", () => {
    it("renderiza tarjetas compactas con botones táctiles accesibles", () => {
      render(
        <LockerMobileList
          lockers={MOCK_LOCKERS}
          onOpenDetail={vi.fn()}
          onOpenAssign={vi.fn()}
          onOpenRelease={vi.fn()}
        />
      );

      expect(screen.getByText("Locker 1")).toBeDefined();
      expect(screen.getAllByText("Sin trabajador asignado").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("López García María")).toBeDefined();
    });
  });

  describe("7. Sheet lateral de asignación (Sin UUIDs ni jerga override)", () => {
    beforeEach(() => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const u = String(url);
        if (u.includes("check_worker_id=w-existing")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasActiveLocker: true, currentLockerNumber: "12" }),
          } as Response);
        }
        if (u.includes("check_worker_id=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasActiveLocker: false }),
          } as Response);
        }
        if (u.includes("/api/union/lockers?q=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ lockers: [MOCK_LOCKERS[0]] }),
          } as Response);
        }
        if (u.includes("/api/union/workers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ workers: [] }),
          } as Response);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      });
    });

    it("no renderiza tecnicismos como 'ID o número' ni 'UUID'", () => {
      render(
        <LockerAssignSheet
          isOpen={true}
          onClose={vi.fn()}
          initialLocker={MOCK_LOCKERS[0]}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.queryByText(/ID o número/i)).toBeNull();
      expect(screen.queryByText(/UUID/i)).toBeNull();
      expect(screen.getByText("Locker 1")).toBeDefined();
    });

    it("cierra el Sheet al pulsar Cancelar o tecla Escape", () => {
      const onClose = vi.fn();
      render(
        <LockerAssignSheet
          isOpen={true}
          onClose={onClose}
          initialLocker={MOCK_LOCKERS[0]}
          onSuccess={vi.fn()}
        />
      );

      const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("8. Modal de confirmación de liberación (Reemplazo de window.prompt)", () => {
    it("solicita motivo de liberación y emite confirmación", () => {
      const onConfirm = vi.fn();
      render(
        <LockerReleaseModal
          isOpen={true}
          lockerNumber="25"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText("Liberar locker 25")).toBeDefined();
      const input = screen.getByPlaceholderText("ej. Cambio de turno, baja, solicitud voluntaria…");

      fireEvent.change(input, { target: { value: "Cambio de servicio" } });
      const submitBtn = screen.getByRole("button", { name: "Liberar casillero" });
      fireEvent.click(submitBtn);

      expect(onConfirm).toHaveBeenCalledWith("Cambio de servicio");
    });
  });
});
