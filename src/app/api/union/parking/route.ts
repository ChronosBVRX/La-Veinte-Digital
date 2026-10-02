import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { fetchAllSupabaseRows, chunkArray } from "@/shared/lib/supabase-pagination";
import {
  getCavAreaLabel,
  getCavParkingLotCode,
  getCavParkingLotLabel,
  getCavShiftLabel,
  getCavVehicleModelLabel,
} from "@/features/representacion/services/parking/catalogs";
import { normalizeMatricula } from "@/features/representacion/services/parking/cav-hgr1-parser";
import {
  checkCavConnection,
  createCavRecord,
  dispatchCavBridgeCommand,
  fetchCavRecordDetail,
  getParkingBridgeStatus,
  lookupWorkerInCav,
  setCavRecordStatus,
  updateCavRecord,
} from "@/features/representacion/services/parking/cav-hgr1-client";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const createParkingSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  worker_id: z.string().uuid().nullable().optional(),
  matricula: z.string().trim().min(1, "La matrícula es obligatoria").max(30),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  apellido_paterno: z.string().trim().min(1, "El apellido paterno es obligatorio").max(120),
  apellido_materno: z.string().trim().max(120).default(""),
  cargo: z.string().trim().max(150).default(""),
  area_code: z.string().trim().min(1, "Seleccione un área").max(30),
  placas: z.string().trim().min(1, "Las placas son obligatorias").max(30),
  vehicle_model_id: z.coerce.number().int().min(1).default(376),
  parking_lot: z.enum(["1", "2", "3"]).default("1"),
  cajon_number: z.string().trim().max(20).default("0"),
  shift: z.enum(["M", "V", "N", "A"]).default("M"),
  email: z.string().trim().max(150).default(""),
});

const updateParkingSchema = z.object({
  action: z.literal("update"),
  delegation_id: z.string().uuid().optional(),
  id: z.string().uuid(),
  worker_id: z.string().uuid().nullable().optional(),
  matricula: z.string().trim().min(1).max(30),
  nombre: z.string().trim().min(1).max(120),
  apellido_paterno: z.string().trim().min(1).max(120),
  apellido_materno: z.string().trim().max(120).default(""),
  cargo: z.string().trim().max(150).default(""),
  area_code: z.string().trim().min(1).max(30),
  placas: z.string().trim().min(1).max(30),
  vehicle_model_id: z.coerce.number().int().min(1).default(376),
  parking_lot: z.enum(["1", "2", "3"]).default("1"),
  shift: z.enum(["M", "V", "N", "A"]).default("M"),
  email: z.string().trim().max(150).default(""),
});

const statusParkingSchema = z.object({
  action: z.literal("status"),
  delegation_id: z.string().uuid().optional(),
  id: z.string().uuid(),
  internal_status: z.enum(["activo", "suspendido", "baja"]),
  suspension_reason: z.string().trim().max(500).default(""),
});

interface ParkingRowRecord {
  id: string;
  delegation_id: string;
  external_id_reg: number;
  worker_id: string | null;
  matricula: string;
  full_name: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  cargo: string;
  area_code: string;
  area_label: string;
  placas: string;
  vehicle_model_id: number | null;
  vehicle_model_label: string;
  parking_lot: string;
  cajon_number: string;
  shift: string;
  email: string;
  status: string;
  internal_status: string;
  suspension_reason: string;
  last_synced_at: string;
  updated_at: string;
  created_at: string;
}

