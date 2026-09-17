import { describe, expect, it } from "vitest";
import {
  formatLongDateEs,
  normalizeWorkerName,
  splitIsoDate,
} from "../services/license-document-dto";

describe("license-document-dto", () => {
  describe("normalizeWorkerName", () => {
    it("normalizes structured Mexican name (paternal, maternal, first)", () => {
      const result = normalizeWorkerName({
        first_name: "Axel",
        paternal_surname: "Rosete",
        maternal_surname: "Álvarez",
      });
      expect(result.firstName).toBe("AXEL");
      expect(result.paternalSurname).toBe("ROSETE");
      expect(result.maternalSurname).toBe("ÁLVAREZ");
      expect(result.fullName).toBe("ROSETE ÁLVAREZ AXEL");
    });

    it("normalizes structured name without maternal surname", () => {
      const result = normalizeWorkerName({
        first_name: "María",
        paternal_surname: "González",
        maternal_surname: null,
      });
      expect(result.firstName).toBe("MARÍA");
      expect(result.paternalSurname).toBe("GONZÁLEZ");
      expect(result.maternalSurname).toBe("");
      expect(result.fullName).toBe("GONZÁLEZ MARÍA");
    });

    it("parses 3-token SIAP full name", () => {
      const result = normalizeWorkerName({
        first_name: null,
        paternal_surname: null,
        siap_full_name: "LÓPEZ CASTRO ESMERALDA",
      });
      expect(result.paternalSurname).toBe("LÓPEZ");
      expect(result.maternalSurname).toBe("CASTRO");
      expect(result.firstName).toBe("ESMERALDA");
      expect(result.fullName).toBe("LÓPEZ CASTRO ESMERALDA");
    });

    it("parses 4-token SIAP full name (compound first name)", () => {
      const result = normalizeWorkerName({
        first_name: "",
        paternal_surname: "",
        siap_full_name: "SOLORIO CHÁVEZ LORENA GUADALUPE",
      });
      expect(result.paternalSurname).toBe("SOLORIO");
      expect(result.maternalSurname).toBe("CHÁVEZ");
      expect(result.firstName).toBe("LORENA GUADALUPE");
      expect(result.fullName).toBe("SOLORIO CHÁVEZ LORENA GUADALUPE");
    });

    it("parses 2-token SIAP name", () => {
      const result = normalizeWorkerName({
        siap_full_name: "RAMÍREZ CARLOS",
      });
      expect(result.paternalSurname).toBe("RAMÍREZ");
      expect(result.maternalSurname).toBe("");
      expect(result.firstName).toBe("CARLOS");
      expect(result.fullName).toBe("RAMÍREZ CARLOS");
    });

    it("returns empty strings when worker has no name data", () => {
      const result = normalizeWorkerName({});
      expect(result.firstName).toBe("");
      expect(result.paternalSurname).toBe("");
      expect(result.maternalSurname).toBe("");
      expect(result.fullName).toBe("");
    });
  });

  describe("formatLongDateEs", () => {
    it("formats ISO date to official uppercase Spanish format", () => {
      expect(formatLongDateEs("2026-09-17")).toBe("17 DE SEPTIEMBRE DEL 2026");
      expect(formatLongDateEs("2026-01-01")).toBe("1 DE ENERO DEL 2026");
      expect(formatLongDateEs("2026-12-31")).toBe("31 DE DICIEMBRE DEL 2026");
    });

    it("returns input if invalid ISO string", () => {
      expect(formatLongDateEs("")).toBe("");
      expect(formatLongDateEs("invalid")).toBe("invalid");
    });
  });

  describe("splitIsoDate", () => {
    it("splits ISO date into padded day, month, year", () => {
      expect(splitIsoDate("2026-09-05")).toEqual({ d: "05", m: "09", y: "2026" });
      expect(splitIsoDate("2026-11-20")).toEqual({ d: "20", m: "11", y: "2026" });
    });
  });
});
