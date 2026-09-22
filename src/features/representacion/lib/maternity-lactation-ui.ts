// Helpers de presentación y UI para Maternidad y Lactancia.
// Preserva las fechas como valores de calendario (sin conversión UTC que desplace el día).

import type { LactationResult } from "./lactation";

export type LactationHumanStatusKey = "vigente" | "proxima_a_concluir" | "concluida";

export interface LactationHumanStatus {
  status: LactationHumanStatusKey;
  label: string;
  badgeVariant: "success" | "warning" | "neutral";
  description: string;
}

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Formatea una fecha ISO (YYYY-MM-DD) en español de México.
 * No utiliza Date local ni UTC timestamps para evitar saltos de día por zona horaria.
 */
export function formatMexicanDate(
  isoDate: string | null | undefined,
  options: { format?: "long" | "short" } = {},
): string {
  if (!isoDate || typeof isoDate !== "string") return "—";
  const trimmed = isoDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return isoDate;

  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return isoDate;

  if (options.format === "short") {
    const padDay = String(day).padStart(2, "0");
    const padMonth = String(monthIdx + 1).padStart(2, "0");
    return `${padDay}/${padMonth}/${year}`;
  }

  const monthName = MONTH_NAMES_ES[monthIdx];
  return `${day} de ${monthName} de ${year}`;
}

/**
 * Deriva el estado humano de presentación para un periodo de lactancia:
 * - remainingDays > 30: "Vigente"
 * - remainingDays entre 1 y 30: "Próxima a concluir"
 * - remainingDays === 0 o periodo posterior: "Concluida"
 */
export function getLactationHumanStatus(
  result: Pick<LactationResult, "remainingDays" | "elapsedDays" | "periodEnd">,
  todayISO?: string,
): LactationHumanStatus {
  const { remainingDays, periodEnd } = result;

  // Si hoy es estrictamente posterior a la fecha de fin o no quedan días restantes
  if (remainingDays === 0 || (todayISO && todayISO > periodEnd)) {
    return {
      status: "concluida",
      label: "Concluida",
      badgeVariant: "neutral",
      description: "El periodo contractual de 365 días naturales ha finalizado.",
    };
  }

  if (remainingDays >= 1 && remainingDays <= 30) {
    return {
      status: "proxima_a_concluir",
      label: "Próxima a concluir",
      badgeVariant: "warning",
      description: `Resta${remainingDays === 1 ? "" : "n"} ${remainingDays} día${remainingDays === 1 ? "" : "s"} para concluir el periodo contractual.`,
    };
  }

  return {
    status: "vigente",
    label: "Vigente",
    badgeVariant: "success",
    description: `Periodo contractual activo con ${remainingDays} días restantes.`,
  };
}

/**
 * Valida y extrae parámetros de continuidad (returnToWork, workerId) provenientes
 * de URLSearchParams o un objeto de strings.
 */
export function parseLactationQueryParams(
  params: URLSearchParams | Record<string, string | string[] | undefined | null>,
): { returnToWork?: string; workerId?: string } {
  let rawReturnToWork: string | null = null;
  let rawWorkerId: string | null = null;

  if (params instanceof URLSearchParams) {
    rawReturnToWork = params.get("returnToWork") ?? params.get("return_to_work");
    rawWorkerId = params.get("workerId") ?? params.get("worker_id");
  } else if (typeof params === "object" && params !== null) {
    const valR = params.returnToWork ?? params.return_to_work;
    rawReturnToWork = Array.isArray(valR) ? valR[0] : (valR ?? null);
    const valW = params.workerId ?? params.worker_id;
    rawWorkerId = Array.isArray(valW) ? valW[0] : (valW ?? null);
  }

  const out: { returnToWork?: string; workerId?: string } = {};

  if (rawReturnToWork && typeof rawReturnToWork === "string") {
    const trimmed = rawReturnToWork.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      const testDate = new Date(Date.UTC(y, m - 1, d));
      if (
        testDate.getUTCFullYear() === y &&
        testDate.getUTCMonth() === m - 1 &&
        testDate.getUTCDate() === d
      ) {
        out.returnToWork = trimmed;
      }
    }
  }

  if (rawWorkerId && typeof rawWorkerId === "string") {
    const trimmed = rawWorkerId.trim();
    // Validar identificador sin caracteres de control ni inyección
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
      out.workerId = trimmed;
    }
  }

  return out;
}

/**
 * Evalúa si una ruta pertenece a la familia Maternidad y Lactancia.
 */
export function isMaternityLactationActive(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname === "/representacion/maternidad-lactancia" ||
    pathname.startsWith("/representacion/maternidad-lactancia/") ||
    pathname === "/representacion/maternidad" ||
    pathname.startsWith("/representacion/maternidad/") ||
    pathname === "/representacion/lactancia" ||
    pathname.startsWith("/representacion/lactancia/")
  );
}
