/**
 * Canonical Worker Name Resolver for Representación Sindical
 *
 * Provides a single, uniform source of truth for resolving worker names
 * across UI, validators, DTOs, and document generators (Word, Excel, PDF).
 *
 * Guarantees consistency:
 * "SI LA UI PUEDE MOSTRAR UN NOMBRE VÁLIDO, EL VALIDADOR NO PUEDE DECIR QUE EL NOMBRE NO EXISTE."
 */

export interface UnionWorkerNameInput {
  first_name?: string | null;
  paternal_surname?: string | null;
  maternal_surname?: string | null;
  firstName?: string | null;
  paternalSurname?: string | null;
  maternalSurname?: string | null;
  siap_full_name?: string | null;
  siapFullName?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  employee_number?: string | null;
  employeeNumber?: string | null;
}

export type WorkerNameSource = "structured" | "siap" | "full_name" | "none";

export interface ResolvedUnionWorkerName {
  /**
   * Nombre completo formal en orden institucional: PATERNO [MATERNO] NOMBRE(S)
   * En mayúsculas normalizadas.
   */
  fullName: string;
  /**
   * Nombres de pila (e.g. "EDUARDO", "JUAN CARLOS")
   */
  givenNames: string;
  /**
   * Apellido paterno (e.g. "BOLAÑOS", "DE LA CRUZ")
   */
  paternalSurname: string;
  /**
   * Apellido materno si existe (e.g. "VAZQUEZ"), o cadena vacía si no existe.
   */
  maternalSurname: string;
  /**
   * Nombre representable para la interfaz humana (mismo que fullName formateado limpio).
   */
  displayName: string;
  /**
   * Fuente prioritaria de la que se obtuvo la resolución.
   */
  source: WorkerNameSource;
  /**
   * Indica si el nombre resultante es válido para emisión de licencias y documentos oficiales.
   */
  validForLicense: boolean;
}

/**
 * Normaliza texto proveniente de exportaciones mainframe/legacy de SIAP IMSS.
 *
 * En los sistemas legacy SIAP de IMSS (basados en mainframe IBM EBCDIC/ASCII 7-bit sin soporte de 'Ñ'),
 * el caracter '&' fue históricamente empleado de forma sistemática para representar la letra 'Ñ'
 * (ejemplo: "BOLA&OS" -> "BOLAÑOS", "CA&AVERAL" -> "CAÑAVERAL", "NU&EZ" -> "NUÑEZ").
 *
 * Esta función está estrictamente acotada a campos de origen SIAP y no afecta texto arbitrario del sistema.
 */
export function normalizeSiapText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/&/g, "Ñ").trim().replace(/\s+/g, " ");
}

/**
 * Resuelve canónicamente el nombre del trabajador a partir de cualquiera de sus
 * representaciones (estructuradas, SIAP, snapshot o fallback).
 *
 * Orden de prelación:
 * 1. Campos estructurados válidos (paternal_surname / first_name).
 * 2. Nombre SIAP estructurable (siap_full_name con delimitador '/' o tokens).
 * 3. Fallback genérico (full_name / name).
 * 4. Vacío (validForLicense = false).
 */
