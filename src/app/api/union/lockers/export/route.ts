import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { naturalCompare } from "@/features/representacion/lib/lockers";

export const dynamic = "force-dynamic";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const delegationId = url.searchParams.get("delegation_id");
  const memberships = await requireUnionMembership(delegationId ?? undefined);
  const depId = delegationId ?? memberships[0]?.delegation_id;
  if (!depId) return NextResponse.json({ error: "Sin delegación" }, { status: 403 });

  const supabase = await createClient();

  // 1. Lockers con datos físicos
  const { data: rawLockers } = await supabase
    .from("union_lockers")
    .select("id, locker_number, status, condition, location, section, row_position, column_position, position_label, notes, maintenance_reason, zone_id, bank_id")
    .eq("delegation_id", depId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockers = (rawLockers ?? []) as any[];

  // 2. Zonas y Bloques
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawZones } = await (supabase as any)
    .from("union_locker_zones")
    .select("id, name")
    .eq("delegation_id", depId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawBanks } = await (supabase as any)
    .from("union_locker_banks")
    .select("id, name")
    .eq("delegation_id", depId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneMap = new Map<string, string>((rawZones ?? []).map((z: any) => [String(z.id), String(z.name)]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bankMap = new Map<string, string>((rawBanks ?? []).map((b: any) => [String(b.id), String(b.name)]));

  // 3. Asignaciones activas y trabajadores
  const { data: rawAssignments } = await supabase
    .from("union_locker_assignments")
    .select("id, locker_id, worker_id, assigned_at")
    .eq("status", "active");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (rawAssignments ?? []) as any[];
  const asgMap = new Map<string, { worker_id: string; assigned_at: string }>();
  const workerIds = new Set<string>();

  for (const a of assignments) {
    asgMap.set(a.locker_id, a);
    if (a.worker_id) workerIds.add(a.worker_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workerMap = new Map<string, any>();
  if (workerIds.size > 0) {
    const { data: rawWorkers } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn")
      .in("id", Array.from(workerIds));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workerMap = new Map((rawWorkers ?? []).map((w: any) => [w.id, w]));
  }

  // 4. Pendientes de revisión
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawPending } = await (supabase as any)
    .from("union_locker_review_items")
    .select("locker_number, reason, source_employee_number, source_worker_name")
    .eq("delegation_id", depId)
    .eq("status", "pending");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingMap = new Map((rawPending ?? []).map((p: any) => [p.locker_number, p]));

  // Ordenar naturalmente
  lockers.sort((a, b) => naturalCompare(a.locker_number, b.locker_number));

  const headers = [
    "Casillero",
    "Zona",
    "Bloque",
    "Fila",
    "Columna",
    "Estado",
    "Condición Física",
    "Trabajador Asignado",
    "Matrícula",
    "Categoría",
    "Turno",
    "Fecha Asignación",
    "Incidencia Pendiente",
    "Notas",
  ];

  const rows = lockers.map((l) => {
    const asg = asgMap.get(l.id);
    const worker = asg ? workerMap.get(asg.worker_id) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = pendingMap.get(l.locker_number) as any;

    const workerName = worker
      ? `${worker.first_name || ""} ${worker.paternal_surname || ""} ${worker.maternal_surname || ""}`.trim()
      : "";

    let statusDisplay = l.status === "available" ? "Disponible" : l.status === "assigned" ? "Asignado" : l.status;
    if (l.status === "available" && asg) statusDisplay = "Inconsistencia (Disponible c/ Asignación)";
    if (l.status === "assigned" && !asg) statusDisplay = "Inconsistencia (Asignado s/ Trabajador)";

    const conditionDisplay =
      l.condition === "maintenance"
        ? `Mantenimiento (${l.maintenance_reason || "Sin motivo"})`
        : l.condition === "blocked"
          ? "Bloqueado"
          : "Operativo (OK)";

    const pendingDisplay = pending
      ? `${pending.reason} (${pending.source_worker_name || "S/N"} - Mat. ${pending.source_employee_number || "S/N"})`
      : "";

    return [
      escapeCsv(l.locker_number),
      escapeCsv(l.zone_id ? (zoneMap.get(l.zone_id) ?? "Zona no encontrada") : "Sin ubicar"),
      escapeCsv(l.bank_id ? (bankMap.get(l.bank_id) ?? "Bloque no encontrado") : "Sin bloque"),
      escapeCsv(l.row_position ?? ""),
      escapeCsv(l.column_position ?? ""),
      escapeCsv(statusDisplay),
      escapeCsv(conditionDisplay),
      escapeCsv(workerName),
      escapeCsv(worker?.employee_number ?? ""),
      escapeCsv(worker?.category ?? ""),
      escapeCsv(worker?.turn ?? ""),
      escapeCsv(asg?.assigned_at ? new Date(asg.assigned_at).toLocaleDateString("es-MX") : ""),
      escapeCsv(pendingDisplay),
      escapeCsv(l.notes ?? ""),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario_casilleros_${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
