import { describe, expect, it } from "vitest";
import {
  normalizeSiapText,
  resolveUnionWorkerName,
} from "../services/worker-name-resolver";

describe("worker-name-resolver", () => {
  describe("normalizeSiapText", () => {
    it("converts & to Ñ in SIAP legacy mainframe text", () => {
      expect(normalizeSiapText("BOLA&OS")).toBe("BOLAÑOS");
      expect(normalizeSiapText("NU&EZ")).toBe("NUÑEZ");
      expect(normalizeSiapText("CA&AVERAL")).toBe("CAÑAVERAL");
      expect(normalizeSiapText("BOLA&OS/VAZQUEZ/EDUARDO")).toBe("BOLAÑOS/VAZQUEZ/EDUARDO");
    });

    it("preserves standard text without ampersands", () => {
      expect(normalizeSiapText("LOPEZ/PEREZ/JUAN")).toBe("LOPEZ/PEREZ/JUAN");
      expect(normalizeSiapText("GARCIA HERNANDEZ")).toBe("GARCIA HERNANDEZ");
    });

    it("handles empty or null values gracefully", () => {
      expect(normalizeSiapText("")).toBe("");
      expect(normalizeSiapText(null)).toBe("");
      expect(normalizeSiapText(undefined)).toBe("");
    });
  });

  describe("resolveUnionWorkerName", () => {
    it("resolves real worker 98173968 with legacy SIAP & encoding and empty structured fields", () => {
      const fixture = {
        matricula: "98173968",
        siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
        first_name: null,
        paternal_surname: null,
        maternal_surname: null,
      };

      const resolved = resolveUnionWorkerName(fixture);

      expect(resolved.fullName).toBe("BOLAÑOS VAZQUEZ EDUARDO");
      expect(resolved.givenNames).toBe("EDUARDO");
      expect(resolved.paternalSurname).toBe("BOLAÑOS");
      expect(resolved.maternalSurname).toBe("VAZQUEZ");
      expect(resolved.displayName).toBe("BOLAÑOS VAZQUEZ EDUARDO");
      expect(resolved.source).toBe("siap");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves standard 3-part slash format: LOPEZ/PEREZ/JUAN", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "LOPEZ/PEREZ/JUAN",
      });

      expect(resolved.paternalSurname).toBe("LOPEZ");
      expect(resolved.maternalSurname).toBe("PEREZ");
      expect(resolved.givenNames).toBe("JUAN");
      expect(resolved.fullName).toBe("LOPEZ PEREZ JUAN");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves slash format with empty maternal surname: LOPEZ//JUAN", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "LOPEZ//JUAN",
      });

      expect(resolved.paternalSurname).toBe("LOPEZ");
      expect(resolved.maternalSurname).toBe("");
      expect(resolved.givenNames).toBe("JUAN");
      expect(resolved.fullName).toBe("LOPEZ JUAN");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves compound first names with slash format: LOPEZ/PEREZ/JUAN CARLOS", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "LOPEZ/PEREZ/JUAN CARLOS",
      });

      expect(resolved.paternalSurname).toBe("LOPEZ");
      expect(resolved.maternalSurname).toBe("PEREZ");
      expect(resolved.givenNames).toBe("JUAN CARLOS");
      expect(resolved.fullName).toBe("LOPEZ PEREZ JUAN CARLOS");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves compound surnames with slash format: DE LA CRUZ/HERNANDEZ/MARIA JOSE", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "DE LA CRUZ/HERNANDEZ/MARIA JOSE",
      });

      expect(resolved.paternalSurname).toBe("DE LA CRUZ");
      expect(resolved.maternalSurname).toBe("HERNANDEZ");
      expect(resolved.givenNames).toBe("MARIA JOSE");
      expect(resolved.fullName).toBe("DE LA CRUZ HERNANDEZ MARIA JOSE");
      expect(resolved.validForLicense).toBe(true);
    });

    it("prioritizes complete structured name over SIAP string", () => {
      const resolved = resolveUnionWorkerName({
        first_name: "Eduardo",
        paternal_surname: "Bolaños",
        maternal_surname: "Vázquez",
        siap_full_name: "OTRO/NOMBRE/IGNORADO",
      });

      expect(resolved.paternalSurname).toBe("BOLAÑOS");
      expect(resolved.maternalSurname).toBe("VÁZQUEZ");
      expect(resolved.givenNames).toBe("EDUARDO");
      expect(resolved.fullName).toBe("BOLAÑOS VÁZQUEZ EDUARDO");
      expect(resolved.source).toBe("structured");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves structured name when SIAP is empty", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "",
        first_name: "Juan",
        paternal_surname: "Pérez",
      });

      expect(resolved.paternalSurname).toBe("PÉREZ");
      expect(resolved.maternalSurname).toBe("");
      expect(resolved.givenNames).toBe("JUAN");
      expect(resolved.fullName).toBe("PÉREZ JUAN");
      expect(resolved.source).toBe("structured");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves space-delimited SIAP name with 3 tokens", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "LÓPEZ CASTRO ESMERALDA",
      });

      expect(resolved.paternalSurname).toBe("LÓPEZ");
      expect(resolved.maternalSurname).toBe("CASTRO");
      expect(resolved.givenNames).toBe("ESMERALDA");
      expect(resolved.fullName).toBe("LÓPEZ CASTRO ESMERALDA");
      expect(resolved.source).toBe("siap");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves space-delimited SIAP name with 4 tokens", () => {
      const resolved = resolveUnionWorkerName({
        siap_full_name: "SOLORIO CHÁVEZ LORENA GUADALUPE",
      });

      expect(resolved.paternalSurname).toBe("SOLORIO");
      expect(resolved.maternalSurname).toBe("CHÁVEZ");
      expect(resolved.givenNames).toBe("LORENA GUADALUPE");
      expect(resolved.fullName).toBe("SOLORIO CHÁVEZ LORENA GUADALUPE");
      expect(resolved.source).toBe("siap");
      expect(resolved.validForLicense).toBe(true);
    });

    it("resolves fallback full_name when structured and SIAP are absent", () => {
      const resolved = resolveUnionWorkerName({
        full_name: "RAMIREZ/SANCHEZ/PEDRO",
      });

      expect(resolved.paternalSurname).toBe("RAMIREZ");
      expect(resolved.maternalSurname).toBe("SANCHEZ");
      expect(resolved.givenNames).toBe("PEDRO");
      expect(resolved.fullName).toBe("RAMIREZ SANCHEZ PEDRO");
      expect(resolved.source).toBe("full_name");
      expect(resolved.validForLicense).toBe(true);
    });

    it("blocks and marks invalidForLicense when all fields are empty or null", () => {
      expect(resolveUnionWorkerName(null).validForLicense).toBe(false);
      expect(resolveUnionWorkerName(undefined).validForLicense).toBe(false);
      expect(resolveUnionWorkerName({}).validForLicense).toBe(false);

      const emptyObj = {
        first_name: "",
        paternal_surname: "",
        maternal_surname: "",
        siap_full_name: "",
        full_name: "",
      };
      const res = resolveUnionWorkerName(emptyObj);
      expect(res.validForLicense).toBe(false);
      expect(res.fullName).toBe("");
      expect(res.displayName).toBe("");
      expect(res.source).toBe("none");
    });
  });
});