interface WorkerSummaryRow {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  category: string;
  assignment: string;
  turn: string;
  phone: string | null;
  active: boolean;
  seniority_years: number | null;
  seniority_raw: string | null;
  employment_start_date: string | null;
  source_import_state: string | null;
  source_status_code: string | null;
  avatar_url?: string | null;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  try {
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

    const supabase = await createClient();

    // 1. Verificar estado de conexión en tiempo real con el servidor CAV HGR 1 (LAN directa o Puente en Vivo vía Print Agent)
    if (url.searchParams.get("check_connection") === "1") {
      const [directStatus, bridgeStatus] = await Promise.all([
        checkCavConnection(),
        getParkingBridgeStatus(supabase, depId),
      ]);
      const reachable = directStatus.reachable || (bridgeStatus.stationOnline && bridgeStatus.bridgeCapable);
      const mode = directStatus.reachable
        ? "direct_lan"
        : bridgeStatus.stationOnline && bridgeStatus.bridgeCapable
          ? "live_bridge"
          : bridgeStatus.stationOnline
            ? "station_needs_update"
            : "offline";

      return noStore(
        NextResponse.json({
          connection: {
            ...directStatus,
            reachable,
            mode,
            bridge: bridgeStatus,
          },
        }),
      );
    }

    // 2. Búsqueda de trabajador por matrícula (cruza Padrón Sindical + CAV HGR 1)
    const lookupMat = url.searchParams.get("lookup_matricula");
    if (lookupMat) {
      const normMat = normalizeMatricula(lookupMat);
      const { data: worker } = await supabase
        .from("union_workers")
        .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, phone, active")
        .eq("delegation_id", depId)
        .eq("employee_number", normMat)
        .neq("source_import_state", "rolled_back")
        .limit(1)
        .maybeSingle();

      let cavLookup = null;
      try {
        cavLookup = await lookupWorkerInCav(normMat);
      } catch {
        try {
          const bridgeStatus = await getParkingBridgeStatus(supabase, depId);
          if (bridgeStatus.stationOnline && bridgeStatus.agentVersion === "1.2.0") {
            const bridgeRes = await dispatchCavBridgeCommand(supabase, {
              delegationId: depId,
              action: "lookup_worker",
              payload: { matricula: normMat },
              userId: auth.user.id,
              timeoutMs: 5000,
              leaveQueuedOnTimeout: false,
            });
            if (bridgeRes.executedLive && bridgeRes.result?.worker) {
              cavLookup = bridgeRes.result.worker as {
                nombre: string;
                apellido_paterno: string;
                apellido_materno: string;
                cargo: string;
              };
            }
          }
        } catch {
          // Si la red LAN o el puente no responden, usamos el Padrón Sindical
        }
      }

      return noStore(
        NextResponse.json({
          matricula: normMat,
          padronWorker: worker ?? null,
          cavWorker: cavLookup,
          suggested: {
            worker_id: worker?.id ?? null,
            matricula: normMat,
            nombre: worker?.first_name ?? cavLookup?.nombre ?? "",
            apellido_paterno: worker?.paternal_surname ?? cavLookup?.apellido_paterno ?? "",
            apellido_materno: worker?.maternal_surname ?? cavLookup?.apellido_materno ?? "",
            cargo: worker?.category ?? cavLookup?.cargo ?? "",
          },
        }),
      );
    }

    // 3. Detalle individual de registro (con enriquecimiento en vivo desde config_usuarios.php en LAN o Puente en Vivo)
    const detailId = url.searchParams.get("id");
    if (detailId) {
      const { data: rawRecord, error: recErr } = await supabase
        .from("union_parking_records")
        .select("*")
        .eq("id", detailId)
        .eq("delegation_id", depId)
        .maybeSingle();

      if (recErr || !rawRecord) {
        return noStore(NextResponse.json({ error: "Registro de estacionamiento no encontrado" }, { status: 404 }));
      }

      let record = rawRecord as unknown as ParkingRowRecord;

      if (record.external_id_reg > 0 && (!record.nombre || !record.vehicle_model_id || url.searchParams.get("refresh") === "1")) {
        let liveDetail = null;
        try {
          liveDetail = await fetchCavRecordDetail(record.external_id_reg);
        } catch {
          try {
            const bridgeStatus = await getParkingBridgeStatus(supabase, depId);
            if (bridgeStatus.stationOnline && bridgeStatus.agentVersion === "1.2.0") {
              const bridgeRes = await dispatchCavBridgeCommand(supabase, {
                delegationId: depId,
                action: "detail",
                payload: { external_id_reg: record.external_id_reg },
                userId: auth.user.id,
                timeoutMs: 6000,
                leaveQueuedOnTimeout: false,
              });
              if (bridgeRes.executedLive && bridgeRes.result?.detail) {
                liveDetail = bridgeRes.result.detail as Awaited<ReturnType<typeof fetchCavRecordDetail>>;
              }
            }
          } catch {
            // Ignorar si el puente no responde
          }
        }

        if (liveDetail) {
          const updates = {
            matricula: liveDetail.matricula || record.matricula,
            full_name: liveDetail.full_name || record.full_name,
            nombre: liveDetail.nombre,
            apellido_paterno: liveDetail.apellido_paterno,
            apellido_materno: liveDetail.apellido_materno,
            cargo: liveDetail.cargo,
            area_code: liveDetail.area_code || record.area_code,
            area_label: liveDetail.area_label || record.area_label,
            placas: liveDetail.placas || record.placas,
            vehicle_model_id: liveDetail.vehicle_model_id,
            vehicle_model_label: liveDetail.vehicle_model_label,
            parking_lot: liveDetail.parking_lot,
            cajon_number: liveDetail.cajon_number || record.cajon_number,
            shift: liveDetail.shift,
            email: liveDetail.email,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { data: updatedRow } = await supabase
            .from("union_parking_records")
            .update(updates)
            .eq("id", record.id)
            .select("*")
            .maybeSingle();
          if (updatedRow) {
            record = updatedRow as unknown as ParkingRowRecord;
          }
        }
      }

      let worker: WorkerSummaryRow | null = null;
      if (record.worker_id) {
        const { data: w } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, phone, active, seniority_years, seniority_raw, employment_start_date, source_import_state, source_status_code")
          .eq("id", record.worker_id)
          .maybeSingle();
        worker = (w as WorkerSummaryRow | null) ?? null;
      }

      let avatarUrl: string | null = null;
      const lookupMat = worker?.employee_number || record.matricula;
      if (lookupMat) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("matricula", lookupMat)
          .limit(1)
          .maybeSingle();
        avatarUrl = prof?.avatar_url ?? null;
      }
      if (worker && avatarUrl) {
        worker.avatar_url = avatarUrl;
      }

      return noStore(
        NextResponse.json({
          record: {
            ...record,
            area_label: record.area_label || getCavAreaLabel(record.area_code),
            vehicle_model_label: record.vehicle_model_label || getCavVehicleModelLabel(record.vehicle_model_id),
            parking_lot_label: getCavParkingLotLabel(record.parking_lot),
            shift_label: getCavShiftLabel(record.shift),
            worker,
            avatar_url: avatarUrl,
          },
        }),
      );
    }

    // 4. Listado paginado con filtros, métricas y cruce con el Padrón Sindical
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25));
    const statusFilter = url.searchParams.get("status") ?? "all"; // all | activo | suspendido | baja
    const lotFilter = url.searchParams.get("lot") ?? "all"; // all | 1 | 2 | 3
    const linkedFilter = url.searchParams.get("linked") ?? "all"; // all | linked | unlinked
    const areaFilter = url.searchParams.get("area") ?? "all";
    const q = (url.searchParams.get("q") ?? "").trim();

    const allRecords = await fetchAllSupabaseRows<ParkingRowRecord>(
      ({ from, to }) =>
        supabase
          .from("union_parking_records")
          .select("*")
          .eq("delegation_id", depId)
          .order("external_id_reg", { ascending: false })
          .range(from, to),
      { pageSize: 500 },
    );

    const workerIds = [...new Set(allRecords.map((r) => r.worker_id).filter((id): id is string => Boolean(id)))];
    const workerById = new Map<string, WorkerSummaryRow>();

    if (workerIds.length > 0) {
      for (const chunk of chunkArray(workerIds, 200)) {
        const { data: workers } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, phone, active, seniority_years, seniority_raw, employment_start_date, source_import_state, source_status_code")
          .in("id", chunk);
        for (const w of (workers ?? []) as WorkerSummaryRow[]) {
          workerById.set(w.id, w);
        }
      }
    }

    // Consulta en lote de avatares/fotografías desde la tabla profiles
    const allMatriculas = [
      ...new Set(
        allRecords
          .map((r) => r.matricula?.trim())
          .concat(Array.from(workerById.values()).map((w) => w.employee_number?.trim()))
          .filter((m): m is string => Boolean(m)),
      ),
    ];
    const avatarByMatricula = new Map<string, string>();
    if (allMatriculas.length > 0) {
      for (const chunk of chunkArray(allMatriculas, 200)) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("matricula, avatar_url")
          .in("matricula", chunk);
        for (const p of profs ?? []) {
          if (p.matricula && p.avatar_url) {
            avatarByMatricula.set(p.matricula, p.avatar_url);
          }
        }
      }
    }

    for (const [id, w] of workerById.entries()) {
      const avatar = avatarByMatricula.get(w.employee_number);
      if (avatar) {
        w.avatar_url = avatar;
        workerById.set(id, w);
      }
    }

    let lastSyncedAt: string | null = null;
    for (const r of allRecords) {
      if (r.last_synced_at && (!lastSyncedAt || r.last_synced_at > lastSyncedAt)) {
        lastSyncedAt = r.last_synced_at;
      }
    }

    const enriched = allRecords.map((r) => {
      const worker = r.worker_id ? (workerById.get(r.worker_id) ?? null) : null;
      const avatar_url =
        worker?.avatar_url ||
        (r.matricula ? avatarByMatricula.get(r.matricula) : null) ||
        null;
      const isUnlinked = !worker;
      const isInactive = Boolean(worker && !worker.active);
      const isMissing = Boolean(worker && worker.source_import_state === "missing");
      const isDepuracionCandidate = r.internal_status !== "baja" && (isUnlinked || isInactive || isMissing);
      const depuracionReason = !isDepuracionCandidate
        ? null
        : isUnlinked
          ? "Sin registro en Padrón Sindical"
          : isInactive
            ? "Trabajador inactivo en Padrón Sindical"
            : isMissing
              ? "Trabajador ausente en última plantilla"
              : "Pendiente de verificación";

      return {
        ...r,
        area_label: r.area_label || getCavAreaLabel(r.area_code),
        vehicle_model_label: r.vehicle_model_label || getCavVehicleModelLabel(r.vehicle_model_id),
        parking_lot_label: getCavParkingLotLabel(r.parking_lot),
        shift_label: getCavShiftLabel(r.shift),
        worker,
        avatar_url,
        isDepuracionCandidate,
        depuracionReason,
      };
    });

    const counts = {
      total: allRecords.length,
      active: allRecords.filter((r) => r.status === "A" && r.internal_status === "activo").length,
      suspended: allRecords.filter((r) => r.status === "X" && r.internal_status !== "baja").length,
      baja: allRecords.filter((r) => r.internal_status === "baja").length,
      linkedToPadron: allRecords.filter((r) => Boolean(r.worker_id)).length,
      unlinked: allRecords.filter((r) => !r.worker_id).length,
      depuracionCount: enriched.filter((r) => r.isDepuracionCandidate).length,
      baseCount: allRecords.filter((r) => r.parking_lot === "1").length,
      confianzaCount: allRecords.filter((r) => r.parking_lot === "2").length,
      visitantesCount: allRecords.filter((r) => r.parking_lot === "3").length,
      lastSyncedAt,
    };

    let filtered = enriched;

    if (statusFilter === "activo") {
      filtered = filtered.filter((r) => r.status === "A" && r.internal_status === "activo");
    } else if (statusFilter === "suspendido") {
      filtered = filtered.filter((r) => r.status === "X" && r.internal_status !== "baja");
    } else if (statusFilter === "baja") {
      filtered = filtered.filter((r) => r.internal_status === "baja");
    }

    if (lotFilter !== "all") {
      filtered = filtered.filter((r) => r.parking_lot === lotFilter);
    }

    const depuracionParam = url.searchParams.get("depuracion");
    if (depuracionParam === "1" || linkedFilter === "depuracion") {
      filtered = filtered.filter((r) => r.isDepuracionCandidate);
    } else if (linkedFilter === "linked") {
      filtered = filtered.filter((r) => Boolean(r.worker_id));
    } else if (linkedFilter === "unlinked") {
      filtered = filtered.filter((r) => !r.worker_id);
    }

    if (areaFilter !== "all") {
      filtered = filtered.filter((r) => r.area_code === areaFilter);
    }

    if (q) {
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      const qNorm = norm(q);
      filtered = filtered.filter((r) => {
        if (r.matricula && norm(r.matricula).includes(qNorm)) return true;
        if (r.placas && norm(r.placas).includes(qNorm)) return true;
        if (r.full_name && norm(r.full_name).includes(qNorm)) return true;
        if (r.cajon_number && norm(r.cajon_number).includes(qNorm)) return true;
        if (r.area_label && norm(r.area_label).includes(qNorm)) return true;
        if (r.vehicle_model_label && norm(r.vehicle_model_label).includes(qNorm)) return true;
        if (String(r.external_id_reg).includes(qNorm)) return true;
        if (r.worker) {
          const wName = `${r.worker.paternal_surname} ${r.worker.maternal_surname ?? ""} ${r.worker.first_name}`;
          if (norm(wName).includes(qNorm)) return true;
          if (r.worker.category && norm(r.worker.category).includes(qNorm)) return true;
        }
        return false;
      });
    }

    // Ordenamiento: Antigüedad descendente, ascendente, cajón, placas, nombre o recientes
    const sort = url.searchParams.get("sort") ?? "seniority_desc";
    if (sort === "seniority_desc") {
      filtered.sort((a, b) => {
        const aYears = a.worker?.seniority_years ?? -1;
        const bYears = b.worker?.seniority_years ?? -1;
        if (bYears !== aYears) return bYears - aYears;
        const aDate = a.worker?.employment_start_date || "9999-99-99";
        const bDate = b.worker?.employment_start_date || "9999-99-99";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return (b.external_id_reg || 0) - (a.external_id_reg || 0);
      });
    } else if (sort === "seniority_asc") {
      filtered.sort((a, b) => {
        const aYears = a.worker?.seniority_years ?? 999;
        const bYears = b.worker?.seniority_years ?? 999;
        if (aYears !== bYears) return aYears - bYears;
        return (b.external_id_reg || 0) - (a.external_id_reg || 0);
      });
    } else if (sort === "cajon") {
      filtered.sort((a, b) => {
        const aNum = parseInt(a.cajon_number || "0", 10);
        const bNum = parseInt(b.cajon_number || "0", 10);
        if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) return aNum - bNum;
        return (a.cajon_number || "").localeCompare(b.cajon_number || "");
      });
    } else if (sort === "name") {
      filtered.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    } else if (sort === "placas") {
      filtered.sort((a, b) => (a.placas || "").localeCompare(b.placas || ""));
    } else {
      // Por defecto reciente: external_id_reg desc
      filtered.sort((a, b) => (b.external_id_reg || 0) - (a.external_id_reg || 0));
    }

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (clampedPage - 1) * pageSize;
    const paged = filtered.slice(startIndex, startIndex + pageSize);

    return noStore(
      NextResponse.json({
        records: paged,
        pagination: {
          total: totalFiltered,
          page: clampedPage,
          pageSize,
          totalPages,
        },
        counts,
      }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStore(NextResponse.json({ error: message || "Error al consultar estacionamiento" }, { status: 500 }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = createParkingSchema.safeParse(body);
    if (!parsed.success) {
      return noStore(
        NextResponse.json({ error: "Datos inválidos para alta de vehículo", issues: parsed.error.issues }, { status: 400 }),
      );
    }

    const memberships = await requireUnionMembership(parsed.data.delegation_id);
    const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

    const supabase = await createClient();
    const normMat = normalizeMatricula(parsed.data.matricula);

    // Resolver vinculación con el Padrón Sindical si no vino explícita
    let workerId = parsed.data.worker_id ?? null;
    if (!workerId && normMat) {
      const { data: matchedWorker } = await supabase
        .from("union_workers")
        .select("id")
        .eq("delegation_id", depId)
        .eq("employee_number", normMat)
        .neq("source_import_state", "rolled_back")
        .limit(1)
        .maybeSingle();
      workerId = matchedWorker?.id ?? null;
    }

    // Ejecutar alta en el servidor CAV HGR 1 (LAN directa o Puente en Vivo vía Print Agent)
    let cavCreated: { external_id_reg: number | null } = { external_id_reg: null };
    let bridgeQueued = false;
    const createInput = {
      matricula: normMat,
      nombre: parsed.data.nombre,
      apellido_paterno: parsed.data.apellido_paterno,
      apellido_materno: parsed.data.apellido_materno,
      cargo: parsed.data.cargo,
      area_code: parsed.data.area_code,
      placas: parsed.data.placas,
      vehicle_model_id: parsed.data.vehicle_model_id,
      parking_lot: parsed.data.parking_lot,
      cajon_number: parsed.data.cajon_number,
      shift: parsed.data.shift,
      email: parsed.data.email,
    };

    try {
      cavCreated = await createCavRecord(createInput);
    } catch {
      const bridgeRes = await dispatchCavBridgeCommand<{ external_id_reg?: number | null }>(supabase, {
        delegationId: depId,
        action: "create",
        payload: createInput,
        userId: auth.user.id,
        timeoutMs: 11_000,
        leaveQueuedOnTimeout: true,
      });
      if (bridgeRes.executedLive && bridgeRes.result?.external_id_reg) {
        cavCreated = { external_id_reg: Number(bridgeRes.result.external_id_reg) };
      } else {
        bridgeQueued = bridgeRes.queued;
      }
    }

    // Si CAV no devolvió el ID nuevo inmediato, generamos un identificador temporal negativo único
    // que se reconciliará en cuanto el Puente en Vivo procese la orden
    const externalIdReg = cavCreated.external_id_reg ?? -Math.floor(Date.now() / 1000);
    const fullName = [parsed.data.nombre, parsed.data.apellido_paterno, parsed.data.apellido_materno]
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .join(" ");

    const nowIso = new Date().toISOString();
    const insertPayload = {
      delegation_id: depId,
      external_id_reg: externalIdReg,
      worker_id: workerId,
      matricula: normMat,
      full_name: fullName,
      nombre: parsed.data.nombre.trim().toUpperCase(),
      apellido_paterno: parsed.data.apellido_paterno.trim().toUpperCase(),
      apellido_materno: parsed.data.apellido_materno.trim().toUpperCase(),
      cargo: parsed.data.cargo.trim().toUpperCase(),
      area_code: parsed.data.area_code,
      area_label: getCavAreaLabel(parsed.data.area_code),
      placas: parsed.data.placas.trim().toUpperCase(),
      vehicle_model_id: parsed.data.vehicle_model_id,
      vehicle_model_label: getCavVehicleModelLabel(parsed.data.vehicle_model_id),
      parking_lot: getCavParkingLotCode(parsed.data.parking_lot),
      cajon_number: parsed.data.cajon_number.trim() || "0",
      shift: parsed.data.shift,
      email: parsed.data.email.trim(),
      status: "A",
      internal_status: "activo",
      suspension_reason: "",
      last_synced_at: nowIso,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      updated_at: nowIso,
    };

    const { data: savedRow, error: saveErr } = await supabase
      .from("union_parking_records")
      .upsert(insertPayload, { onConflict: "delegation_id,external_id_reg" })
      .select("*")
      .single();

    if (saveErr) {
      return noStore(NextResponse.json({ error: saveErr.message }, { status: 400 }));
    }

    await writeAuditLog({
      delegation_id: depId,
      entity_type: "union_parking",
      entity_id: savedRow.id,
      action: "parking.created",
      metadata: {
        external_id_reg: externalIdReg,
        matricula: normMat,
        placas: insertPayload.placas,
        worker_id: workerId,
        bridge_queued: bridgeQueued,
      },
    });

    return noStore(NextResponse.json({ ok: true, record: savedRow, queued_bridge: bridgeQueued }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStore(NextResponse.json({ error: message || "Error al dar de alta el vehículo" }, { status: 500 }));
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "update") {
      const parsed = updateParkingSchema.safeParse(body);
      if (!parsed.success) {
        return noStore(
          NextResponse.json({ error: "Datos inválidos para modificar registro", issues: parsed.error.issues }, { status: 400 }),
        );
      }

      const memberships = await requireUnionMembership(parsed.data.delegation_id);
      const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
      if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

      const supabase = await createClient();
      const { data: existing, error: findErr } = await supabase
        .from("union_parking_records")
        .select("*")
        .eq("id", parsed.data.id)
        .eq("delegation_id", depId)
        .maybeSingle();

      if (findErr || !existing) {
        return noStore(NextResponse.json({ error: "Registro no encontrado" }, { status: 404 }));
      }

      const normMat = normalizeMatricula(parsed.data.matricula);
      let bridgeQueued = false;

      if (existing.external_id_reg > 0) {
        const updatePayload = {
          external_id_reg: existing.external_id_reg,
          matricula: normMat,
          nombre: parsed.data.nombre,
          apellido_paterno: parsed.data.apellido_paterno,
          apellido_materno: parsed.data.apellido_materno,
          cargo: parsed.data.cargo,
          area_code: parsed.data.area_code,
          placas: parsed.data.placas,
          vehicle_model_id: parsed.data.vehicle_model_id,
          parking_lot: parsed.data.parking_lot,
          shift: parsed.data.shift,
          email: parsed.data.email,
        };
        try {
          await updateCavRecord(updatePayload);
        } catch {
          const bridgeRes = await dispatchCavBridgeCommand(supabase, {
            delegationId: depId,
            action: "update",
            payload: updatePayload,
            userId: auth.user.id,
            timeoutMs: 11_000,
            leaveQueuedOnTimeout: true,
          });
          bridgeQueued = bridgeRes.queued;
        }
      }

      let workerId = parsed.data.worker_id !== undefined ? parsed.data.worker_id : existing.worker_id;
      if (!workerId && normMat) {
        const { data: matchedWorker } = await supabase
          .from("union_workers")
          .select("id")
          .eq("delegation_id", depId)
          .eq("employee_number", normMat)
          .neq("source_import_state", "rolled_back")
          .limit(1)
          .maybeSingle();
        workerId = matchedWorker?.id ?? null;
      }

      const fullName = [parsed.data.nombre, parsed.data.apellido_paterno, parsed.data.apellido_materno]
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(" ");

      const nowIso = new Date().toISOString();
      const updates = {
        worker_id: workerId,
        matricula: normMat,
        full_name: fullName,
        nombre: parsed.data.nombre.trim().toUpperCase(),
        apellido_paterno: parsed.data.apellido_paterno.trim().toUpperCase(),
        apellido_materno: parsed.data.apellido_materno.trim().toUpperCase(),
        cargo: parsed.data.cargo.trim().toUpperCase(),
        area_code: parsed.data.area_code,
        area_label: getCavAreaLabel(parsed.data.area_code),
        placas: parsed.data.placas.trim().toUpperCase(),
        vehicle_model_id: parsed.data.vehicle_model_id,
        vehicle_model_label: getCavVehicleModelLabel(parsed.data.vehicle_model_id),
        parking_lot: parsed.data.parking_lot,
        shift: parsed.data.shift,
        email: parsed.data.email.trim(),
        last_synced_at: nowIso,
        updated_by: auth.user.id,
        updated_at: nowIso,
      };

      const { data: updatedRow, error: updErr } = await supabase
        .from("union_parking_records")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updErr) {
        return noStore(NextResponse.json({ error: updErr.message }, { status: 400 }));
      }

      await writeAuditLog({
        delegation_id: depId,
        entity_type: "union_parking",
        entity_id: existing.id,
        action: "parking.updated",
        metadata: {
          external_id_reg: existing.external_id_reg,
          matricula: normMat,
          placas: updates.placas,
          bridge_queued: bridgeQueued,
        },
      });

      return noStore(NextResponse.json({ ok: true, record: updatedRow, queued_bridge: bridgeQueued }));
    }

    if (action === "status") {
      const parsed = statusParkingSchema.safeParse(body);
      if (!parsed.success) {
        return noStore(
          NextResponse.json({ error: "Datos inválidos para cambio de estatus", issues: parsed.error.issues }, { status: 400 }),
        );
      }

      const memberships = await requireUnionMembership(parsed.data.delegation_id);
      const depId = parsed.data.delegation_id ?? memberships[0]?.delegation_id;
      if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

      const supabase = await createClient();
      const { data: existing, error: findErr } = await supabase
        .from("union_parking_records")
        .select("*")
        .eq("id", parsed.data.id)
        .eq("delegation_id", depId)
        .maybeSingle();

      if (findErr || !existing) {
        return noStore(NextResponse.json({ error: "Registro no encontrado" }, { status: 404 }));
      }

      const remoteStatus: "A" | "X" = parsed.data.internal_status === "activo" ? "A" : "X";
      let bridgeQueued = false;

      if (existing.external_id_reg > 0) {
        try {
          await setCavRecordStatus(existing.external_id_reg, remoteStatus);
        } catch {
          const bridgeRes = await dispatchCavBridgeCommand(supabase, {
            delegationId: depId,
            action: "toggle_status",
            payload: {
              external_id_reg: existing.external_id_reg,
              status: remoteStatus,
            },
            userId: auth.user.id,
            timeoutMs: 11_000,
            leaveQueuedOnTimeout: true,
          });
          bridgeQueued = bridgeRes.queued;
        }
      }

      const nowIso = new Date().toISOString();
      const { data: updatedRow, error: updErr } = await supabase
        .from("union_parking_records")
        .update({
          status: remoteStatus,
          internal_status: parsed.data.internal_status,
          suspension_reason: parsed.data.internal_status === "activo" ? "" : parsed.data.suspension_reason,
          last_synced_at: nowIso,
          updated_by: auth.user.id,
          updated_at: nowIso,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updErr) {
        return noStore(NextResponse.json({ error: updErr.message }, { status: 400 }));
      }

      await writeAuditLog({
        delegation_id: depId,
        entity_type: "union_parking",
        entity_id: existing.id,
        action: `parking.${parsed.data.internal_status}`,
        metadata: {
          external_id_reg: existing.external_id_reg,
          remote_status: remoteStatus,
          internal_status: parsed.data.internal_status,
          reason: parsed.data.suspension_reason,
          bridge_queued: bridgeQueued,
        },
      });

      return noStore(NextResponse.json({ ok: true, record: updatedRow, queued_bridge: bridgeQueued }));
    }

    return noStore(NextResponse.json({ error: "Acción no soportada" }, { status: 400 }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStore(NextResponse.json({ error: message || "Error al actualizar registro" }, { status: 500 }));
  }
}
