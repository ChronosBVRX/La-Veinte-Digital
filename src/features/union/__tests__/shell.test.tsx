// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { UnionApplicationShell } from "../components/UnionApplicationShell";
import type { UnionMembership } from "@/features/representacion/services/permissions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/representacion",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: vi.fn().mockResolvedValue(undefined),
}));

const mockMemberships: UnionMembership[] = [
  {
    delegation_id: "del-xxi-uuid",
    delegation_code: "XXI",
    role: "union_admin",
  },
];

describe("UnionApplicationShell", () => {
  it("renderiza la identidad sindical institucional y el indicador Beta Privada", () => {
    render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido hijo</div>
      </UnionApplicationShell>
    );

    expect(screen.getAllByText("Representación Sindical").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Delegación XXI/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("BETA PRIVADA")).toBeDefined();
    expect(screen.getByText("Contenido hijo")).toBeDefined();
  });

  it("renderiza los nueve módulos sindicales requeridos", () => {
    render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    const requiredModules = [
      "Resumen",
      "Trabajadores",
      "Maternidad",
      "Lactancia",
      "Lockers",
      "Pasajes",
      "Licencias",
      "Expedientes",
      "Administración",
    ];

    for (const mod of requiredModules) {
      const elements = screen.getAllByText(mod);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("regresión de aislamiento: NO contiene ningún enlace a herramientas generales", () => {
    const { container } = render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    const forbiddenHrefs = [
      "/calculadoras",
      "/agenda",
      "/profile",
      "/documentos",
      "/radio",
      "/asistente",
      "/escritos",
    ];

    const links = Array.from(container.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href") ?? "");

    for (const forbidden of forbiddenHrefs) {
      const match = hrefs.some((h) => h === forbidden || h.startsWith(`${forbidden}/`));
      expect(match).toBe(false);
    }
  });

  it("NO renderiza DashboardShell, MobileValueBar ni componentes generales", () => {
    const { container } = render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    expect(container.querySelector(".mobile-app-shell")).toBeNull();
    expect(container.querySelector(".app-header")).toBeNull();
    expect(container.querySelector(".mobile-bottom-nav")).toBeNull();
    expect(screen.queryByLabelText("Consejo de La Veinte Digital")).toBeNull();
  });

  it("abre y cierra el drawer móvil accesible con botón, backdrop y Escape", () => {
    render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    const openButton = screen.getByLabelText("Abrir menú sindical");
    expect(openButton).toBeDefined();

    // Abre el drawer
    fireEvent.click(openButton);
    expect(openButton.getAttribute("aria-expanded")).toBe("true");

    const drawer = screen.getByRole("dialog", { name: "Menú de navegación sindical" });
    expect(drawer).toBeDefined();

    // Cierra con Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(openButton.getAttribute("aria-expanded")).toBe("false");

    // Abre de nuevo y cierra con el botón de cerrar
    fireEvent.click(openButton);
    const closeBtn = screen.getByLabelText("Cerrar menú sindical");
    fireEvent.click(closeBtn);
    expect(openButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("proporciona botón de cerrar sesión accesible", () => {
    render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    const signOutButtons = screen.getAllByRole("button", { name: "Cerrar sesión" });
    expect(signOutButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("minimización de PII: no muestra correos electrónicos en el encabezado ni en los paneles", () => {
    const rawEmail = "delegado.secreto@la20.com.mx";
    const { container } = render(
      <UnionApplicationShell memberships={mockMemberships} userName={rawEmail}>
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    // El correo no debe aparecer en ninguna parte del DOM
    expect(container.textContent).not.toContain(rawEmail);
    // En su lugar, debe mostrar el rol sindical
    expect(screen.getAllByText("Administrador Sindical").length).toBeGreaterThanOrEqual(1);
  });

  it("un union_rep solo ve los módulos sindicales: sin Administración ni panel de plataforma", () => {
    const repMemberships: UnionMembership[] = [
      { delegation_id: "del-xxi-uuid", delegation_code: "XXI", role: "union_rep" },
    ];
    render(
      <UnionApplicationShell memberships={repMemberships} userName="Representante Prueba">
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    // Módulos de representación disponibles
    expect(screen.getAllByText("Trabajadores").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Licencias").length).toBeGreaterThanOrEqual(1);
    // Administración Sindical (solo union_admin) y Administración de plataforma
    expect(screen.queryByText("Administración")).toBeNull();
    expect(screen.queryByText("Panel de administración")).toBeNull();
  });

  it("un union_admin de plataforma ve el enlace de regreso a Administración", () => {
    const { container } = render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba" isPlatformAdmin>
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    expect(screen.getAllByText("Panel de administración").length).toBeGreaterThanOrEqual(1);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/admin");
    // El enlace de plataforma no abre herramientas generales de trabajador
    expect(hrefs).not.toContain("/calculadoras");
  });

  it("sin rol de plataforma no se muestra el enlace de Administración", () => {
    render(
      <UnionApplicationShell memberships={mockMemberships} userName="Delegado Prueba" isPlatformAdmin={false}>
        <div>Contenido</div>
      </UnionApplicationShell>
    );

    expect(screen.queryByText("Panel de administración")).toBeNull();
  });
});

describe("UnionAccessDenied", () => {
  it("renderiza el mensaje discreto de acceso denegado y opción de cerrar sesión", async () => {
    const { UnionAccessDenied } = await import("../components/UnionAccessDenied");
    const { container } = render(<UnionAccessDenied />);

    expect(
      screen.getByText("No tienes autorización para acceder a Representación Sindical.")
    ).toBeDefined();
    expect(
      screen.getByText(/Este espacio está reservado para el cuerpo de representación/)
    ).toBeDefined();

    // Botón de cerrar sesión disponible
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDefined();

    // Cero módulos sindicales ni barras generales
    expect(screen.queryByText("MÓDULOS SINDICALES")).toBeNull();
    expect(screen.queryByText("BETA PRIVADA")).toBeNull();
    expect(container.querySelector(".mobile-bottom-nav")).toBeNull();
  });
});
