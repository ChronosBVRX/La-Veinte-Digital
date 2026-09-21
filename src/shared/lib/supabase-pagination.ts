/**
 * Helper reutilizable para paginación server-side de consultas Supabase/PostgREST.
 *
 * Resuelve de raíz el truncamiento impuesto por el límite por defecto de 1,000 registros
 * en PostgREST (`pgrst.db_max_rows = 1000`).
 */

export interface FetchAllSupabaseRowsOptions {
  pageSize?: number;
}

/**
 * Serializa de forma legible y segura los errores devueltos por Supabase/PostgREST.
 * Previene la aparición de "[object Object]" al capturar respuestas estructuradas de BD.
 */
export function toSupabaseError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const codePrefix =
      typeof e.code === "string" || typeof e.code === "number" ? `[${e.code}] ` : "";
    const mainMessage =
      typeof e.message === "string"
        ? `${codePrefix}${e.message}`
        : codePrefix
        ? codePrefix.trim()
        : null;

    const parts = [
      mainMessage,
      typeof e.details === "string" && e.details.trim() ? e.details.trim() : null,
      typeof e.hint === "string" && e.hint.trim() ? e.hint.trim() : null,
    ].filter(Boolean);

    return new Error(
      parts.length
        ? parts.join(" · ")
        : "Error desconocido de Supabase/PostgREST"
    );
  }

  return new Error(String(error));
}

/**
 * Ejecuta una consulta Supabase en bloques con `.range(from, to)` hasta obtener la totalidad de filas.
 * Funciona de forma agnóstica con cualquier tamaño de padrón (500, 1,201, 3,000, 10,000+ registros).
 */
export async function fetchAllSupabaseRows<T>(
  queryFactory: (range: { from: number; to: number }) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
  options?: FetchAllSupabaseRowsOptions,
): Promise<T[]> {
  const pageSize = options?.pageSize ?? 500;
  if (pageSize <= 0) {
    throw new Error(`Invalid pageSize: ${pageSize}. Must be greater than 0.`);
  }

  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory({ from, to });

    if (error) {
      throw toSupabaseError(error);
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

/**
 * Divide un arreglo en lotes de tamaño máximo `chunkSize`.
 * Previene desbordamiento de longitud en URLs al consultar con `.in('id', array)`.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0 || array.length === 0) {
    return array.length === 0 ? [] : [array];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
