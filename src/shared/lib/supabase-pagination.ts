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
      throw error instanceof Error ? error : new Error(String(error));
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
