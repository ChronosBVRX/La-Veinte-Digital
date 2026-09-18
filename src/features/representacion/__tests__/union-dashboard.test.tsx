// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  formatRelativeTimeEs,
  formatCaseTypeLabel,
  formatCaseStatusLabel,
  type UnionDashboardSummary,
} from "../lib/dashboard-format";
import { DashboardClient } from "../components/DashboardClient";
import { DashboardQuickSearch } from "../components/DashboardQuickSearch";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/representacion",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
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

const mockSummaryData: UnionDashboardSummary = {
  delegation: {
    id: "del-xxi-123",
    code: "XXI",
    name: "Delegación XXI",
    section: "SNTSS · SECCIÓN XX MICHOACÁN",
    facility: "HGR No. 1 Charo",
  },
  metrics: {
    workers: {
      total: 186,
      active: 184,
      error: false,
    },
    cases: {
      total: 94,
      error: false,
    },
    lockers: {
      total: 46,
      assigned: 34,
      available: 12,
      occupancyPercentage: 74,
      waitlistCount: 2,
      error: false,
    },
    procedures: {
      inProgress: 7,
      drafts: 3,
      underReview: 4,
      error: false,
    },
    attentionCount: 3,
  },
  attentionItems: [
    {
      id: "att-draft-1",
      caseId: "case-lic-001",
      type: "license_draft",
      title: "Licencia XXI-2026-LIC-000005",
      subtitle: "Borrador sin finalizar · Eduardo Bolaños Vazquez (98173968)",
      actionLabel: "Continuar",
      actionHref: "/representacion/licencias?case=case-lic-001&action=continue",
      urgency: "high",
      date: "2026-09-18T10:00:00Z",
    },
    {
      id: "att-review-2",
      caseId: "case-pas-002",
      type: "case_under_review",
      title: "Pasaje 026 XXI-2026-PAS-000002",
      subtitle: "Enviado · Mariana Torres",
      actionLabel: "Revisar",
      actionHref: "/representacion/expedientes?folio=XXI-2026-PAS-000002",
      urgency: "medium",
      date: "2026-09-17T15:00:00Z",
    },
    {
      id: "att-lockers-waitlist",
      type: "locker_waitlist",
      title: "2 compañeros en lista de espera",
      subtitle: "Hay 12 casilleros disponibles para asignar",
      actionLabel: "Asignar",
      actionHref: "/representacion/lockers",
      urgency: "medium",
    },
  ],
  recentActivity: [
    {
      id: "case-lic-006",
      title: "Licencia XXI-2026-LIC-000006",
      detail: "Borrador · Rodrigo Morales",
      timeAgo: "Hace 12 min",
      timestamp: "2026-09-18T12:00:00Z",
      caseType: "license",
      folio: "XXI-2026-LIC-000006",
      href: "/representacion/licencias?case=case-lic-006&action=edit",
    },
    {
      id: "case-pas-003",
      title: "Pasaje 026 XXI-2026-PAS-000003",
      detail: "Completado · Valeria Sánchez",
      timeAgo: "Hace 1 h",
      timestamp: "2026-09-18T11:00:00Z",
      caseType: "passage_026",
      folio: "XXI-2026-PAS-000003",
      href: "/representacion/expedientes?folio=XXI-2026-PAS-000003",
    },
  ],
};