export function resolveUnionWorkerName(
  worker: UnionWorkerNameInput | null | undefined,
): ResolvedUnionWorkerName {
  if (!worker) {
    return {
      fullName: "",
      givenNames: "",
      paternalSurname: "",
      maternalSurname: "",
      displayName: "",
      source: "none",
      validForLicense: false,
    };
  }

  // 1. Campos estructurados (snake_case o camelCase)
  const fn = (worker.first_name ?? worker.firstName ?? "").trim();
  const ps = (worker.paternal_surname ?? worker.paternalSurname ?? "").trim();
  const ms = (worker.maternal_surname ?? worker.maternalSurname ?? "").trim();

  if (ps || fn) {
    const rawParts = [ps, ms, fn].filter(Boolean);
    const displayName = rawParts.join(" ").replace(/\s+/g, " ").trim();
    const paternalSurname = ps.toUpperCase();
    const maternalSurname = ms.toUpperCase();
    const givenNames = fn.toUpperCase();
    const parts = [paternalSurname, maternalSurname, givenNames].filter(Boolean);
    const fullName = parts.join(" ").replace(/\s+/g, " ").trim();

    return {
      fullName,
      givenNames,
      paternalSurname,
      maternalSurname,
      displayName,
      source: "structured",
      validForLicense: Boolean(fullName),
    };
  }

  // 2. Nombre SIAP (siap_full_name o siapFullName)
  const rawSiap = (worker.siap_full_name ?? worker.siapFullName ?? "").trim();
  if (rawSiap) {
    const cleanSiap = normalizeSiapText(rawSiap).toUpperCase();

    // Formato con diagonales SIAP: PATERNO / MATERNO / NOMBRE(S)
    if (cleanSiap.includes("/")) {
      const segments = cleanSiap.split("/").map((s) => s.trim().replace(/\s+/g, " "));

      let paternalSurname = "";
      let maternalSurname = "";
      let givenNames = "";

      if (segments.length >= 3) {
        paternalSurname = segments[0] ?? "";
        maternalSurname = segments[1] ?? ""; // Si es LOPEZ//JUAN, segments[1] es ""
        givenNames = segments.slice(2).filter(Boolean).join(" ");
      } else if (segments.length === 2) {
        paternalSurname = segments[0] ?? "";
        maternalSurname = "";
        givenNames = segments[1] ?? "";
      } else if (segments.length === 1) {
        paternalSurname = segments[0] ?? "";
      }

      const parts = [paternalSurname, maternalSurname, givenNames].filter(Boolean);
      const fullName = parts.join(" ").trim();

      return {
        fullName,
        givenNames,
        paternalSurname,
        maternalSurname,
        displayName: fullName,
        source: "siap",
        validForLicense: Boolean(fullName),
      };
    }

    // SIAP sin diagonales: división por palabras
    const tokens = cleanSiap.split(/\s+/).filter(Boolean);
    let paternalSurname = "";
    let maternalSurname = "";
    let givenNames = "";

    if (tokens.length === 1) {
      givenNames = tokens[0] ?? "";
    } else if (tokens.length === 2) {
      paternalSurname = tokens[0] ?? "";
      givenNames = tokens[1] ?? "";
    } else if (tokens.length === 3) {
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      givenNames = tokens[2] ?? "";
    } else if (tokens.length >= 4) {
      // Estándar mexicano frecuente: 2 apellidos + nombres restantes
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      givenNames = tokens.slice(2).join(" ");
    }

    const parts = [paternalSurname, maternalSurname, givenNames].filter(Boolean);
    const fullName = parts.join(" ").trim() || cleanSiap;

    return {
      fullName,
      givenNames,
      paternalSurname,
      maternalSurname,
      displayName: fullName,
      source: "siap",
      validForLicense: Boolean(fullName),
    };
  }

  // 3. Fallback de nombre completo plano (full_name, fullName o name)
  const rawFallback = (worker.full_name ?? worker.fullName ?? worker.name ?? "").trim();
  if (rawFallback) {
    const cleanFallback = normalizeSiapText(rawFallback).toUpperCase();

    if (cleanFallback.includes("/")) {
      const segments = cleanFallback.split("/").map((s) => s.trim().replace(/\s+/g, " "));
      let paternalSurname = "";
      let maternalSurname = "";
      let givenNames = "";

      if (segments.length >= 3) {
        paternalSurname = segments[0] ?? "";
        maternalSurname = segments[1] ?? "";
        givenNames = segments.slice(2).filter(Boolean).join(" ");
      } else if (segments.length === 2) {
        paternalSurname = segments[0] ?? "";
        givenNames = segments[1] ?? "";
      } else {
        paternalSurname = segments[0] ?? "";
      }

      const parts = [paternalSurname, maternalSurname, givenNames].filter(Boolean);
      const fullName = parts.join(" ").trim();

      return {
        fullName,
        givenNames,
        paternalSurname,
        maternalSurname,
        displayName: fullName,
        source: "full_name",
        validForLicense: Boolean(fullName),
      };
    }

    const tokens = cleanFallback.split(/\s+/).filter(Boolean);
    let paternalSurname = "";
    let maternalSurname = "";
    let givenNames = "";

    if (tokens.length === 1) {
      givenNames = tokens[0] ?? "";
    } else if (tokens.length === 2) {
      paternalSurname = tokens[0] ?? "";
      givenNames = tokens[1] ?? "";
    } else if (tokens.length === 3) {
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      givenNames = tokens[2] ?? "";
    } else if (tokens.length >= 4) {
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      givenNames = tokens.slice(2).join(" ");
    }

    const parts = [paternalSurname, maternalSurname, givenNames].filter(Boolean);
    const fullName = parts.join(" ").trim() || cleanFallback;

    return {
      fullName,
      givenNames,
      paternalSurname,
      maternalSurname,
      displayName: fullName,
      source: "full_name",
      validForLicense: Boolean(fullName),
    };
  }

  // 4. Sin datos
  return {
    fullName: "",
    givenNames: "",
    paternalSurname: "",
    maternalSurname: "",
    displayName: "",
    source: "none",
    validForLicense: false,
  };
}
