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
  getLockerEffectiveState,
  type LockerZone,
  type LockerMapItem,
} from "@/features/representacion/lib/lockers";
import { LockerSummaryCards } from "../components/lockers/LockerSummaryCards";
import { LockerToolbar } from "../components/lockers/LockerToolbar";
import { LockerDesktopTable, type LockerItem } from "../components/lockers/LockerDesktopTable";
import { LockerMobileList } from "../components/lockers/LockerMobileList";
import { LockerAssignSheet } from "../components/lockers/LockerAssignSheet";
import { LockerReleaseModal } from "../components/lockers/LockerReleaseModal";
import { LockerStatusBadge } from "../components/lockers/LockerStatusBadge";
import { LockerZoneNavigator } from "../components/lockers/LockerZoneNavigator";
import { LockerArchiveModal } from "../components/lockers/LockerArchiveModal";
import { LockerHardDeleteModal } from "../components/lockers/LockerHardDeleteModal";
import { LockerZoneMap } from "../components/lockers/LockerZoneMap";
import { LockerControlCenter } from "../components/lockers/LockerControlCenter";

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

  describe("9. Navegación intuitiva de 2 niveles por género y zona por zona", () => {
    const baseZone: LockerZone = {
      id: "z-base",
      delegation_id: "del-1",
      name: "Zona Base",
      description: "",
      building: "Principal",
      floor: "PB",
      sort_order: 1,
      active: true,
    };

    const sampleZones: LockerZone[] = [
      { ...baseZone, id: "zw-1", name: "Vestidores Mujeres - Terapias Baños", sort_order: 1 },
      { ...baseZone, id: "zw-2", name: "Vestidores Mujeres - Terapias Pasillo", sort_order: 2 },
      { ...baseZone, id: "zm-1", name: "Vestidores Hombres - Terapias Baños (Hombres)", sort_order: 9 },
      { ...baseZone, id: "zm-2", name: "Vestidores Hombres - Pasillo Largo (Hombres)", sort_order: 10 },
    ];

    const baseMapLocker = {
      id: "loc-w1",
      locker_number: "1001",
      zone_id: "zw-1",
      bank_id: null,
      row_position: 1,
      column_position: 1,
      status: "available",
      condition: "ok" as const,
    };

    const sampleLockers: LockerMapItem[] = [
      {
        ...baseMapLocker,
        effective_state: getLockerEffectiveState(baseMapLocker as LockerMapItem),
      },
      {
        ...baseMapLocker,
        id: "loc-w2",
        locker_number: "1002",
        zone_id: "zw-2",
        status: "assigned",
        occupant_name: "Ana Gómez",
        effective_state: getLockerEffectiveState({
          ...baseMapLocker,
          id: "loc-w2",
          locker_number: "1002",
          zone_id: "zw-2",
          status: "assigned",
          occupant_name: "Ana Gómez",
        } as LockerMapItem),
      },
      {
        ...baseMapLocker,
        id: "loc-m1",
        locker_number: "1201",
        zone_id: "zm-1",
        effective_state: getLockerEffectiveState({
          ...baseMapLocker,
          id: "loc-m1",
          locker_number: "1201",
          zone_id: "zm-1",
        } as LockerMapItem),
      },
    ];

    it("separa Vestidores Mujeres y Vestidores Hombres en nivel 1 y permite recorrer zona por zona en nivel 2", () => {
      const onSelectZone = vi.fn();
      render(
        <LockerZoneNavigator
          zones={sampleZones}
          selectedZoneId="all"
          unlocatedCount={0}
          totalLockersCount={3}
          onSelectZone={onSelectZone}
        />
      );

      expect(screen.getByText("Vestidores Mujeres")).toBeDefined();
      expect(screen.getByText("Vestidores Hombres")).toBeDefined();

      // Por defecto muestra las zonas de Mujeres con nombre corto limpio
      expect(screen.getAllByText("Terapias Baños").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Terapias Pasillo")).toBeDefined();

      // Botón Siguiente zona avanza de zw-1 a zw-2
      const nextBtn = screen.getByRole("button", { name: /Siguiente zona/i });
      fireEvent.click(nextBtn);
      expect(onSelectZone).toHaveBeenCalledWith("zw-2");

      // Clic en sección Vestidores Hombres selecciona la primera zona de hombres (zm-1)
      fireEvent.click(screen.getByText("Vestidores Hombres"));
      expect(onSelectZone).toHaveBeenCalledWith("zm-1");
    });

    it("muestra una sola zona a la vez por defecto en el mapa (evitando saturar con todas las zonas)", () => {
      const onSelectZone = vi.fn();
      render(
        <LockerZoneMap
          zones={sampleZones}
          banks={[]}
          lockers={sampleLockers}
          selectedZoneId="all"
          onLockerClick={vi.fn()}
          onSelectZone={onSelectZone}
        />
      );

      // Solo se monta el locker 1001 de la primera zona (zw-1), no el 1002 (zw-2) ni el 1201 (zm-1)
      expect(screen.getByText("1001")).toBeDefined();
      expect(screen.queryByText("1002")).toBeNull();
      expect(screen.queryByText("1201")).toBeNull();
    });
  });

  describe("11. Búsqueda de casilleros sin interrupción al teclear números", () => {
    it("permite teclear números en el buscador del mapa sin abrir prematuramente el modal de detalle", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/union/lockers/map")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                zones: [{ id: "z1", name: "Vestidores Planta Baja", total_lockers: 3, assigned_lockers: 1, available_lockers: 2 }],
                banks: [],
                lockers: [
                  { id: "loc-1", locker_number: "1", status: "assigned", zone_id: "z1" },
                  { id: "loc-14", locker_number: "14", status: "available", zone_id: "z1" },
                  { id: "loc-145", locker_number: "145", status: "available", zone_id: "z1" },
                ],
                summary: { total: 3, assigned: 1, available: 2, maintenance: 0, blocked: 0, reserved: 0, unlocated: 0 },
              }),
          });
        }
        if (url.includes("/api/union/waitlist")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ count: 0, waitlist: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(<LockerControlCenter isAdmin={true} />);

      // Esperar a que cargue el mapa
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Buscar casillero # o trabajador...")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText("Buscar casillero # o trabajador...") as HTMLInputElement;

      // El usuario teclea "1" (queriendo buscar 145)
      fireEvent.change(searchInput, { target: { value: "1" } });

      // No debe abrir automáticamente el drawer lateral ni el modal de detalle del casillero 1
      expect(searchInput.value).toBe("1");
      expect(screen.queryByText(/Historial de asignaciones/i)).toBeNull();

      // El usuario continúa escribiendo "145" sin interrupciones
      fireEvent.change(searchInput, { target: { value: "145" } });
      expect(searchInput.value).toBe("145");
      expect(screen.queryByText(/Historial de asignaciones/i)).toBeNull();

      // Al pulsar Enter, se confirma la búsqueda intencional y se actualiza la ruta con el locker encontrado
      fireEvent.keyDown(searchInput, { key: "Enter" });
      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalled();
      });
    });

    it("en LockerAssignSheet permite escribir el número de casillero sin errores prematuros", () => {
      render(
        <LockerAssignSheet
          isOpen={true}
          onClose={vi.fn()}
          initialLocker={null}
          onSuccess={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText("Número de locker (ej. 25)…") as HTMLInputElement;
      expect(input).toBeDefined();

      // Escribir "2" no debe mostrar error inmediatamente
      fireEvent.change(input, { target: { value: "2" } });
      expect(input.value).toBe("2");
      expect(screen.queryByRole("alert")).toBeNull();

      // Completar a "25"
      fireEvent.change(input, { target: { value: "25" } });
      expect(input.value).toBe("25");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("Protección contra opciones destructivas y flujo seguro de Papelera", () => {
    it("LockerDesktopTable: un casillero activo solo muestra 'Enviar a papelera' y nunca eliminación definitiva", () => {
      const activeLocker: LockerItem = {
        id: "l-active",
        locker_number: "101",
        status: "available",
        archived_at: null,
      };

      render(
        <LockerDesktopTable
          lockers={[activeLocker]}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onOpenDetail={vi.fn()}
          onOpenAssign={vi.fn()}
          onOpenRelease={vi.fn()}
          onOpenArchive={vi.fn()}
          onOpenHardDelete={vi.fn()}
          onSetStatus={vi.fn()}
          isAdmin={true}
        />
      );

      // Abrir menú de acciones
      const menuButton = screen.getByLabelText("Acciones del locker 101");
      fireEvent.click(menuButton);

      // Debe mostrar la opción segura de Papelera
      expect(screen.getByText("🗑 Enviar a papelera")).toBeDefined();

      // NUNCA debe mostrar la opción destructiva en casilleros activos
      expect(screen.queryByText("🗑 Eliminar definitivamente")).toBeNull();
    });

    it("LockerDesktopTable: un casillero en papelera muestra 'Restaurar de papelera' y acceso condicionado a eliminación definitiva", () => {
      const archivedLocker: LockerItem = {
        id: "l-archived",
        locker_number: "102",
        status: "available",
        archived_at: "2026-09-20T10:00:00Z",
      };

      render(
        <LockerDesktopTable
          lockers={[archivedLocker]}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onOpenDetail={vi.fn()}
          onOpenAssign={vi.fn()}
          onOpenRelease={vi.fn()}
          onOpenArchive={vi.fn()}
          onOpenHardDelete={vi.fn()}
          onSetStatus={vi.fn()}
          isAdmin={true}
        />
      );

      // Abrir menú de acciones
      const menuButton = screen.getByLabelText("Acciones del locker 102");
      fireEvent.click(menuButton);

      // Debe mostrar Restaurar de papelera
      expect(screen.getByText("♻️ Restaurar de papelera")).toBeDefined();

      // Por estar en papelera y ser admin, muestra la opción excepcional
      expect(screen.getByText("🗑 Eliminar definitivamente")).toBeDefined();
    });

    it("LockerArchiveModal: utiliza terminología clara de Papelera y resguardo", () => {
      const activeLocker = {
        id: "l-arch-test",
        locker_number: "205",
        archived_at: null,
      };

      const { rerender } = render(
        <LockerArchiveModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          locker={activeLocker}
        />
      );

      expect(screen.getByText("Enviar casillero 205 a papelera")).toBeDefined();
      expect(screen.getByText("Enviar a papelera")).toBeDefined();

      // Si el casillero ya está archivado
      rerender(
        <LockerArchiveModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          locker={{ ...activeLocker, archived_at: "2026-09-20T10:00:00Z" }}
        />
      );

      expect(screen.getByText("Restaurar casillero 205 de papelera")).toBeDefined();
      expect(screen.getByText("Restaurar a inventario")).toBeDefined();
    });

    it("LockerHardDeleteModal: aplica candados y exige doble verificación (checkbox + tecleo exacto)", () => {
      const archivedLocker = {
        id: "l-del-test",
        locker_number: "305",
        archived_at: "2026-09-20T10:00:00Z",
      };

      render(
        <LockerHardDeleteModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          locker={archivedLocker}
        />
      );

      const deleteButton = screen.getByRole("button", { name: /Destruir definitivamente/i }) as HTMLButtonElement;
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      const input = screen.getByPlaceholderText("305") as HTMLInputElement;

      // Inicialmente deshabilitado
      expect(deleteButton.disabled).toBe(true);

      // Solo tecleando el número sin marcar el checkbox -> sigue deshabilitado
      fireEvent.change(input, { target: { value: "305" } });
      expect(deleteButton.disabled).toBe(true);

      // Solo marcando el checkbox sin teclear el número exacto -> sigue deshabilitado
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      expect(deleteButton.disabled).toBe(true);

      // Doble verificación cumplida: checkbox marcado Y número exacto
      fireEvent.change(input, { target: { value: "305" } });
      expect(deleteButton.disabled).toBe(false);
    });

    it("LockerHardDeleteModal: bloquea la acción si el casillero no está en la papelera", () => {
      const nonArchivedLocker = {
        id: "l-non-arch",
        locker_number: "405",
        archived_at: null,
      };

      render(
        <LockerHardDeleteModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          locker={nonArchivedLocker}
        />
      );

      expect(screen.getByText(/Este casillero no está en la papelera/i)).toBeDefined();
      const deleteButton = screen.getByRole("button", { name: /Destruir definitivamente/i }) as HTMLButtonElement;
      expect(deleteButton.disabled).toBe(true);
    });
  });
});

