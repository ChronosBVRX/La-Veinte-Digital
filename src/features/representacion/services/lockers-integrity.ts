import { createClient } from "@/lib/supabase/server";

export type LockerIssueSeverity = "critical" | "warning" | "config" | "info";

export interface LockerIntegrityIssue {
  id: string;
  lockerId: string | null;
  lockerNumber: string;
  severity: LockerIssueSeverity;
  title: string;
  whatHappens: string; // QUÉ PASA
  whyItMatters: string; // POR QUÉ IMPORTA
  whatToDo: string;     // QUÉ DEBO HACER
  actionType: "locate" | "resolve_review" | "set_maintenance" | "fix_assignment" | "view_worker";
  metadata?: Record<string, unknown>;
}

export interface LockerIntegrityReport {
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  configCount: number;
  infoCount: number;
  unlocatedLockersCount: number;
  pendingReviewCount: number;
  issues: LockerIntegrityIssue[];
}

export async function getLockerIntegrityIssues(delegationId: string): Promise<LockerIntegrityReport> {
  const supabase = await createClient();
  const issues: LockerIntegrityIssue[] = [];

  // 1. Obtener todos los casilleros de la delegación
  const { data: rawLockers } = await supabase
    .from("union_lockers")
    .select("id, locker_number, status, condition, zone_id, bank_id, row_position, column_position, maintenance_reason")
    .eq("delegation_id", delegationId);

  const lockers = (rawLockers ?? []) as Array<{
    id: string;
    locker_number: string;
    status: string;
    condition: string;
    zone_id: string | null;
    bank_id: string | null;
    row_position: number | null;
    column_position: number | null;
    maintenance_reason: string | null;
  }>;

  if (lockers.length === 0) {
    return {
      totalIssues: 0,
      criticalCount: 0,
      warningCount: 0,
      configCount: 0,
      infoCount: 0,
      unlocatedLockersCount: 0,
      pendingReviewCount: 0,
      issues: [],
    };
  }

  const lockerIdSet = new Set(lockers.map((l) => l.id));

  // 2. Obtener asignaciones activas estrictamente para esta delegación
  const { data: rawAssignments } = await supabase
    .from("union_locker_assignments")
    .select("id, locker_id, worker_id, status")
    .eq("status", "active");

  const assignments = ((rawAssignments ?? []) as Array<{
    id: string;
    locker_id: string;
    worker_id: string;
    status: string;
  }>).filter((a) => lockerIdSet.has(a.locker_id));

  const activeByLockerId = new Map<string, Array<{ id: string; worker_id: string }>>();
  const activeByWorkerId = new Map<string, Array<{ id: string; locker_id: string }>>();

  for (const asg of assignments) {
    if (!activeByLockerId.has(asg.locker_id)) activeByLockerId.set(asg.locker_id, []);
    activeByLockerId.get(asg.locker_id)!.push(asg);

    if (!activeByWorkerId.has(asg.worker_id)) activeByWorkerId.set(asg.worker_id, []);
    activeByWorkerId.get(asg.worker_id)!.push(asg);
  }

  // 3. Obtener pendientes de revisión (union_locker_review_items)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawPending } = await (supabase as any)
    .from("union_locker_review_items")
    .select("id, locker_id, locker_number, reason, source_employee_number, source_worker_name")
    .eq("delegation_id", delegationId)
    .eq("status", "pending");

  const pendingItems = (rawPending ?? []) as Array<{
    id: string;
    locker_id: string | null;
    locker_number: string;
    reason: string;
    source_employee_number: string | null;
    source_worker_name: string | null;
  }>;

  let unlocatedCount = 0;

  // Analizar cada locker
  for (const locker of lockers) {
    const activeAsgs = activeByLockerId.get(locker.id) ?? [];

    // Inconsistencia Crítica: Disponible con asignación activa
    if ((locker.status === "available" || locker.status === "disponible") && activeAsgs.length > 0) {
      issues.push({
        id: `crit-avail-with-asg-${locker.id}`,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
        severity: "critical",
        title: `Locker #${locker.locker_number} · Marcado disponible con asignación activa`,
        whatHappens: "El casillero figura en estado 'Disponible' en el catálogo, pero tiene una asignación de trabajador activa registrada en la base de datos.",
        whyItMatters: "Podría asignarse a otro trabajador por error, provocando una duplicidad física en el casillero.",
        whatToDo: "Confirmar quién ocupa el casillero y actualizar su estado a Asignado o liberar la asignación previa.",
        actionType: "fix_assignment",
      });
    }

    // Inconsistencia Crítica: Asignado sin asignación activa
    if ((locker.status === "assigned" || locker.status === "ocupado") && activeAsgs.length === 0) {
      issues.push({
        id: `crit-asg-without-worker-${locker.id}`,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
        severity: "critical",
        title: `Locker #${locker.locker_number} · Marcado ocupado pero sin trabajador`,
        whatHappens: "El casillero figura como 'Asignado', pero no existe ningún registro de trabajador activo asociado a él.",
        whyItMatters: "Bloquea el casillero e impide que otros trabajadores de la lista de espera puedan utilizarlo.",
        whatToDo: "Asignar al trabajador correspondiente o liberarlo a 'Disponible' si no está en uso.",
        actionType: "fix_assignment",
      });
    }

    // Inconsistencia: Múltiples asignaciones activas en el mismo locker
    if (activeAsgs.length > 1) {
      issues.push({
        id: `crit-mult-asg-${locker.id}`,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
        severity: "critical",
        title: `Locker #${locker.locker_number} · Múltiples trabajadores activos asignados`,
        whatHappens: `El casillero tiene ${activeAsgs.length} asignaciones activas simultáneas en el sistema.`,
        whyItMatters: "Dos o más trabajadores tienen derecho formal sobre la misma puerta física.",
        whatToDo: "Revisar los expedientes y liberar la asignación que ya no esté vigente.",
        actionType: "fix_assignment",
      });
    }

    // Configuración: Sin ubicación física (zona o bloque)
    if (!locker.zone_id || !locker.bank_id) {
      unlocatedCount++;
      // No saturamos la lista de conflictos operativos con 1,199 items idénticos;
      // se contabiliza en unlocatedLockersCount para la métrica de configuración.
    } else if (locker.row_position === null || locker.column_position === null) {
      issues.push({
        id: `cfg-pos-${locker.id}`,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
        severity: "config",
        title: `Locker #${locker.locker_number} · Falta posición en bloque`,
        whatHappens: "El casillero tiene asignado un bloque físico pero no tiene definida su fila o columna.",
        whyItMatters: "No se puede renderizar en la cuadrícula visual exacta del mueble.",
        whatToDo: "Editar su posición (fila/columna) en el editor del bloque.",
        actionType: "locate",
      });
    }

    // Informativo: En mantenimiento sin motivo
    if ((locker.condition === "maintenance" || locker.status === "maintenance") && (!locker.maintenance_reason || !locker.maintenance_reason.trim())) {
      issues.push({
        id: `info-maint-reason-${locker.id}`,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
        severity: "info",
        title: `Locker #${locker.locker_number} · Mantenimiento sin motivo especificado`,
        whatHappens: "El casillero está catalogado en reparación o fuera de servicio, pero no se capturó qué falla física presenta.",
        whyItMatters: "Dificulta el seguimiento con mantenimiento del hospital (chapa, bisagra, puerta vencida).",
        whatToDo: "Ingresar el motivo (ej. 'Chapa dañada') y observaciones en la ficha del casillero.",
        actionType: "set_maintenance",
      });
    }
  }

  // Trabajadores con más de 1 locker
  for (const [workerId, workerAsgs] of activeByWorkerId.entries()) {
    if (workerAsgs.length > 1) {
      issues.push({
        id: `warn-worker-mult-lockers-${workerId}`,
        lockerId: workerAsgs[0].locker_id,
        lockerNumber: "Múltiples",
        severity: "warning",
        title: `Trabajador con ${workerAsgs.length} casilleros activos asignados`,
        whatHappens: `El trabajador tiene asignados simultáneamente ${workerAsgs.length} casilleros activos en la delegación.`,
        whyItMatters: "La regla operativa del sistema permite un casillero activo por trabajador, salvo autorización administrativa justificada.",
        whatToDo: "Revisar si un casillero previo debió ser liberado tras cambio de turno o vestidor.",
        actionType: "view_worker",
        metadata: { workerId },
      });
    }
  }

  // Incidencias de importación pendientes
  for (const item of pendingItems) {
    let reasonText = "Discrepancia en importación";
    if (item.reason === "WORKER_NOT_FOUND") reasonText = "Trabajador del archivo no encontrado en padrón";
    if (item.reason === "WORKER_MULTIPLE_LOCKERS") reasonText = "Trabajador con múltiples casilleros en el archivo";
    if (item.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS") reasonText = "Casillero disputado por dos o más personas en el archivo";

    issues.push({
      id: `review-${item.id}`,
      lockerId: item.locker_id,
      lockerNumber: item.locker_number,
      severity: "warning",
      title: `Locker #${item.locker_number} · ${reasonText}`,
      whatHappens: `En el archivo de importación figura asociado a ${item.source_worker_name || 'Trabajador'} (Mat. ${item.source_employee_number || 'S/N'}), pero no se pudo vincular automáticamente.`,
      whyItMatters: "Impide tener certeza de la asignación legal de este casillero hasta que sea conciliado.",
      whatToDo: "Hacer clic en 'Resolver' para buscar al trabajador en el padrón o asignar manualmente.",
      actionType: "resolve_review",
      metadata: { reviewId: item.id },
    });
  }

  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const configCount = issues.filter(i => i.severity === "config").length;
  const infoCount = issues.filter(i => i.severity === "info").length;

  return {
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    configCount,
    infoCount,
    unlocatedLockersCount: unlocatedCount,
    pendingReviewCount: pendingItems.length,
    issues,
  };
}
