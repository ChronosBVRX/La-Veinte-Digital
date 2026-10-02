import { describe, it, expect } from "vitest";
import { calcularProgresoVisualGlobal } from "../../../worker/visual-job-store";

describe("Progreso visual global agregado", () => {
  it("un solo formato refleja el avance real del renderer", () => {
    expect(calcularProgresoVisualGlobal(0, 0, 1)).toBe(0);
    expect(calcularProgresoVisualGlobal(0, 50, 1)).toBe(50);
    expect(calcularProgresoVisualGlobal(0, 100, 1)).toBe(99);
  });

  it("tres formatos reparten el avance sin retroceder entre formatos", () => {
    expect(calcularProgresoVisualGlobal(0, 100, 3)).toBe(33);
    expect(calcularProgresoVisualGlobal(1, 0, 3)).toBe(33);
    expect(calcularProgresoVisualGlobal(1, 50, 3)).toBe(50);
    expect(calcularProgresoVisualGlobal(2, 100, 3)).toBe(99);
  });

  it("protege contra índices y porcentajes fuera de rango", () => {
    expect(calcularProgresoVisualGlobal(-1, -20, 0)).toBe(0);
    expect(calcularProgresoVisualGlobal(99, 500, 2)).toBe(99);
  });
});
