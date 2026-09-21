// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PassageWizard } from "../components/PassageWizard";
import { PassageConceptSelector } from "../components/passages/PassageConceptSelector";
import type { UnionWorkerOption } from "../components/WorkerPicker";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const SAMPLE_WORKER: UnionWorkerOption = {
  id: "w-101",
  employee_number: "12345678",
  first_name: "EDUARDO",
  paternal_surname: "BOLAÑOS",
  maternal_surname: "VÁZQUEZ",
  category: "TÉCNICO RADIÓLOGO",
  assignment: "HGR No. 1",
  turn: "Vespertino",
};

describe("PassageConceptSelector UI", () => {
  it("renderiza las dos opciones con semántica accesible y selecciona la activa", () => {
    const onChange = vi.fn();
    render(<PassageConceptSelector concept="027" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup", { name: /concepto de pasajes/i });
    expect(radiogroup).toBeDefined();

    const radio026 = screen.getByRole("radio", { name: /concepto 026/i });
    const radio027 = screen.getByRole("radio", { name: /concepto 027/i });

    expect(radio026.getAttribute("aria-checked")).toBe("false");
    expect(radio027.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(radio026);
    expect(onChange).toHaveBeenCalledWith("026");
  });

  it("permite navegación con teclado en el selector", () => {
    const onChange = vi.fn();
    render(<PassageConceptSelector concept="027" onChange={onChange} />);

    const radio027 = screen.getByRole("radio", { name: /concepto 027/i });
    fireEvent.keyDown(radio027, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("026");

    fireEvent.keyDown(radio027, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("027");
  });
});

describe("PassageWizard UI Workflow & Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("permite buscar y seleccionar un trabajador, mostrando la tarjeta de alta jerarquía", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workers: [SAMPLE_WORKER] }),
    });

    render(<PassageWizard />);

    // Buscador visible inicialmente
    const searchInput = screen.getByPlaceholderText(/matrícula, nombre o apellido/i);
    fireEvent.change(searchInput, { target: { value: "BOLAÑOS" } });

    const searchBtn = screen.getByRole("button", { name: /buscar trabajador/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/BOLAÑOS VÁZQUEZ EDUARDO/i)).toBeDefined();
    });

    // Seleccionar trabajador
    const workerOption = screen.getByRole("button", { name: /BOLAÑOS VÁZQUEZ/i });
    fireEvent.click(workerOption);

    // Debe mostrar la tarjeta compacta de trabajador seleccionado
    expect(screen.getByText(/trabajador seleccionado/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /cambiar trabajador seleccionado/i })).toBeDefined();

    // El buscador debe ocultarse
    expect(screen.queryByPlaceholderText(/matrícula, nombre o apellido/i)).toBeNull();
  });

  it("conmutar entre 026 y 027 NO pierde el trabajador seleccionado", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workers: [SAMPLE_WORKER] }),
    });

    render(<PassageWizard />);

    // Buscar y seleccionar
    fireEvent.change(screen.getByPlaceholderText(/matrícula, nombre o apellido/i), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar trabajador/i }));

    await waitFor(() => screen.getByRole("button", { name: /BOLAÑOS VÁZQUEZ/i }));
    fireEvent.click(screen.getByRole("button", { name: /BOLAÑOS VÁZQUEZ/i }));

    expect(screen.getByText(/trabajador seleccionado/i)).toBeDefined();

    // Cambiar a 026
    const radio026 = screen.getByRole("radio", { name: /concepto 026/i });
    fireEvent.click(radio026);

    // El trabajador seleccionado sigue visible
    expect(screen.getByText(/trabajador seleccionado/i)).toBeDefined();
    expect(screen.getByText(/TÉCNICO RADIÓLOGO/i)).toBeDefined();

    // Campos de 026 visibles
    expect(screen.getByLabelText(/funciones extramuros en el desempeño/i)).toBeDefined();
    expect(screen.getByLabelText(/periodo de traslado/i)).toBeDefined();

    // Cambiar de vuelta a 027
    const radio027 = screen.getByRole("radio", { name: /concepto 027/i });
    fireEvent.click(radio027);

    // El trabajador seleccionado todavía se conserva
    expect(screen.getByText(/trabajador seleccionado/i)).toBeDefined();
    expect(screen.getByText(/horario discontinuo/i)).toBeDefined();
  });

  it("valida campos obligatorios y muestra banner accesible de faltantes", async () => {
    render(<PassageWizard />);

    // Intentar preparar sin trabajador ni datos
    const prepareBtns = screen.getAllByRole("button", { name: /preparar solicitud/i });
    fireEvent.click(prepareBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText(/no pudimos preparar la solicitud/i)).toBeDefined();
      expect(screen.getAllByText(/trabajador solicitante/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("permite copiar municipio y estado del trabajador al de adscripción en 027", () => {
    render(<PassageWizard />);

    const munInputs = screen.getAllByLabelText(/municipio o delegación/i);
    const edoInputs = screen.getAllByLabelText(/^estado$/i);

    fireEvent.change(munInputs[0], { target: { value: "Morelia" } });
    fireEvent.change(edoInputs[0], { target: { value: "Michoacán" } });

    const copyBtn = screen.getByRole("button", { name: /mismo municipio y estado/i });
    fireEvent.click(copyBtn);

    expect((munInputs[1] as HTMLInputElement).value).toBe("Morelia");
    expect((edoInputs[1] as HTMLInputElement).value).toBe("Michoacán");
  });

  it("implementa estado dirty al modificar datos después de preparar el trámite", async () => {
    // 1. Mock de búsqueda
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workers: [SAMPLE_WORKER] }),
    });

    render(<PassageWizard />);

    // Buscar y seleccionar
    fireEvent.change(screen.getByPlaceholderText(/matrícula, nombre o apellido/i), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar trabajador/i }));

    await waitFor(() => screen.getByRole("button", { name: /BOLAÑOS VÁZQUEZ/i }));
    fireEvent.click(screen.getByRole("button", { name: /BOLAÑOS VÁZQUEZ/i }));

    // Llenar campos requeridos de 027
    const yesBtn = screen.getByRole("radio", { name: /^sí$/i });
    fireEvent.click(yesBtn);

    const allStreetInputs = screen.getAllByLabelText(/calle y número/i);
    const allColoniaInputs = screen.getAllByLabelText(/colonia/i);
    const allCpInputs = screen.getAllByLabelText(/c\.p\./i);
    const allMunInputs = screen.getAllByLabelText(/municipio o delegación/i);
    const allEdoInputs = screen.getAllByLabelText(/^estado$/i);

    // Llenar datos de domicilio del trabajador
    fireEvent.change(allStreetInputs[0], { target: { value: "Calle 1" } });
    fireEvent.change(allColoniaInputs[0], { target: { value: "Col 1" } });
    fireEvent.change(allCpInputs[0], { target: { value: "58000" } });
    fireEvent.change(allMunInputs[0], { target: { value: "Morelia" } });
    fireEvent.change(allEdoInputs[0], { target: { value: "Michoacán" } });
    fireEvent.change(screen.getByPlaceholderText(/ej\. 4431234567/i), { target: { value: "4431234567" } });

    // Copiar a adscripción
    const copyBtn = screen.getByRole("button", { name: /mismo municipio y estado/i });
    fireEvent.click(copyBtn);

    // Llenar calle, colonia y cp de adscripción
    fireEvent.change(allStreetInputs[1], { target: { value: "Calle Lab" } });
    fireEvent.change(allColoniaInputs[1], { target: { value: "Col Lab" } });
    fireEvent.change(allCpInputs[1], { target: { value: "58020" } });

    // Mock de preparación exitosa
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "case-999", folio: "XXI-2026-PAS-000999" }),
    });

    const prepareBtn = screen.getAllByRole("button", { name: /preparar solicitud/i })[0];
    fireEvent.click(prepareBtn);

    // Debe mostrar folio y botón de descarga
    await waitFor(() => {
      expect(screen.getAllByText(/XXI-2026-PAS-000999/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("button", { name: /descargar formato.*027/i })[0]).toBeDefined();
    });

    // Ahora el usuario modifica un dato (ej. teléfono)
    fireEvent.change(screen.getByPlaceholderText(/ej\. 4431234567/i), { target: { value: "4439999999" } });

    // El estado dirty debe activarse:
    // 1. Mensaje de cambios detectados visible
    expect(screen.getAllByText(/cambios detectados/i).length).toBeGreaterThanOrEqual(1);
    // 2. El botón de descarga desaparece
    expect(screen.queryByRole("button", { name: /descargar formato.*027/i })).toBeNull();
    // 3. Vuelve a aparecer el botón de preparar
    expect(screen.getAllByRole("button", { name: /preparar solicitud/i })[0]).toBeDefined();
  });
});
