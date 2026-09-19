import { describe, it, expect } from "vitest";
import {
  normalizeLockerNumber,
  extractSourceUpdateYear,
  splitWorkerNameReversible,
} from "../services/worker-importer/row-parser";

describe("Locker Hoja1 Parser Unit Tests", () => {
  describe("normalizeLockerNumber", () => {
    it("normalizes pure numeric locker strings", () => {
      expect(normalizeLockerNumber("10")).toEqual({
        normalized: "10",
        isPhysical: true,
        isSemantic: false,
        raw: "10",
      });
      expect(normalizeLockerNumber(105)).toEqual({
        normalized: "105",
        isPhysical: true,
        isSemantic: false,
        raw: "105",
      });
      expect(normalizeLockerNumber(" 0042 ")).toEqual({
        normalized: "42",
        isPhysical: true,
        isSemantic: false,
        raw: "0042",
      });
    });

    it("preserves alphanumeric suffixes distinctly (fixes 200 vs 200-B bug)", () => {
      const res200 = normalizeLockerNumber("200");
      const res200B = normalizeLockerNumber("200-B");
      expect(res200.normalized).toBe("200");
      expect(res200B.normalized).toBe("200-B");
      expect(res200.normalized).not.toBe(res200B.normalized);

      const res427 = normalizeLockerNumber("427");
      const res427B = normalizeLockerNumber("427-B");
      expect(res427.normalized).toBe("427");
      expect(res427B.normalized).toBe("427-B");
      expect(res427.normalized).not.toBe(res427B.normalized);

      expect(normalizeLockerNumber("15 A").normalized).toBe("15-A");
      expect(normalizeLockerNumber("12-b").normalized).toBe("12-B");
      expect(normalizeLockerNumber("300/C").normalized).toBe("300-C");
    });

    it("strips backticks, quotes and leading/trailing punctuation", () => {
      expect(normalizeLockerNumber("` 686").normalized).toBe("686");
      expect(normalizeLockerNumber("'50'").normalized).toBe("50");
      expect(normalizeLockerNumber('"100"').normalized).toBe("100");
      expect(normalizeLockerNumber("#75").normalized).toBe("75");
    });

    it("identifies semantic, non-physical terms correctly", () => {
      const snRes = normalizeLockerNumber("S/N");
      expect(snRes.isSemantic).toBe(true);
      expect(snRes.normalized).toBe("S/N");

      const monRes = normalizeLockerNumber("monserrat");
      expect(monRes.isSemantic).toBe(true);
      expect(monRes.normalized).toBe("MONSERRAT");

      const pendRes = normalizeLockerNumber("PENDIENTE");
      expect(pendRes.isSemantic).toBe(true);

      const cambRes = normalizeLockerNumber("CAMBIO DE CASILLERO");
      expect(cambRes.isSemantic).toBe(true);

      const nullRes = normalizeLockerNumber(null);
      expect(nullRes.normalized).toBe("");
      expect(nullRes.isSemantic).toBe(false);

      const emptyRes = normalizeLockerNumber("   ");
      expect(emptyRes.normalized).toBe("");
      expect(emptyRes.isSemantic).toBe(false);
    });
  });

  describe("extractSourceUpdateYear", () => {
    it("extracts 4-digit years within valid temporal window (2020-2029)", () => {
      expect(extractSourceUpdateYear("ACTUALIZADO 2024")).toBe(2024);
      expect(extractSourceUpdateYear("CAMBIO 2025 POR SOLICITUD")).toBe(2025);
      expect(extractSourceUpdateYear("2023")).toBe(2023);
      expect(extractSourceUpdateYear("REF 2026 APROBADO")).toBe(2026);
    });

    it("returns null for values without valid year or dates outside window", () => {
      expect(extractSourceUpdateYear("SIN OBSERVACIONES")).toBeNull();
      expect(extractSourceUpdateYear("")).toBeNull();
      expect(extractSourceUpdateYear(null)).toBeNull();
      expect(extractSourceUpdateYear(undefined)).toBeNull();
      expect(extractSourceUpdateYear("MATRICULA 1234567")).toBeNull();
      expect(extractSourceUpdateYear("CODIGO 1999")).toBeNull();
    });
  });

  describe("splitWorkerNameReversible", () => {
    it("splits standard 3+ word Mexican naming convention", () => {
      const res = splitWorkerNameReversible("LOPEZ OBRADOR ANDRES MANUEL");
      expect(res.paternal_surname).toBe("LOPEZ");
      expect(res.maternal_surname).toBe("OBRADOR");
      expect(res.first_name).toBe("ANDRES MANUEL");
      expect(res.source_name_raw).toBe("LOPEZ OBRADOR ANDRES MANUEL");
    });

    it("splits 2-word names gracefully", () => {
      const res = splitWorkerNameReversible("GARCIA PEDRO");
      expect(res.paternal_surname).toBe("GARCIA");
      expect(res.maternal_surname).toBe("");
      expect(res.first_name).toBe("PEDRO");
      expect(res.source_name_raw).toBe("GARCIA PEDRO");
    });

    it("handles single-word or empty raw names safely", () => {
      const res1 = splitWorkerNameReversible("RODRIGUEZ");
      expect(res1.paternal_surname).toBe("RODRIGUEZ");
      expect(res1.maternal_surname).toBe("");
      expect(res1.first_name).toBe("");

      const resEmpty = splitWorkerNameReversible("");
      expect(resEmpty.paternal_surname).toBe("");
      expect(resEmpty.maternal_surname).toBe("");
      expect(resEmpty.first_name).toBe("");
    });
  });
});
