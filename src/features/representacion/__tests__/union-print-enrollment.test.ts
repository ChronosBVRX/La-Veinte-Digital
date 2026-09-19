import { describe, it, expect } from "vitest";
import {
  generateEnrollmentCode,
  normalizeEnrollmentCode,
  hashEnrollmentCode,
  generateStationToken,
  hashStationToken,
} from "../services/print-token";

describe("Vinculación de Estaciones Sindicales — Códigos Cortos de 6 Dígitos", () => {
  describe("1. Generación de Códigos de Vinculación", () => {
    it("genera un código numérico aleatorio de 6 dígitos con formato amigable y hash SHA-256", () => {
      const { rawCode, formattedCode, codeHash } = generateEnrollmentCode();

      // Debe ser exactamente 6 dígitos numéricos
      expect(rawCode).toMatch(/^\d{6}$/);

      // El código formateado debe tener el espacio en medio: "123 456"
      expect(formattedCode).toMatch(/^\d{3} \d{3}$/);
      expect(formattedCode).toBe(`${rawCode.slice(0, 3)} ${rawCode.slice(3, 6)}`);

      // El hash debe ser SHA-256 de 64 caracteres en hexadecimal
      expect(codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(codeHash).toBe(hashEnrollmentCode(rawCode));
    });

    it("genera códigos con entropía adecuada dentro del rango 100000-999999", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { rawCode } = generateEnrollmentCode();
        const num = parseInt(rawCode, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
        codes.add(rawCode);
      }
      // Con 50 muestras del rango 100,000-999,999, casi todos deben ser únicos
      expect(codes.size).toBeGreaterThan(45);
    });
  });

  describe("2. Normalización de Códigos de Entrada", () => {
    it("normaliza cadenas con espacios, guiones y mayúsculas/minúsculas", () => {
      expect(normalizeEnrollmentCode("482 731")).toBe("482731");
      expect(normalizeEnrollmentCode("482-731")).toBe("482731");
      expect(normalizeEnrollmentCode("  482   731  ")).toBe("482731");
      expect(normalizeEnrollmentCode("482 - 731")).toBe("482731");
      expect(normalizeEnrollmentCode("482731")).toBe("482731");
    });

    it("produce el mismo hash SHA-256 independientemente del formato visual", () => {
      const hash1 = hashEnrollmentCode("482 731");
      const hash2 = hashEnrollmentCode("482731");
      const hash3 = hashEnrollmentCode("482-731");
      const hash4 = hashEnrollmentCode("  482 731  ");

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash3).toBe(hash4);
    });
  });

  describe("3. Canje de Código por Token de Estación", () => {
    it("genera un station token de 64 caracteres compatible con el agente de Windows", () => {
      const { rawToken, tokenHash } = generateStationToken();
      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(hashStationToken(rawToken)).toBe(tokenHash);
    });
  });
});