describe("Centro de Control de Representación Sindical", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Funciones de formato y helpers puros", () => {
    it("formatRelativeTimeEs formatea diferencias de tiempo en español", () => {
      const now = Date.now();
      expect(formatRelativeTimeEs(new Date(now - 10000).toISOString())).toBe("Hace un momento");
      expect(formatRelativeTimeEs(new Date(now - 12 * 60000).toISOString())).toBe("Hace 12 min");
      expect(formatRelativeTimeEs(new Date(now - 2 * 3600000).toISOString())).toBe("Hace 2 h");
      expect(formatRelativeTimeEs(new Date(now - 26 * 3600000).toISOString())).toBe("Ayer");
      expect(formatRelativeTimeEs(new Date(now - 4 * 86400000).toISOString())).toBe("Hace 4 días");
    });

    it("formatCaseTypeLabel devuelve etiquetas institucionales legibles", () => {
      expect(formatCaseTypeLabel("license")).toBe("Licencia");
      expect(formatCaseTypeLabel("maternity")).toBe("Maternidad");
      expect(formatCaseTypeLabel("lactation")).toBe("Lactancia");
      expect(formatCaseTypeLabel("passage_026")).toBe("Pasaje 026");
      expect(formatCaseTypeLabel("passage_027")).toBe("Pasaje 027");
      expect(formatCaseTypeLabel("locker")).toBe("Casillero");
      expect(formatCaseTypeLabel("unknown")).toBe("Expediente");
    });

    it("formatCaseStatusLabel traduce correctamente los estados del expediente", () => {
      expect(formatCaseStatusLabel("draft")).toBe("Borrador");
      expect(formatCaseStatusLabel("ready")).toBe("Listo para firma");
      expect(formatCaseStatusLabel("submitted")).toBe("Enviado");
      expect(formatCaseStatusLabel("under_review")).toBe("En revisión");
      expect(formatCaseStatusLabel("completed")).toBe("Completado");
    });
  });

  describe("DashboardClient — Renderizado y Comportamiento", () => {
    it("renderiza encabezado institucional y situación actual con métricas reales", () => {
      render(<DashboardClient initialData={mockSummaryData} isAdmin={false} />);

      // Encabezado
      expect(screen.getByText("Centro de Representación Sindical")).toBeDefined();
      expect(screen.getByText(/Delegación XXI · HGR No. 1 Charo/)).toBeDefined();

      // Métricas KPI
      expect(screen.getByText("186")).toBeDefined();
      expect(screen.getByText("184 activos")).toBeDefined();
      expect(screen.getByText("94")).toBeDefined();
      expect(screen.getByText("34 de 46 asignados")).toBeDefined();
      expect(screen.getAllByText("12 disponibles").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("74%")).toBeDefined();
      expect(screen.getByText("7")).toBeDefined();
      expect(screen.getByText("3 borradores · 4 en revisión")).toBeDefined();
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Requieren atención")).toBeDefined();
    });

    it("renderiza la sección '¿Qué quieres hacer?' con enlaces y botones secundarios", () => {
      render(<DashboardClient initialData={mockSummaryData} isAdmin={false} />);

      expect(screen.getByText("¿Qué quieres hacer?")).toBeDefined();
      expect(screen.getByText("Licencias")).toBeDefined();
      expect(screen.getByText("Maternidad")).toBeDefined();
      expect(screen.getByText("Lactancia")).toBeDefined();
      expect(screen.getByText("Pasajes")).toBeDefined();
      expect(screen.getAllByText("Lockers").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Trabajadores").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Expedientes").length).toBeGreaterThanOrEqual(1);

      // Botón secundario "Nueva" en Licencias
      const newLicenseLink = screen.getByRole("link", { name: /Nueva/ });
      expect(newLicenseLink).toBeDefined();
      expect(newLicenseLink.getAttribute("href")).toBe("/representacion/licencias?action=new");

      // Badge dinámico en Lockers y Trabajadores
      expect(screen.getAllByText("12 disponibles").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("186 registrados")).toBeDefined();
    });

    it("respeta el rol sindical: oculta Administración a union_rep y lo muestra a union_admin", () => {
      const { unmount } = render(<DashboardClient initialData={mockSummaryData} isAdmin={false} />);
      expect(screen.queryByText("Administración")).toBeNull();
      unmount();

      render(<DashboardClient initialData={mockSummaryData} isAdmin={true} />);
      expect(screen.getByText("Administración")).toBeDefined();
      expect(screen.getByText("Comité XXI, miembros y auditoría del sistema.")).toBeDefined();
    });

    it("renderiza la sección 'Requiere tu atención' cuando hay pendientes y ofrece enlaces directos", () => {
      render(<DashboardClient initialData={mockSummaryData} isAdmin={false} />);

      expect(screen.getByText("Requiere tu atención")).toBeDefined();
      expect(screen.getByText("Licencia XXI-2026-LIC-000005")).toBeDefined();
      expect(screen.getByText(/Borrador sin finalizar · Eduardo Bolaños Vazquez/)).toBeDefined();

      const continueBtn = screen.getByRole("link", { name: /Continuar/ });
      expect(continueBtn).toBeDefined();
      expect(continueBtn.getAttribute("href")).toBe("/representacion/licencias?case=case-lic-001&action=continue");

      const waitlistAction = screen.getByRole("link", { name: /Asignar/ });
      expect(waitlistAction.getAttribute("href")).toBe("/representacion/lockers");
    });

    it("oculta la sección 'Requiere tu atención' si no hay pendientes", () => {
      const emptyAttentionData: UnionDashboardSummary = {
        ...mockSummaryData,
        metrics: {
          ...mockSummaryData.metrics,
          attentionCount: 0,
        },
        attentionItems: [],
      };

      render(<DashboardClient initialData={emptyAttentionData} isAdmin={false} />);
      expect(screen.queryByText("Requiere tu atención")).toBeNull();
      expect(screen.getByText("Al día sin pendientes")).toBeDefined();
    });

    it("renderiza la sección 'Actividad reciente' sin información médica sensible", () => {
      render(<DashboardClient initialData={mockSummaryData} isAdmin={false} />);

      expect(screen.getByText("Actividad reciente")).toBeDefined();
      expect(screen.getByText("Licencia XXI-2026-LIC-000006")).toBeDefined();
      expect(screen.getByText("Hace 12 min")).toBeDefined();
      expect(screen.getByText("Pasaje 026 XXI-2026-PAS-000003")).toBeDefined();
      expect(screen.getByText("Hace 1 h")).toBeDefined();
    });

    it("maneja tolerancia a fallos parciales: muestra 'No disponible' en la tarjeta con error sin romper el resto", () => {
      const partialErrorData: UnionDashboardSummary = {
        ...mockSummaryData,
        metrics: {
          ...mockSummaryData.metrics,
          workers: { total: null, active: null, error: true },
        },
      };

      render(<DashboardClient initialData={partialErrorData} isAdmin={false} />);
      expect(screen.getByText("No disponible")).toBeDefined();
      // Las demás métricas siguen operativas
      expect(screen.getByText("94")).toBeDefined();
      expect(screen.getByText("34 de 46 asignados")).toBeDefined();
    });
  });

  describe("DashboardQuickSearch — Búsqueda rápida", () => {
    it("renderiza el input de búsqueda rápida con el placeholder institucional", () => {
      render(<DashboardQuickSearch />);
      expect(screen.getByPlaceholderText("Buscar trabajador, matrícula o expediente...")).toBeDefined();
    });

    it("navega a expedientes con Enter si el término contiene patrón de folio institucional", () => {
      render(<DashboardQuickSearch />);
      const input = screen.getByRole("searchbox");

      fireEvent.change(input, { target: { value: "XXI-2026-LIC-000005" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockPush).toHaveBeenCalledWith("/representacion/expedientes?folio=XXI-2026-LIC-000005");
    });

    it("navega a trabajadores con Enter si el término es un nombre o matrícula común", () => {
      render(<DashboardQuickSearch />);
      const input = screen.getByRole("searchbox");

      fireEvent.change(input, { target: { value: "Bolaños" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockPush).toHaveBeenCalledWith("/representacion/trabajadores?q=Bola%C3%B1os");
    });
  });
});
