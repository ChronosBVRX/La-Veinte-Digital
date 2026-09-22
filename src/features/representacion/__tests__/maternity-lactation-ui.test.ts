import { describe, it, expect } from "vitest";
import {
  formatMexicanDate,
  getLactationHumanStatus,
  parseLactationQueryParams,
  isMaternityLactationActive,
} from "../lib/maternity-lactation-ui";

describe("maternity-lactation-ui", () => {
  describe("formatMexicanDate", () => {
    it("formatea en estilo largo en español de México", () => {
      expect(formatMexicanDate("2026-04-01")).toBe("1 de abril de 2026");
      expect(formatMexicanDate("2026-10-15")).toBe("15 de octubre de 2026");
      expect(formatMexicanDate("2027-01-01")).toBe("1 de enero de 2027");
    });

    it("formatea en estilo corto DD/MM/AAAA", () => {
      expect(formatMexicanDate("2026-04-01", { format: "short" })).toBe("01/04/2026");
      expect(formatMexicanDate("2026-12-31", { format: "short" })).toBe("31/12/2026");
    });

    it("maneja valores nulos o inválidos de manera segura", () => {
      expect(formatMexicanDate(null)).toBe("—");
      expect(formatMexicanDate("")).toBe("—");
      expect(formatMexicanDate("invalido")).toBe("invalido");
    });
  });

  describe("getLactationHumanStatus", () => {
    it("retorna 'vigente' si restan más de 30 días", () => {
      const status = getLactationHumanStatus({
        remainingDays: 120,
        elapsedDays: 245,
        periodEnd: "2027-03-31",
      });
      expect(status.status).toBe("vigente");
      expect(status.label).toBe("Vigente");
      expect(status.badgeVariant).toBe("success");
    });

    it("retorna 'proxima_a_concluir' si restan entre 1 y 30 días", () => {
      const status30 = getLactationHumanStatus({
        remainingDays: 30,
        elapsedDays: 335,
        periodEnd: "2027-03-31",
      });
      expect(status30.status).toBe("proxima_a_concluir");
      expect(status30.label).toBe("Próxima a concluir");
      expect(status30.badgeVariant).toBe("warning");

      const status1 = getLactationHumanStatus({
        remainingDays: 1,
        elapsedDays: 364,
        periodEnd: "2027-03-31",
      });
      expect(status1.status).toBe("proxima_a_concluir");
      expect(status1.label).toBe("Próxima a concluir");
      expect(status1.description).toContain("1 día");
    });

    it("retorna 'concluida' si remainingDays es 0 o la fecha fin ya pasó", () => {
      const status0 = getLactationHumanStatus({
        remainingDays: 0,
        elapsedDays: 365,
        periodEnd: "2026-01-01",
      });
      expect(status0.status).toBe("concluida");
      expect(status0.label).toBe("Concluida");
      expect(status0.badgeVariant).toBe("neutral");

      const statusPasado = getLactationHumanStatus(
        {
          remainingDays: 0,
          elapsedDays: 365,
          periodEnd: "2026-01-01",
        },
        "2026-04-01",
      );
      expect(statusPasado.status).toBe("concluida");
    });
  });

  describe("parseLactationQueryParams", () => {
    it("extrae returnToWork y workerId válidos desde URLSearchParams", () => {
      const search = new URLSearchParams("returnToWork=2026-07-01&workerId=w-123");
      const res = parseLactationQueryParams(search);
      expect(res.returnToWork).toBe("2026-07-01");
      expect(res.workerId).toBe("w-123");
    });

    it("admite claves alternativas en snake_case", () => {
      const search = new URLSearchParams("return_to_work=2026-08-15&worker_id=worker-abc");
      const res = parseLactationQueryParams(search);
      expect(res.returnToWork).toBe("2026-08-15");
      expect(res.workerId).toBe("worker-abc");
    });

    it("descarta fechas inválidas o que no existen en el calendario", () => {
      const search1 = new URLSearchParams("returnToWork=2026-02-30"); // Febrero 30 no existe
      const res1 = parseLactationQueryParams(search1);
      expect(res1.returnToWork).toBeUndefined();

      const search2 = new URLSearchParams("returnToWork=not-a-date");
      const res2 = parseLactationQueryParams(search2);
      expect(res2.returnToWork).toBeUndefined();
    });

    it("descarta workerId malicioso o con caracteres especiales", () => {
      const search = new URLSearchParams("workerId=<script>alert(1)</script>");
      const res = parseLactationQueryParams(search);
      expect(res.workerId).toBeUndefined();
    });

    it("maneja ausencia total de parámetros sin error", () => {
      const res = parseLactationQueryParams({});
      expect(res.returnToWork).toBeUndefined();
      expect(res.workerId).toBeUndefined();
    });
  });

  describe("isMaternityLactationActive", () => {
    it("activa el módulo para la portada y las dos herramientas", () => {
      expect(isMaternityLactationActive("/representacion/maternidad-lactancia")).toBe(true);
      expect(isMaternityLactationActive("/representacion/maternidad-lactancia/detalle")).toBe(true);
      expect(isMaternityLactationActive("/representacion/maternidad")).toBe(true);
      expect(isMaternityLactationActive("/representacion/maternidad/editar")).toBe(true);
      expect(isMaternityLactationActive("/representacion/lactancia")).toBe(true);
      expect(isMaternityLactationActive("/representacion/lactancia/caso-1")).toBe(true);
    });

    it("no activa el módulo para otras rutas de representación", () => {
      expect(isMaternityLactationActive("/representacion")).toBe(false);
      expect(isMaternityLactationActive("/representacion/trabajadores")).toBe(false);
      expect(isMaternityLactationActive("/representacion/licencias")).toBe(false);
      expect(isMaternityLactationActive("/representacion/pasajes")).toBe(false);
      expect(isMaternityLactationActive("/representacion/lockers")).toBe(false);
    });
  });
});
