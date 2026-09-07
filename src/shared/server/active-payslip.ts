import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

export type ImportedPayslipRow = Database["public"]["Tables"]["imported_payslips"]["Row"]

export interface ResolvedActivePayslip {
  payslip: ImportedPayslipRow | null
  selectionMode: "AUTO_LATEST" | "PINNED"
  isPinned: boolean
  isLatest: boolean
  activePayslipId: string | null
  latestPayslipId: string | null
  latestPeriodRaw: string | null
  activeMatricula: string | null
  contextRevision: string | null
}

export interface ResolveActivePayslipOptions {
  activeMatricula?: string | null
}

/**
 * Servicio canónico único para resolver el tarjetón activo de un trabajador.
 *
 * REGLAS CANÓNICAS:
 * 1. Separa estrictamente el concepto cronológico ("tarjetón más reciente")
 *    de la decisión del sistema/usuario ("tarjetón activo").
 * 2. Si el modo es PINNED y existe `active_payslip_id`:
 *    - Carga exactamente ese tarjetón.
 *    - Valida pertenencia al `user_id` y coherencia de matrícula.
 *    - Si fue eliminado o no es coherente, recurre de forma segura a AUTO_LATEST.
 * 3. Si el modo es AUTO_LATEST (o fallback seguro):
 *    - Selecciona el tarjetón más reciente para la matrícula activa del usuario.
 * 4. Todo consumidor de datos del tarjetón activo (WorkerContext, Calculadoras,
 *    Vacaciones, Guía, Nómina, etc.) DEBE usar este resolver.
 */
export async function resolveActivePayslip(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: ResolveActivePayslipOptions
): Promise<ResolvedActivePayslip> {
  let activeMatricula = options?.activeMatricula?.trim() || null

  // Si no se proveyó la matrícula activa, obtenerla del perfil
  if (!activeMatricula) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("matricula")
      .eq("id", userId)
      .maybeSingle()
    activeMatricula = profile?.matricula?.trim() || null
  }

  // 1. Consultar worker_active_context
  const { data: activeContext } = await supabase
    .from("worker_active_context")
    .select("employee_number, active_payslip_id, selection_mode, updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  const selectionMode = (activeContext?.selection_mode === "PINNED" ? "PINNED" : "AUTO_LATEST") as "AUTO_LATEST" | "PINNED"
  const pinnedPayslipId = activeContext?.active_payslip_id || null

  // 2. Consultar el tarjetón cronológicamente más reciente para la matrícula activa
  let latestQuery = supabase
    .from("imported_payslips")
    .select("*")
    .eq("user_id", userId)

  if (activeMatricula) {
    latestQuery = latestQuery.eq("employee_number", activeMatricula)
  }

  const { data: latestRows } = await latestQuery
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("period_half", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)

  const latestPayslip = latestRows?.[0] ?? null
  const latestPayslipId = latestPayslip?.id ?? null
  const latestPeriodRaw = latestPayslip?.period_raw ?? null

  // 3. Resolver según modo
  if (selectionMode === "PINNED" && pinnedPayslipId) {
    const { data: pinnedRow, error: pinnedErr } = await supabase
      .from("imported_payslips")
      .select("*")
      .eq("id", pinnedPayslipId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!pinnedErr && pinnedRow) {
      const pinnedEmpNum = pinnedRow.employee_number?.trim() || null

      // Validar coherencia con la matrícula activa
      if (!activeMatricula || !pinnedEmpNum || pinnedEmpNum === activeMatricula) {
        const isLatest = latestPayslip ? latestPayslip.id === pinnedRow.id : true
        return {
          payslip: pinnedRow,
          selectionMode: "PINNED",
          isPinned: true,
          isLatest,
          activePayslipId: pinnedRow.id,
          latestPayslipId,
          latestPeriodRaw,
          activeMatricula,
          contextRevision: activeContext?.updated_at || pinnedRow.created_at || null,
        }
      }
    }

    // El tarjetón PINNED fue eliminado o tiene discrepancia de matrícula -> fallback seguro
    // y normalizar context
    void supabase
      .from("worker_active_context")
      .update({ selection_mode: "AUTO_LATEST", active_payslip_id: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
  }

  // AUTO_LATEST
  return {
    payslip: latestPayslip,
    selectionMode: "AUTO_LATEST",
    isPinned: false,
    isLatest: true,
    activePayslipId: latestPayslipId,
    latestPayslipId,
    latestPeriodRaw,
    activeMatricula,
    contextRevision: activeContext?.updated_at || latestPayslip?.created_at || null,
  }
}
