// src/features/representacion/lib/__tests__/category-normalizer.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeCategory,
  canonicalizeCategoryName,
  CATEGORY_PENDING_REVIEW,
} from "../category-normalizer";

describe("category-normalizer", () => {
  describe("Enfermería", () => {
    it("unifica todas las variantes de Enfermera General a 'ENFERMERA GENERAL'", () => {
      const variants = [
        "ENFERMERA GENERAL      80",
        "ENFERMERA GENERAL 80",
        "ENFERMERA GENERAL",
        "ENFERMERO GENERAL",
        "ENFERMERO GENERAL 80",
        "ENFERMERA GRAL",
        "ENFERMERA GENRAL",
        "ENF. GENERAL",
        "ENF.GENERAL",
        "ENF .GRAL.",
        "ENFERMERIA GRAL 80",
        "ENFERMERA GENERAL 80 DE 14: 00 A 21:30 JORNADA MIXTA",
      ];

      for (const v of variants) {
        expect(canonicalizeCategoryName(v)).toBe("ENFERMERA GENERAL");
      }
    });

    it("unifica variantes de Enfermera General Clínica a 'ENFERMERA GENERAL CLINICA'", () => {
      const variants = [
        "ENFERMERA GENERAL CLINICA 80",
        "ENFERMERA GENERAL   CLINICA  80",
        "ENFERMERA GRAL. CLINICA",
        "ENFERMERO GENERAL CLINICA",
      ];
      for (const v of variants) {
        expect(canonicalizeCategoryName(v)).toBe("ENFERMERA GENERAL CLINICA");
      }
    });

    it("unifica variantes de Enfermera Especialista a 'ENFERMERA ESPECIALISTA'", () => {
      const variants = [
        "ENFERMERA ESPECIALISTA 80",
        "ENFERMERA ESPECIALISTA",
        "ENFERMERO ESPECIALISTA",
        "ENFERMERA ESP.",
        "ENFERMERA ESPECIALISTA0",
        "ENFERMERA QUIRURGICA",
      ];
      for (const v of variants) {
        expect(canonicalizeCategoryName(v)).toBe("ENFERMERA ESPECIALISTA");
      }
    });

    it("unifica Auxiliar de Enfermería a 'AUXILIAR DE ENFERMERIA GENERAL'", () => {
      const variants = [
        "AUX DE ENFERMERIA GRAL 80",
        "AUXILIAR DE ENFERMERA GENERAL",
        "AUXILIAR DE ENFERMERIA",
        "AUXILIAR ENFERMERIA",
        "AUX. ENFERMERA GENERAL      80",
        "AUX. DE ENFERMERIA 80 TURNO MATUTINO",
      ];
      for (const v of variants) {
        expect(canonicalizeCategoryName(v)).toBe("AUXILIAR DE ENFERMERIA GENERAL");
      }
    });
  });

  describe("Limpieza e Higiene", () => {
    it("unifica todas las variantes ortográficas y abreviadas de Auxiliar de Limpieza", () => {
      const variants = [
        "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
        "AUXILIAR DE LIMPIEZA E HIGIENE",
        "AUX DE LIMPIEZA E HIGIENE",
        "AUXILIAR DE HIGIENE Y LIMPIEZA",
        "AUX DE HIGIENE Y LIMPIEZA",
        "AUXILIAR DE HIGIENE Y LIMP.",
        "AUX DE LIMPIEZ E HIGIENE",
        "AUX. DELIMPIEZA E HIGIENE",
        "AUX. DE HIGIENE",
        "AUXILIAT DE LIMPIEZA E HIGIENE",
        "AXILIAR DELIMPIEZA HIGIENE",
        "AUXILIAR DE LIPIEZA E HIGIENE 14:00A 21:30 JORNADA MIXTA",
      ];
      for (const v of variants) {
        expect(canonicalizeCategoryName(v)).toBe("AUXILIAR DE LIMPIEZA E HIGIENE");
      }
    });

    it("unifica Ayudante de Limpieza a 'AYUDANTE DE LIMPIEZA E HIGIENE' sin mezclarlo con Auxiliar", () => {
      expect(canonicalizeCategoryName("AYTE LIMPIEZA E HIGIENE UM Y NO MED 80")).toBe(
        "AYUDANTE DE LIMPIEZA E HIGIENE",
      );
      expect(canonicalizeCategoryName("AYUDANTE DE LIMPIEZA E HIGIENE")).toBe(
        "AYUDANTE DE LIMPIEZA E HIGIENE",
      );
    });
  });

  describe("Médicos y Especialistas", () => {
    it("unifica Médico No Familiar eliminando padding de espacios y jornada", () => {
      expect(canonicalizeCategoryName("MEDICO NO FAMILIAR     80")).toBe("MEDICO NO FAMILIAR");
      expect(canonicalizeCategoryName("MEDICO NO FAMILIAR")).toBe("MEDICO NO FAMILIAR");
      expect(canonicalizeCategoryName("MEDICO NO FAMILIAR 80")).toBe("MEDICO NO FAMILIAR");
    });

    it("mantiene consistentes Médico Familiar y General", () => {
      expect(canonicalizeCategoryName("MEDICO FAMILIAR        80")).toBe("MEDICO FAMILIAR");
      expect(canonicalizeCategoryName("MEDICO GENERAL 80")).toBe("MEDICO GENERAL");
    });

    it("unifica Residentes por año", () => {
      expect(canonicalizeCategoryName("RESIDENTE 1            80")).toBe("RESIDENTE 1");
      expect(canonicalizeCategoryName("RESIDENTE 2            80")).toBe("RESIDENTE 2");
      expect(canonicalizeCategoryName("RESIDENTE 3            80")).toBe("RESIDENTE 3");
      expect(canonicalizeCategoryName("RESIDENTE 4            80")).toBe("RESIDENTE 4");
    });
  });

  describe("Asistente Médica y Trabajo Social", () => {
    it("unifica Asistente Médica independientemente de jornada y género", () => {
      expect(canonicalizeCategoryName("ASISTENTE MEDICA       80")).toBe("ASISTENTE MEDICA");
      expect(canonicalizeCategoryName("ASISTENTE MEDICA       65")).toBe("ASISTENTE MEDICA");
      expect(canonicalizeCategoryName("ASISTENTE MEDICO")).toBe("ASISTENTE MEDICA");
      expect(canonicalizeCategoryName("ASISTENTE MEDICA")).toBe("ASISTENTE MEDICA");
    });

    it("unifica Trabajadora Social", () => {
      expect(canonicalizeCategoryName("TRABAJADORA SOCIAL     80")).toBe("TRABAJADORA SOCIAL");
      expect(canonicalizeCategoryName("TRABAJADOR SOCIAL 80")).toBe("TRABAJADORA SOCIAL");
      expect(canonicalizeCategoryName("TRABAJADOR SOCIAL CLINICO")).toBe("TRABAJADOR SOCIAL CLINICO");
    });
  });

  describe("Técnicos y Mantenimiento", () => {
    it("unifica Inhaloterapeuta corrigiendo error ortográfico de H inicial", () => {
      expect(canonicalizeCategoryName("HINALOTERAPEUTA")).toBe("INHALOTERAPEUTA");
      expect(canonicalizeCategoryName("INHALOTERAPEUTA        80")).toBe("INHALOTERAPEUTA");
      expect(canonicalizeCategoryName("INHALOTERAPEUTA        65")).toBe("INHALOTERAPEUTA");
    });

    it("unifica Técnico Radiólogo", () => {
      expect(canonicalizeCategoryName("TECNICO RADIOLOGO      80")).toBe("TECNICO RADIOLOGO");
      expect(canonicalizeCategoryName("TECNICO RADIOLOGO      60")).toBe("TECNICO RADIOLOGO");
    });

    it("unifica Técnico Mecánico y Plomero", () => {
      expect(canonicalizeCategoryName("TECNICO MECANICO       80")).toBe("TECNICO MECANICO");
      expect(canonicalizeCategoryName("TEC. MECANICO")).toBe("TECNICO MECANICO");
      expect(canonicalizeCategoryName("TECNICO PLOMERO        80")).toBe("TECNICO PLOMERO");
      expect(canonicalizeCategoryName("TECNICO PLOMERO  80")).toBe("TECNICO PLOMERO");
    });

    it("unifica Terapista Físico", () => {
      expect(canonicalizeCategoryName("TERAPISTA FISICO       80")).toBe("TERAPISTA FISICO");
      expect(canonicalizeCategoryName("TERAPISTA FISICO       60")).toBe("TERAPISTA FISICO");
      expect(canonicalizeCategoryName("TERAPISTA FISICO       6.5")).toBe("TERAPISTA FISICO");
    });
  });

  describe("Anomalías y entradas vacías", () => {
    it("devuelve PENDIENTE DE REVISION para cadenas vacías, nulas o con texto anómalo", () => {
      expect(canonicalizeCategoryName("")).toBe(CATEGORY_PENDING_REVIEW);
      expect(canonicalizeCategoryName(null)).toBe(CATEGORY_PENDING_REVIEW);
      expect(canonicalizeCategoryName(undefined)).toBe(CATEGORY_PENDING_REVIEW);
      expect(canonicalizeCategoryName("   ")).toBe(CATEGORY_PENDING_REVIEW);
      expect(canonicalizeCategoryName("(VACIO)")).toBe(CATEGORY_PENDING_REVIEW);
      expect(canonicalizeCategoryName("JUAN DE DIOS")).toBe(CATEGORY_PENDING_REVIEW);
    });

    it("marca confidence 'anomaly' para entradas anómalas", () => {
      const res = normalizeCategory("JUAN DE DIOS");
      expect(res.confidence).toBe("anomaly");
      expect(res.canonicalName).toBe(CATEGORY_PENDING_REVIEW);
    });
  });

  describe("Extracción de jornada", () => {
    it("extrae la jornada laboral si está presente en la cadena", () => {
      const res80 = normalizeCategory("ENFERMERA GENERAL      80");
      expect(res80.canonicalName).toBe("ENFERMERA GENERAL");
      expect(res80.extractedJornada).toBe("80");

      const res65 = normalizeCategory("ASISTENTE MEDICA       65");
      expect(res65.canonicalName).toBe("ASISTENTE MEDICA");
      expect(res65.extractedJornada).toBe("65");

      const res60 = normalizeCategory("TECNICO RADIOLOGO      60");
      expect(res60.canonicalName).toBe("TECNICO RADIOLOGO");
      expect(res60.extractedJornada).toBe("60");
    });
  });
});
