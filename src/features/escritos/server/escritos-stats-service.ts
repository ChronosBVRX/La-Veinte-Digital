import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type { EscritosStats } from "@/shared/contracts/escritos-stats"

function getSupabaseClient(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
  requireServiceRole = false,
): ReturnType<typeof createSupabaseClient<Database>> | null {
  if (customClient) return customClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = requireServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) return null

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Consulta las estadísticas reales de generación de escritos:
 * - total_generados: Total de veces que la herramienta ha generado un escrito.
 * - total_companeros: Total de compañeros únicos identificados que han usado la herramienta.
 */
export async function getEscritosStats(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<EscritosStats> {
  const fallback: EscritosStats = { totalGenerados: 0, totalCompaneros: 0 }

  const fetchPromise = async (): Promise<EscritosStats> => {
    try {
      const client = getSupabaseClient(customClient, false)
      if (!client) return fallback

      // Primero intentamos vía RPC get_escritos_stats (optimizado y atómico)
      const { data: rpcData, error: rpcError } = await client.rpc("get_escritos_stats" as unknown as keyof Database["public"]["Functions"])

      if (!rpcError && rpcData && typeof rpcData === "object") {
        const parsed = rpcData as { total_generados?: number; total_companeros?: number }
        return {
          totalGenerados: Number(parsed.total_generados) || 0,
          totalCompaneros: Number(parsed.total_companeros) || 0,
        }
      }

      // Fallback: consulta directa a la tabla si el RPC no estuviera disponible
      const { count: totalGenerados } = await client
        .from("escritos_generations_log" as unknown as keyof Database["public"]["Tables"])
        .select("id", { count: "exact", head: true })

      return {
        totalGenerados: totalGenerados ?? 0,
        totalCompaneros: totalGenerados ? 1 : 0,
      }
    } catch (error) {
      console.warn("[escritos-stats-service] Error obteniendo estadísticas de escritos:", error)
      return fallback
    }
  }

  // Timeout preventivo de 2 segundos para evitar bloquear SSR si la red/base de datos demora
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<EscritosStats>((resolve) => {
    timer = setTimeout(() => resolve(fallback), 2000)
  })

  return Promise.race([fetchPromise(), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export interface RecordEscritoGenerationParams {
  userId?: string | null
  tipoEscrito?: string
  modo?: string
}

/**
 * Registra un evento de generación de escrito de forma atómica en el contador persistente.
 * No almacena texto, peticiones, borradores ni información privada del trabajador.
 */
export async function recordEscritoGeneration(
  params: RecordEscritoGenerationParams = {},
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<{ success: boolean; stats: EscritosStats }> {
  const fallback = { success: false, stats: { totalGenerados: 0, totalCompaneros: 0 } }

  try {
    const client = getSupabaseClient(customClient, true)
    if (!client) return fallback

    const safeTipo = (params.tipoEscrito || "general").slice(0, 50)
    const safeModo = (params.modo || "ia").slice(0, 30)

    const { data, error } = await client.rpc(
      "log_escrito_generation" as unknown as keyof Database["public"]["Functions"],
      {
        p_tipo_escrito: safeTipo,
        p_modo: safeModo,
        p_user_id: params.userId ?? null,
      } as unknown as Record<string, unknown>,
    )

    if (error) {
      console.warn("[escritos-stats-service] Error registrando generación:", error)
      return fallback
    }

    const parsed = data as { total_generados?: number; total_companeros?: number } | null

    return {
      success: true,
      stats: {
        totalGenerados: Number(parsed?.total_generados) || 0,
        totalCompaneros: Number(parsed?.total_companeros) || 0,
      },
    }
  } catch (err) {
    console.warn("[escritos-stats-service] Error inesperado registrando generación:", err)
    return fallback
  }
}
