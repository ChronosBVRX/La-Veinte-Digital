import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { fetchAllSupabaseRows, chunkArray } from "@/shared/lib/supabase-pagination";
import { z } from "zod";
import type { LockerReviewItem } from "@/features/representacion/services/worker-importer/types";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const resolveItemSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link_worker"),
    reviewItemId: z.string().uuid(),
    workerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("select_worker_for_locker"),
    reviewItemId: z.string().uuid(),
    selectedEmployeeNumber: z.string().min(1),
  }),
  z.object({
    action: z.literal("select_locker_for_worker"),
    reviewItemId: z.string().uuid(),
    selectedLockerNumber: z.string().min(1),
  }),
  z.object({
    action: z.literal("ignore"),
    reviewItemId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("batch_link_matches"),
  }),
]);

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const url = new URL(req.url);
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) {
      return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    }

    const supabase = await createClient();
    const filter = url.searchParams.get("filter") ?? "all";

    // 1. Obtener todos los pendientes activos para la delegación paginados con fetchAllSupabaseRows
    const items = await fetchAllSupabaseRows<LockerReviewItem>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_review_items")
          .select("*")
          .eq("delegation_id", depId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .range(from, to),
      { pageSize: 500 },
    );

    // 2. Calcular desglose de conteos
    let workerNotFoundCount = 0;
    let multipleWorkersCount = 0;
    let multipleLockersCount = 0;
    let otherCount = 0;

    for (const item of items) {
      if (item.reason === "WORKER_NOT_FOUND") {
        workerNotFoundCount++;
      } else if (
        item.reason === "LOCKER_MULTIPLE_WORKERS" ||
        item.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS"
      ) {
        multipleWorkersCount++;
      } else if (item.reason === "WORKER_MULTIPLE_LOCKERS") {
        multipleLockersCount++;
      } else {
        otherCount++;
      }
    }

    // 3. Inteligencia de reconciliación progresiva:
    // Cotejar pendientes WORKER_NOT_FOUND contra union_workers actual
    const missingMatriculas = [
      ...new Set(
        items
          .filter((i) => i.reason === "WORKER_NOT_FOUND" && Boolean(i.source_employee_number))
          .map((i) => i.source_employee_number as string),
      ),
    ];

    const matches: Array<{
      reviewItemId: string;
      lockerNumber: string;
      employeeNumber: string;
      workerId: string;
      workerName: string;
    }> = [];

    if (missingMatriculas.length > 0) {
      interface WorkerRowSimple {
        id: string;
        employee_number: string;
        first_name: string;
        paternal_surname: string;
        maternal_surname: string | null;
      }

      const foundList: WorkerRowSimple[] = [];
      const matriculaChunks = chunkArray(missingMatriculas, 200);

      for (const chunk of matriculaChunks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: chunkWorkers } = await (supabase as any)
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname")
          .eq("delegation_id", depId)
          .in("employee_number", chunk);

        if (chunkWorkers) {
          foundList.push(...(chunkWorkers as WorkerRowSimple[]));
        }
      }

      if (foundList.length > 0) {
        const workerMap = new Map(foundList.map((w) => [w.employee_number, w]));
        for (const it of items) {
          if (it.reason === "WORKER_NOT_FOUND" && it.source_employee_number) {
            const w = workerMap.get(it.source_employee_number);
            if (w) {
              const fullName = `${w.paternal_surname} ${w.maternal_surname ?? ""} ${w.first_name}`.trim();
              matches.push({
                reviewItemId: it.id,
                lockerNumber: it.locker_number,
                employeeNumber: it.source_employee_number,
                workerId: w.id,
                workerName: fullName,
              });
            }
          }
        }
      }
    }

    // 4. Filtrar según la pestaña seleccionada
    let filteredItems = items;
    if (filter === "worker_not_found") {
      filteredItems = items.filter((i) => i.reason === "WORKER_NOT_FOUND");
    } else if (filter === "locker_multiple_workers") {
      filteredItems = items.filter(
        (i) =>
          i.reason === "LOCKER_MULTIPLE_WORKERS" ||
          i.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS"
      );
    } else if (filter === "worker_multiple_lockers") {
      filteredItems = items.filter((i) => i.reason === "WORKER_MULTIPLE_LOCKERS");
    } else if (filter === "other") {
      filteredItems = items.filter(
        (i) =>
          i.reason !== "WORKER_NOT_FOUND" &&
          i.reason !== "LOCKER_MULTIPLE_WORKERS" &&
          i.reason !== "DUPLICATE_LOCKER_DIFFERENT_WORKERS" &&
          i.reason !== "WORKER_MULTIPLE_LOCKERS"
      );
    }

    return noStore(
      NextResponse.json({
        items: filteredItems,
        counts: {
          total: items.length,
          workerNotFound: workerNotFoundCount,
          multipleWorkers: multipleWorkersCount,
          multipleLockers: multipleLockersCount,
          other: otherCount,
        },
        newMatchesCount: matches.length,
        matches,
      })
    );
  } catch (err: unknown) {
    return noStore(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Error al cargar pendientes de lockers" },
        { status: 500 }
      )
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const json = await req.json();
    const parsed = resolveItemSchema.safeParse(json);
    if (!parsed.success) {
      return noStore(
        NextResponse.json(
          { error: "Parámetros inválidos", details: parsed.error.issues },
          { status: 400 }
        )
      );
    }

    const memberships = await requireUnionMembership();
    const depId = memberships[0]?.delegation_id;
    if (!depId) {
      return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    }

    await requireUnionAdmin(depId);
    const supabase = await createClient();
    const now = new Date().toISOString();

    const body = parsed.data;

    // A) VINCULAR TRABAJADOR MANUALMENTE
    if (body.action === "link_worker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawItem, error: itemErr } = await (supabase as any)
        .from("union_locker_review_items")
        .select("*")
        .eq("id", body.reviewItemId)
        .eq("delegation_id", depId)
        .eq("status", "pending")
        .single();

      const item = rawItem as LockerReviewItem | null;
      if (itemErr || !item) {
        return noStore(NextResponse.json({ error: "Registro pendiente no encontrado" }, { status: 404 }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: worker, error: workerErr } = await (supabase as any)
        .from("union_workers")
        .select("id, employee_number, first_name, paternal_surname, maternal_surname")
        .eq("id", body.workerId)
        .eq("delegation_id", depId)
        .single();

      if (workerErr || !worker) {
        return noStore(NextResponse.json({ error: "Trabajador no encontrado en la delegación" }, { status: 404 }));
      }

      // Asegurar casillero
      let lockerId = item.locker_id;
      if (!lockerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: locker } = await (supabase as any)
          .from("union_lockers")
          .select("id")
          .eq("delegation_id", depId)
          .eq("locker_number", item.locker_number)
          .single();
        lockerId = locker?.id;
      }

      if (!lockerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newLocker, error: newLockerErr } = await (supabase as any)
          .from("union_lockers")
          .insert({
            delegation_id: depId,
            locker_number: item.locker_number,
            status: "assigned",
            notes: "Registrado al resolver pendiente",
          })
          .select("id")
          .single();

        if (newLockerErr || !newLocker) throw newLockerErr ?? new Error("No se pudo registrar casillero");
        lockerId = newLocker.id;
      }

      if (!lockerId) {
        throw new Error("No se pudo determinar el identificador del casillero");
      }

      // Crear asignación activa
      await supabase.from("union_locker_assignments").insert({
        locker_id: lockerId,
        worker_id: worker.id,
        status: "active",
        assignment_reason: `resolved_review_item:${item.id}`,
        created_by: auth.user.id,
        assigned_at: now,
      });

      // Actualizar estado del casillero
      await supabase
        .from("union_lockers")
        .update({ status: "assigned", updated_at: now })
        .eq("id", lockerId);

      const workerFullName = `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim();

      // Resolver pendiente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "resolved",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: {
            action: "link_worker",
            worker_id: worker.id,
            worker_name: workerFullName,
            employee_number: worker.employee_number,
          },
          updated_at: now,
        })
        .eq("id", item.id);

      await writeAuditLog({
        delegation_id: depId,
        entity_type: "union_locker_review_items",
        entity_id: item.id,
        action: "resolve_locker_review_item",
        metadata: {
          action: "link_worker",
          locker_number: item.locker_number,
          worker_id: worker.id,
          employee_number: worker.employee_number,
        },
      });

      return noStore(NextResponse.json({ ok: true, resolvedId: item.id }));
    }

    // B) SELECCIONAR TRABAJADOR CUANDO UN LOCKER FUE RECLAMADO POR VARIOS
    if (body.action === "select_worker_for_locker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawItem, error: itemErr } = await (supabase as any)
        .from("union_locker_review_items")
        .select("*")
        .eq("id", body.reviewItemId)
        .eq("delegation_id", depId)
        .eq("status", "pending")
        .single();

      const item = rawItem as LockerReviewItem | null;
      if (itemErr || !item) {
        return noStore(NextResponse.json({ error: "Registro pendiente no encontrado" }, { status: 404 }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: worker, error: workerErr } = await (supabase as any)
        .from("union_workers")
        .select("id, employee_number, first_name, paternal_surname, maternal_surname")
        .eq("employee_number", body.selectedEmployeeNumber)
        .eq("delegation_id", depId)
        .single();

      if (workerErr || !worker) {
        return noStore(
          NextResponse.json(
            { error: `Trabajador con matrícula ${body.selectedEmployeeNumber} no encontrado en el padrón` },
            { status: 404 }
          )
        );
      }

      let lockerId = item.locker_id;
      if (!lockerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: l } = await (supabase as any)
          .from("union_lockers")
          .select("id")
          .eq("delegation_id", depId)
          .eq("locker_number", item.locker_number)
          .single();
        lockerId = l?.id;
      }

      if (lockerId) {
        await supabase.from("union_locker_assignments").insert({
          locker_id: lockerId,
          worker_id: worker.id,
          status: "active",
          assignment_reason: `resolved_review_item:${item.id}`,
          created_by: auth.user.id,
          assigned_at: now,
        });

        await supabase
          .from("union_lockers")
          .update({ status: "assigned", updated_at: now })
          .eq("id", lockerId);
      }

      const workerFullName = `${worker.paternal_surname} ${worker.maternal_surname ?? ""} ${worker.first_name}`.trim();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "resolved",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: {
            action: "select_worker_for_locker",
            worker_id: worker.id,
            worker_name: workerFullName,
            selected_employee_number: body.selectedEmployeeNumber,
          },
          updated_at: now,
        })
        .eq("id", item.id);

      // Resolver cualquier otro pendiente idéntico para este mismo casillero en el mismo lote
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "resolved",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: {
            action: "co_resolved_by_selection",
            selected_employee_number: body.selectedEmployeeNumber,
          },
          updated_at: now,
        })
        .eq("delegation_id", depId)
        .eq("source_batch_id", item.source_batch_id)
        .eq("locker_number", item.locker_number)
        .eq("status", "pending");

      return noStore(NextResponse.json({ ok: true, resolvedId: item.id }));
    }

    // C) SELECCIONAR CASILLERO CUANDO UNA PERSONA APARECE CON MÚLTIPLES
    if (body.action === "select_locker_for_worker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawItem, error: itemErr } = await (supabase as any)
        .from("union_locker_review_items")
        .select("*")
        .eq("id", body.reviewItemId)
        .eq("delegation_id", depId)
        .eq("status", "pending")
        .single();

      const item = rawItem as LockerReviewItem | null;
      if (itemErr || !item) {
        return noStore(NextResponse.json({ error: "Registro pendiente no encontrado" }, { status: 404 }));
      }

      const empNumber = item.source_employee_number;
      if (!empNumber) {
        return noStore(NextResponse.json({ error: "El registro no cuenta con matrícula" }, { status: 400 }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: worker } = await (supabase as any)
        .from("union_workers")
        .select("id, employee_number, first_name, paternal_surname, maternal_surname")
        .eq("employee_number", empNumber)
        .eq("delegation_id", depId)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: locker } = await (supabase as any)
        .from("union_lockers")
        .select("id")
        .eq("delegation_id", depId)
        .eq("locker_number", body.selectedLockerNumber)
        .single();

      if (worker && locker) {
        await supabase.from("union_locker_assignments").insert({
          locker_id: locker.id,
          worker_id: worker.id,
          status: "active",
          assignment_reason: `resolved_review_item:${item.id}`,
          created_by: auth.user.id,
          assigned_at: now,
        });

        await supabase
          .from("union_lockers")
          .update({ status: "assigned", updated_at: now })
          .eq("id", locker.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "resolved",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: {
            action: "select_locker_for_worker",
            selected_locker_number: body.selectedLockerNumber,
          },
          updated_at: now,
        })
        .eq("id", item.id);

      // Resolver otros pendientes del mismo trabajador en ese lote
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "resolved",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: {
            action: "co_resolved_by_locker_selection",
            selected_locker_number: body.selectedLockerNumber,
          },
          updated_at: now,
        })
        .eq("delegation_id", depId)
        .eq("source_batch_id", item.source_batch_id)
        .eq("source_employee_number", empNumber)
        .eq("status", "pending");

      return noStore(NextResponse.json({ ok: true, resolvedId: item.id }));
    }

    // D) DEJAR PENDIENTE / IGNORAR
    if (body.action === "ignore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("union_locker_review_items")
        .update({
          status: "ignored",
          resolved_by: auth.user.id,
          resolved_at: now,
          resolution: { action: "ignored_by_user" },
          updated_at: now,
        })
        .eq("id", body.reviewItemId)
        .eq("delegation_id", depId);

      return noStore(NextResponse.json({ ok: true, resolvedId: body.reviewItemId }));
    }

    // E) VINCULAR COINCIDENCIAS EN LOTE (RE-CHECK CON TRABAJADORES)
    if (body.action === "batch_link_matches") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawPendingItems } = await (supabase as any)
        .from("union_locker_review_items")
        .select("*")
        .eq("delegation_id", depId)
        .eq("status", "pending")
        .eq("reason", "WORKER_NOT_FOUND");

      const pendingItems = (rawPendingItems as LockerReviewItem[]) ?? [];
      let linkedCount = 0;

      if (pendingItems && pendingItems.length > 0) {
        const matriculas = pendingItems
          .map((i) => i.source_employee_number)
          .filter(Boolean) as string[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: workers } = await (supabase as any)
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname")
          .eq("delegation_id", depId)
          .in("employee_number", matriculas);

        interface WorkerSimple {
          id: string;
          employee_number: string;
          first_name: string;
          paternal_surname: string;
          maternal_surname: string | null;
        }

        const workerMap = new Map((workers as WorkerSimple[] | null)?.map((w) => [w.employee_number, w]) ?? []);

        for (const item of pendingItems) {
          if (!item.source_employee_number) continue;
          const w = workerMap.get(item.source_employee_number);
          if (!w) continue;

          // Asegurar casillero
          let lockerId = item.locker_id;
          if (!lockerId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: l } = await (supabase as any)
              .from("union_lockers")
              .select("id")
              .eq("delegation_id", depId)
              .eq("locker_number", item.locker_number)
              .single();
            lockerId = l?.id;
          }

          if (lockerId) {
            await supabase.from("union_locker_assignments").insert({
              locker_id: lockerId,
              worker_id: w.id,
              status: "active",
              assignment_reason: `batch_matched_review_item:${item.id}`,
              created_by: auth.user.id,
              assigned_at: now,
            });

            await supabase
              .from("union_lockers")
              .update({ status: "assigned", updated_at: now })
              .eq("id", lockerId);
          }

          const workerFullName = `${w.paternal_surname} ${w.maternal_surname ?? ""} ${w.first_name}`.trim();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("union_locker_review_items")
            .update({
              status: "resolved",
              resolved_by: auth.user.id,
              resolved_at: now,
              resolution: {
                action: "batch_matched",
                worker_id: w.id,
                worker_name: workerFullName,
                employee_number: w.employee_number,
              },
              updated_at: now,
            })
            .eq("id", item.id);

          linkedCount++;
        }
      }

      await writeAuditLog({
        delegation_id: depId,
        entity_type: "union_locker_review_items",
        entity_id: depId,
        action: "batch_link_locker_review_matches",
        metadata: { delegation_id: depId, linkedCount },
      });

      return noStore(NextResponse.json({ ok: true, linkedCount }));
    }

    return noStore(NextResponse.json({ error: "Acción no reconocida" }, { status: 400 }));
  } catch (err: unknown) {
    return noStore(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Error al procesar resolución de pendiente" },
        { status: 500 }
      )
    );
  }
}
