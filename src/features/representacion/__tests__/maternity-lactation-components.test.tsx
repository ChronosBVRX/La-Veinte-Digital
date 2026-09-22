// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { MaternityTool } from "../components/MaternityTool";
import { LactationTool } from "../components/LactationTool";
import { MaternidadLactanciaHub } from "../components/maternity-lactation/MaternidadLactanciaHub";

vi.mock("next/navigation", () => ({
  usePathname: () => "/representacion/maternidad",
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

describe("MaternidadLactanciaHub", () => {
  it("renderiza la secuencia continua de Cláusula 77 y las dos tarjetas principales", () => {
    render(<MaternidadLactanciaHub />);

    expect(screen.getByText(/Secuencia continua de protección laboral/i)).toBeDefined();
    expect(screen.getByText("1. Maternidad")).toBeDefined();
    expect(screen.getByText("2. Reanudación")).toBeDefined();
    expect(screen.getByText("3. Lactancia")).toBeDefined();

    // Tarjeta Maternidad
    expect(screen.getByRole("heading", { name: "Maternidad", level: 2 })).toBeDefined();
    expect(screen.getByText("90 días")).toBeDefined();
    expect(screen.getByRole("link", { name: /abrir maternidad/i })).toBeDefined();

    // Tarjeta Lactancia
    expect(screen.getByRole("heading", { name: "Lactancia", level: 2 })).toBeDefined();
    expect(screen.getByText("365 días")).toBeDefined();
    expect(screen.getByRole("link", { name: /abrir lactancia/i })).toBeDefined();
  });
});

describe("MaternityTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza los pasos del formulario y la navegación contextual", () => {
    render(<MaternityTool />);

    // Navegación contextual presente
    expect(
      screen.getByRole("navigation", { name: /navegación contextual de maternidad y lactancia/i }),
    ).toBeDefined();
    expect(screen.getByText("Seleccionar trabajadora")).toBeDefined();
    expect(screen.getByText(/Fecha de expedición \/ inicio de incapacidad/i)).toBeDefined();
  });

  it("muestra error si se intenta calcular con campo de fecha vacío", () => {
    render(<MaternityTool />);

    const calcBtn = screen.getByRole("button", { name: /calcular periodo de maternidad/i });
    fireEvent.click(calcBtn);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Captura la fecha de inicio de la incapacidad.")).toBeDefined();
  });

  it("calcula y despliega la línea de tiempo de maternidad con 90 días naturales", () => {
    render(<MaternityTool />);

    const dateInput = screen.getByLabelText("Fecha de inicio de la incapacidad");
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });

    const calcBtn = screen.getByRole("button", { name: /calcular periodo de maternidad/i });
    fireEvent.click(calcBtn);

    // Hitos de la línea de tiempo
    expect(screen.getByRole("heading", { name: "Línea de tiempo de maternidad" })).toBeDefined();
    expect(screen.getByText(/90 días naturales \(Cl\. 77\)/i)).toBeDefined();
    expect(screen.getByText("Inicio de incapacidad")).toBeDefined();
    expect(screen.getByText("Último día de maternidad")).toBeDefined();
    expect(screen.getByText("Reanudación laboral")).toBeDefined();
    expect(screen.getByText(/Lactancia estimada/i)).toBeDefined();

    // Botón de continuidad a lactancia
    const continueLink = screen.getByRole("link", { name: /continuar con lactancia/i });
    expect(continueLink.getAttribute("href")).toContain("/representacion/lactancia?returnToWork=2026-06-30");
  });
});

describe("LactationTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza la navegación contextual, pasos y selector de jornada", () => {
    render(<LactationTool />);

    expect(
      screen.getByRole("navigation", { name: /navegación contextual de maternidad y lactancia/i }),
    ).toBeDefined();
    expect(screen.getByLabelText("Fecha de reanudación de labores")).toBeDefined();
    expect(screen.getByLabelText("Jornada contractual")).toBeDefined();
  });

  it("al ingresar fecha de reanudación calcula progreso accesible, desglose y modalidades", () => {
    render(<LactationTool />);

    const dateInput = screen.getByLabelText("Fecha de reanudación de labores");
    fireEvent.change(dateInput, { target: { value: "2026-07-01" } });

    // Barra de progreso con roles y atributos ARIA
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("365");

    // Acordeón de desglose mensual
    const accordionBtn = screen.getByRole("button", { name: /ver desglose mensual/i });
    expect(accordionBtn).toBeDefined();
    expect(accordionBtn.getAttribute("aria-expanded")).toBe("false");

    // Desplegar acordeón
    fireEvent.click(accordionBtn);
    expect(accordionBtn.getAttribute("aria-expanded")).toBe("true");

    // Modalidades por jornada como tarjetas accesibles
    const radioGroup = screen.getByRole("radiogroup", { name: /modalidad de lactancia/i });
    expect(radioGroup).toBeDefined();
    expect(screen.getByText("Reducción de 1 hora diaria")).toBeDefined();
  });

  it("cambiar jornada a 6.5h muestra tarjeta con badge 'Requiere acuerdo'", () => {
    render(<LactationTool />);

    const dateInput = screen.getByLabelText("Fecha de reanudación de labores");
    fireEvent.change(dateInput, { target: { value: "2026-07-01" } });

    const selectWorkday = screen.getByLabelText("Jornada contractual");
    fireEvent.change(selectWorkday, { target: { value: "lte6_5h" } });

    expect(screen.getByText("Descanso de 30 minutos")).toBeDefined();
    expect(screen.getByText("Requiere acuerdo")).toBeDefined();
  });
});
