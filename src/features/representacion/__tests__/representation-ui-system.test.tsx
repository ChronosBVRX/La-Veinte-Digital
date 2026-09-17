// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  RepresentationSectionHeader,
  RepresentationMetricCard,
  RepresentationSummaryMetrics,
  RepresentationSearchInput,
  RepresentationFilterButton,
  RepresentationSortButton,
  RepresentationToolbar,
  RepresentationStatusBadge,
  RepresentationTable,
  RepresentationListCard,
  RepresentationSheet,
  RepresentationEmptyState,
  RepresentationLoadingSkeleton,
  representationTableCellStyle,
} from "../components/ui";

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

describe("Sistema Centralizado de Interfaz · Representación Sindical", () => {
  describe("RepresentationSectionHeader", () => {
    it("renderiza título, subtítulo, enlace de navegación y botones de acción", () => {
      render(
        <RepresentationSectionHeader
          title="Trabajadores"
          subtitle="Padrón de la delegación"
          backHref="/representacion"
          backLabel="← Volver a inicio"
          primaryAction={<button type="button">Nuevo registro</button>}
          secondaryAction={<button type="button">Actualizar base</button>}
        />,
      );

      expect(screen.getByRole("heading", { level: 1, name: "Trabajadores" })).toBeDefined();
      expect(screen.getByText("Padrón de la delegación")).toBeDefined();
      expect(screen.getByRole("link", { name: "← Volver a inicio" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Nuevo registro" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Actualizar base" })).toBeDefined();
    });
  });

  describe("RepresentationSummaryMetrics & RepresentationMetricCard", () => {
    it("renderiza métricas compactas con formato mexicano y alerta de aviso", () => {
      render(
        <RepresentationSummaryMetrics
          alert={<div data-testid="alert-banner">Aviso de pendientes</div>}
        >
          <RepresentationMetricCard label="Total" value={1250} icon="👥" />
          <RepresentationMetricCard label="Activos" value={1180} accentColor="#166534" />
          <RepresentationMetricCard label="Disponibles" value={70} />
          <RepresentationMetricCard label="Cargando" value={0} loading={true} />
        </RepresentationSummaryMetrics>,
      );

      expect(screen.getByText("Total")).toBeDefined();
      expect(screen.getByText("1,250")).toBeDefined();
      expect(screen.getByText("👥")).toBeDefined();
      expect(screen.getByText("Activos")).toBeDefined();
      expect(screen.getByText("1,180")).toBeDefined();
      expect(screen.getByTestId("alert-banner")).toBeDefined();
    });
  });

  describe("RepresentationStatusBadge (Mapeo estricto a español)", () => {
    it("traduce correctamente todos los estados técnicos a español profesional", () => {
      const { rerender } = render(<RepresentationStatusBadge status="available" />);
      expect(screen.getByText("Disponible")).toBeDefined();

      rerender(<RepresentationStatusBadge status="assigned" />);
      expect(screen.getByText("Asignado")).toBeDefined();

      rerender(<RepresentationStatusBadge status="reserved" />);
      expect(screen.getByText("Reservado")).toBeDefined();

      rerender(<RepresentationStatusBadge status="maintenance" />);
      expect(screen.getByText("Mantenimiento")).toBeDefined();

      rerender(<RepresentationStatusBadge status="blocked" />);
      expect(screen.getByText("Bloqueado")).toBeDefined();

      rerender(<RepresentationStatusBadge status="active" />);
      expect(screen.getByText("Activo")).toBeDefined();

      rerender(<RepresentationStatusBadge status="inactive" />);
      expect(screen.getByText("Inactivo")).toBeDefined();

      rerender(<RepresentationStatusBadge status="pending" />);
      expect(screen.getByText("Por revisar")).toBeDefined();
    });

    it("agrega pastilla de Revisión si hasPendingReview es verdadero", () => {
      render(<RepresentationStatusBadge status="available" hasPendingReview={true} />);
      expect(screen.getByText("Disponible")).toBeDefined();
      expect(screen.getByText("Revisión")).toBeDefined();
    });
  });

  describe("RepresentationToolbar & Search & Filter", () => {
    it("soporta búsqueda, ejecución de submit y limpieza", () => {
      const onSearchSubmit = vi.fn();
      const onChange = vi.fn();

      render(
        <RepresentationSearchInput
          ariaLabel="Buscar elemento"
          value="texto"
          onChange={onChange}
          onSearchSubmit={onSearchSubmit}
        />,
      );

      const input = screen.getByLabelText("Buscar elemento");
      expect(input).toBeDefined();

      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSearchSubmit).toHaveBeenCalledWith("texto");

      const clearBtn = screen.getByLabelText("Limpiar búsqueda");
      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith("");
    });

    it("RepresentationFilterButton muestra conteo activo si es mayor a 0", () => {
      const onClick = vi.fn();
      const { rerender } = render(
        <RepresentationFilterButton onClick={onClick} activeCount={0} />,
      );
      expect(screen.getByRole("button", { name: "Filtros" })).toBeDefined();

      rerender(<RepresentationFilterButton onClick={onClick} activeCount={3} />);
      expect(screen.getByRole("button", { name: "Filtros (3)" })).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Filtros (3)" }));
      expect(onClick).toHaveBeenCalled();
    });

    it("RepresentationSortButton maneja opciones y selección", () => {
      const onChange = vi.fn();
      const options = [
        { id: "num_asc", label: "Número ↑" },
        { id: "num_desc", label: "Número ↓" },
      ];

      render(
        <RepresentationSortButton
          value="num_asc"
          options={options}
          onChange={onChange}
        />,
      );

      const select = screen.getByRole("combobox", { name: "Ordenar por" });
      expect(select).toBeDefined();
      fireEvent.change(select, { target: { value: "num_desc" } });
      expect(onChange).toHaveBeenCalledWith("num_desc");
    });

    it("RepresentationToolbar renderiza búsqueda, filtros, orden y resultados", () => {
      render(
        <RepresentationToolbar
          search={<input placeholder="Buscar..." />}
          filters={<button type="button">Filtros</button>}
          sort={<select><option>Ordenar</option></select>}
          resultsInfo={<span>10 resultados</span>}
        />,
      );

      expect(screen.getByPlaceholderText("Buscar...")).toBeDefined();
      expect(screen.getByRole("button", { name: "Filtros" })).toBeDefined();
      expect(screen.getByText("10 resultados")).toBeDefined();
    });
  });

  describe("RepresentationTable & RepresentationListCard", () => {
    it("renderiza tabla desktop con columnas estilizadas y filas accesibles", () => {
      const cols = [
        { label: "Columna 1", align: "left" as const },
        { label: "Columna 2", align: "right" as const },
      ];

      render(
        <RepresentationTable columns={cols} caption="Tabla de prueba">
          <tr>
            <td style={representationTableCellStyle}>Dato 1</td>
            <td style={{ ...representationTableCellStyle, textAlign: "right" }}>Dato 2</td>
          </tr>
        </RepresentationTable>,
      );

      expect(screen.getByText("Columna 1")).toBeDefined();
      expect(screen.getByText("Columna 2")).toBeDefined();
      expect(screen.getByText("Dato 1")).toBeDefined();
      expect(screen.getByText("Dato 2")).toBeDefined();
    });

    it("RepresentationListCard renderiza enlace móvil accesible", () => {
      render(
        <RepresentationListCard href="/detalle">
          <div>Tarjeta móvil</div>
        </RepresentationListCard>,
      );

      expect(screen.getByRole("link")).toBeDefined();
      expect(screen.getByText("Tarjeta móvil")).toBeDefined();
    });
  });

  describe("RepresentationSheet", () => {
    it("renderiza drawer lateral cuando open=true y se cierra con escape o botón", () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <RepresentationSheet open={false} onClose={onClose} title="Panel Lateral">
          <div>Contenido</div>
        </RepresentationSheet>,
      );

      expect(screen.queryByText("Panel Lateral")).toBeNull();

      rerender(
        <RepresentationSheet open={true} onClose={onClose} title="Panel Lateral">
          <div>Contenido</div>
        </RepresentationSheet>,
      );

      expect(screen.getByText("Panel Lateral")).toBeDefined();
      expect(screen.getByText("Contenido")).toBeDefined();

      fireEvent.click(screen.getByLabelText("Cerrar panel"));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("RepresentationEmptyState & Skeletons", () => {
    it("renderiza empty state con variantes empty, filtered y error", () => {
      const onAction = vi.fn();
      const { rerender } = render(
        <RepresentationEmptyState
          variant="filtered"
          title="Sin resultados"
          description="Ajusta los filtros"
          onAction={onAction}
          actionLabel="Limpiar"
        />,
      );

      expect(screen.getByText("Sin resultados")).toBeDefined();
      expect(screen.getByText("Ajusta los filtros")).toBeDefined();
      const btn = screen.getByRole("button", { name: "Limpiar" });
      fireEvent.click(btn);
      expect(onAction).toHaveBeenCalled();

      rerender(
        <RepresentationEmptyState
          variant="error"
          title="Error de carga"
          description="Reintenta más tarde"
        />,
      );

      expect(screen.getByText("Error de carga")).toBeDefined();
    });

    it("renderiza skeletons para tablas y métricas", () => {
      const { container: c1 } = render(<RepresentationLoadingSkeleton variant="metrics" />);
      expect(c1.children.length).toBeGreaterThan(0);

      const { container: c2 } = render(<RepresentationLoadingSkeleton variant="table" rows={3} />);
      expect(c2.children.length).toBeGreaterThan(0);

      const { container: c3 } = render(<RepresentationLoadingSkeleton variant="cards" rows={2} />);
      expect(c3.children.length).toBeGreaterThan(0);
    });
  });

  describe("Ausencia de términos técnicos no deseados", () => {
    it("no muestra jerga técnica en badges o componentes comunes", () => {
      const { container } = render(
        <div>
          <RepresentationStatusBadge status="available" />
          <RepresentationStatusBadge status="assigned" />
          <RepresentationStatusBadge status="maintenance" />
        </div>,
      );

      const text = container.textContent ?? "";
      expect(text).not.toContain("override");
      expect(text).not.toContain("conflict_hold");
      expect(text).not.toContain("available");
      expect(text).not.toContain("assigned");
      expect(text).not.toContain("maintenance");
    });
  });
});
