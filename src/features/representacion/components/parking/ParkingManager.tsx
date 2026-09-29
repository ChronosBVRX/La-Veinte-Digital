"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input, Select, Textarea } from "@/shared/components/ui/Input";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import {
  CAV_AREAS,
  CAV_PARKING_LOTS,
  CAV_SHIFTS,
  CAV_VEHICLE_MODELS,
} from "@/features/representacion/services/parking/catalogs";

interface LinkedWorkerSummary {
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
}

interface ParkingRecordItem {
  id: string;
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
  parking_lot: "1" | "2" | "3";
  parking_lot_label: string;
  cajon_number: string;
  shift: "M" | "V" | "N" | "A";
  shift_label: string;
  email: string;
  status: "A" | "X";
  internal_status: "activo" | "suspendido" | "baja";
  suspension_reason: string;
  last_synced_at: string;
  worker: LinkedWorkerSummary | null;
}

interface ParkingCounts {
  total: number;
  active: number;
  suspended: number;
  baja: number;
  linkedToPadron: number;
  unlinked: number;
  baseCount: number;
  confianzaCount: number;
  visitantesCount: number;
  lastSyncedAt: string | null;
}

interface ConnectionState {
  checked: boolean;
  reachable: boolean;
  baseUrl: string;
  mode?: "direct_lan" | "live_bridge" | "station_needs_update" | "offline";
  stationName?: string | null;
  agentVersion?: string | null;
  error?: string;
}

interface FormState {
  id?: string;
  worker_id: string | null;
  matricula: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  cargo: string;
  area_code: string;
  placas: string;
  vehicle_model_id: string;
  parking_lot: "1" | "2" | "3";
  cajon_number: string;
  shift: "M" | "V" | "N" | "A";
  email: string;
}

const EMPTY_FORM: FormState = {
  worker_id: null,
  matricula: "",
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  cargo: "",
  area_code: "200217",
  placas: "",
  vehicle_model_id: "1",
  parking_lot: "1",
  cajon_number: "0",
  shift: "M",
  email: "",
};

const CAJON_OPTIONS = Array.from({ length: 76 }, (_, i) => String(i));

export function ParkingManager(): React.JSX.Element {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [records, setRecords] = useState<ParkingRecordItem[]>([]);
  const [counts, setCounts] = useState<ParkingCounts>({
    total: 0,
    active: 0,
    suspended: 0,
    baja: 0,
    linkedToPadron: 0,
    unlinked: 0,
    baseCount: 0,
    confianzaCount: 0,
    visitantesCount: 0,
    lastSyncedAt: null,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const [q, setQ] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const [lotFilter, setLotFilter] = useState("all");
  const [linkedFilter, setLinkedFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [connection, setConnection] = useState<ConnectionState>({
    checked: false,
    reachable: false,
    baseUrl: "http://11.1.17.44:8080/acceso-hgr1",
  });

  // Modal de Alta / Modificación
  const [formModalMode, setFormModalMode] = useState<"create" | "edit" | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [lookingUpMatricula, setLookingUpMatricula] = useState(false);
  const [matchedPadronInfo, setMatchedPadronInfo] = useState<string | null>(null);

  // Modal de Suspensión / Reactivación / Baja
  const [statusModalTarget, setStatusModalTarget] = useState<{
    record: ParkingRecordItem;
    nextStatus: "activo" | "suspendido" | "baja";
    reason: string;
  } | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const checkLanConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/union/parking?check_connection=1", { cache: "no-store" });
      const data = (await res.json()) as {
        connection?: {
          reachable: boolean;
          baseUrl: string;
          mode?: "direct_lan" | "live_bridge" | "station_needs_update" | "offline";
          bridge?: { stationName?: string | null; agentVersion?: string | null };
          error?: string;
        };
      };
      if (data.connection) {
        setConnection({
          checked: true,
          reachable: data.connection.reachable,
          baseUrl: data.connection.baseUrl,
          mode: data.connection.mode,
          stationName: data.connection.bridge?.stationName ?? null,
          agentVersion: data.connection.bridge?.agentVersion ?? null,
          error: data.connection.error,
        });
      }
    } catch {
      setConnection((prev) => ({ ...prev, checked: true, reachable: false }));
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        status: statusFilter,
        lot: lotFilter,
        linked: linkedFilter,
      });
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/union/parking?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as {
        records?: ParkingRecordItem[];
        counts?: ParkingCounts;
        pagination?: { total: number; page: number; totalPages: number };
        error?: string;
      };

      if (!res.ok) {
        setBannerMessage({ type: "error", text: data.error ?? "No se pudo cargar el padrón de estacionamiento." });
        return;
      }

      setRecords(data.records ?? []);
      if (data.counts) setCounts(data.counts);
      if (data.pagination) {
        setTotalFiltered(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de red al cargar registros.",
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, lotFilter, linkedFilter, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial LAN status check on mount
    void checkLanConnection();
  }, [checkLanConnection]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch parking records when filters or page change
    void loadRecords();
  }, [loadRecords]);

  const handleSyncFromCav = async () => {
    setSyncing(true);
    setBannerMessage({
      type: "info",
      text: "Sincronizando en vivo con CAV HGR 1 (11.1.17.44:8080) y cruzando matrículas con el Padrón Sindical…",
    });
    try {
      const res = await fetch("/api/union/parking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        queued_bridge?: boolean;
        message?: string;
        totalSynced?: number;
        linkedCount?: number;
        activeCount?: number;
        suspendedCount?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setBannerMessage({
          type: "error",
          text: data.error ?? "No se pudo sincronizar con el servidor CAV HGR 1.",
        });
        void checkLanConnection();
        return;
      }

      if (data.queued_bridge) {
        setBannerMessage({
          type: "info",
          text: data.message ?? "Sincronización enviada al Puente en Vivo de la oficina.",
        });
        void checkLanConnection();
        return;
      }

      setConnection((prev) => ({ ...prev, checked: true, reachable: true }));
      setBannerMessage({
        type: "success",
        text: `Sincronización en vivo completada: ${data.totalSynced ?? 0} vehículos sincronizados (${data.linkedCount ?? 0} enlazados automáticamente con el Padrón Sindical).`,
      });
      setPage(1);
      await loadRecords();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al sincronizar con el servidor CAV HGR 1.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCreate = () => {
    setFormState(EMPTY_FORM);
    setMatchedPadronInfo(null);
    setFormModalMode("create");
  };

  const handleOpenEdit = async (item: ParkingRecordItem) => {
    setMatchedPadronInfo(
      item.worker
        ? `Enlazado en Padrón Sindical: ${item.worker.paternal_surname} ${item.worker.maternal_surname ?? ""} ${item.worker.first_name} (${item.worker.category})`
        : null,
    );
    // Poblar inicialmente con los datos disponibles y luego refrescar desde config_usuarios.php
    const nameParts = item.full_name.trim().split(/\s+/);
    setFormState({
      id: item.id,
      worker_id: item.worker_id,
      matricula: item.matricula,
      nombre: item.nombre || (nameParts.slice(0, -2).join(" ") || nameParts[0] || ""),
      apellido_paterno: item.apellido_paterno || (nameParts.length >= 2 ? nameParts[nameParts.length - 2] : ""),
      apellido_materno: item.apellido_materno || (nameParts.length >= 3 ? nameParts[nameParts.length - 1] : ""),
      cargo: item.cargo || item.worker?.category || "",
      area_code: item.area_code && item.area_code !== "*" ? item.area_code : "200217",
      placas: item.placas,
      vehicle_model_id: String(item.vehicle_model_id ?? 1),
      parking_lot: item.parking_lot || "1",
      cajon_number: item.cajon_number || "0",
      shift: item.shift || "M",
      email: item.email || "",
    });
    setFormModalMode("edit");

    try {
      const res = await fetch(`/api/union/parking?id=${encodeURIComponent(item.id)}&refresh=1`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { record?: ParkingRecordItem };
        if (data.record) {
          const r = data.record;
          setFormState((prev) => ({
            ...prev,
            worker_id: r.worker_id,
            matricula: r.matricula || prev.matricula,
            nombre: r.nombre || prev.nombre,
            apellido_paterno: r.apellido_paterno || prev.apellido_paterno,
            apellido_materno: r.apellido_materno || prev.apellido_materno,
            cargo: r.cargo || prev.cargo,
            area_code: r.area_code && r.area_code !== "*" ? r.area_code : prev.area_code,
            placas: r.placas || prev.placas,
            vehicle_model_id: String(r.vehicle_model_id ?? prev.vehicle_model_id),
            parking_lot: r.parking_lot || prev.parking_lot,
            cajon_number: r.cajon_number || prev.cajon_number,
            shift: r.shift || prev.shift,
            email: r.email || prev.email,
          }));
        }
      }
    } catch {
      // Si no hay conexión LAN, se edita con los datos locales
    }
  };

  const handleLookupMatricula = async () => {
    const mat = formState.matricula.trim();
    if (!mat) return;
    setLookingUpMatricula(true);
    setMatchedPadronInfo(null);
    try {
      const res = await fetch(`/api/union/parking?lookup_matricula=${encodeURIComponent(mat)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        padronWorker?: LinkedWorkerSummary | null;
        suggested?: {
          worker_id: string | null;
          matricula: string;
          nombre: string;
          apellido_paterno: string;
          apellido_materno: string;
          cargo: string;
        };
      };

      if (data.suggested) {
        const s = data.suggested;
        setFormState((prev) => ({
          ...prev,
          worker_id: s.worker_id ?? prev.worker_id,
          matricula: s.matricula || prev.matricula,
          nombre: s.nombre || prev.nombre,
          apellido_paterno: s.apellido_paterno || prev.apellido_paterno,
          apellido_materno: s.apellido_materno || prev.apellido_materno,
          cargo: s.cargo || prev.cargo,
        }));
      }

      if (data.padronWorker) {
        const w = data.padronWorker;
        setMatchedPadronInfo(
          `Trabajador encontrado en Padrón Sindical: ${w.paternal_surname} ${w.maternal_surname ?? ""} ${w.first_name} · ${w.category} (${w.turn || "Sin turno"})`,
        );
      } else if (data.suggested?.nombre) {
        setMatchedPadronInfo(`Encontrado en base CAV HGR 1: ${data.suggested.nombre} ${data.suggested.apellido_paterno}`);
      } else {
        setMatchedPadronInfo("No se encontró esa matrícula en el Padrón Sindical; puede capturar los datos manualmente.");
      }
    } catch {
      setMatchedPadronInfo("No se pudo consultar la matrícula.");
    } finally {
      setLookingUpMatricula(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    setBannerMessage(null);
    try {
      const isEdit = formModalMode === "edit" && Boolean(formState.id);
      const res = await fetch("/api/union/parking", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { action: "update", id: formState.id } : {}),
          worker_id: formState.worker_id,
          matricula: formState.matricula,
          nombre: formState.nombre,
          apellido_paterno: formState.apellido_paterno,
          apellido_materno: formState.apellido_materno,
          cargo: formState.cargo,
          area_code: formState.area_code,
          placas: formState.placas,
          vehicle_model_id: Number(formState.vehicle_model_id) || 376,
          parking_lot: formState.parking_lot,
          cajon_number: formState.cajon_number,
          shift: formState.shift,
          email: formState.email,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setBannerMessage({
          type: "error",
          text: data.error ?? "No se pudo guardar el registro en CAV HGR 1.",
        });
        return;
      }

      setBannerMessage({
        type: "success",
        text: isEdit
          ? "Vehículo actualizado en CAV HGR 1 y enlazado con el Padrón Sindical."
          : "Vehículo dado de alta en CAV HGR 1 y enlazado con el Padrón Sindical.",
      });
      setFormModalMode(null);
      await loadRecords();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al guardar el registro.",
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModalTarget) return;
    setSavingStatus(true);
    setBannerMessage(null);
    try {
      const res = await fetch("/api/union/parking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          id: statusModalTarget.record.id,
          internal_status: statusModalTarget.nextStatus,
          suspension_reason: statusModalTarget.reason,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setBannerMessage({
          type: "error",
          text: data.error ?? "No se pudo actualizar el estatus en CAV HGR 1.",
        });
        return;
      }

      const labelMap = {
        activo: "reactivado (Activo en CAV HGR 1)",
        suspendido: "suspendido (Inactivo en CAV HGR 1)",
        baja: "dado de baja (Inactivo en CAV HGR 1)",
      };
      setBannerMessage({
        type: "success",
        text: `Registro #${statusModalTarget.record.external_id_reg} (${statusModalTarget.record.placas}) ${labelMap[statusModalTarget.nextStatus]}.`,
      });
      setStatusModalTarget(null);
      await loadRecords();
    } catch (err: unknown) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al cambiar estatus.",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const padronLinkPercent =
    counts.total > 0 ? Math.round((counts.linkedToPadron / counts.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 1280, margin: "0 auto" }}>
      {/* Encabezado y estado de enlace con CAV HGR 1 */}
      <Card padding="1.25rem">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: "clamp(1.25rem, 3vw, 1.5rem)", fontWeight: 800 }}>
                Estacionamiento y Control Vehicular (CAV HGR No. 1)
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.625rem",
                  borderRadius: 999,
                  background: !connection.checked
                    ? "var(--accent)"
                    : connection.reachable
                      ? "#ecf8f2"
                      : "#fffbeb",
                  color: !connection.checked
                    ? "var(--muted)"
                    : connection.reachable
                      ? "#126447"
                      : "#b45309",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: !connection.checked
                      ? "var(--muted)"
                      : connection.reachable
                        ? "#16a34a"
                        : "#d97706",
                  }}
                />
                {!connection.checked
                  ? "Verificando red HGR 1…"
                  : connection.mode === "live_bridge"
                    ? `Puente en Vivo Activo (${connection.stationName || "Oficina Sindical"} · v${connection.agentVersion || "1.1.0"})`
                    : connection.reachable
                      ? "Conectado en vivo a 11.1.17.44:8080 (LAN HGR 1)"
                      : connection.mode === "station_needs_update"
                        ? `Estación en línea (v${connection.agentVersion || "1.0.0"}) · Actualice a v1.1.0 para Puente en Vivo`
                        : "Modo Remoto (Cola en vivo hacia Oficina Sindical)"}
              </span>
            </div>
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
              Enlace directo con la plataforma vehicular del H.G.R. No. 1 y cruce automático por matrícula con el Padrón Sindical.
              {counts.lastSyncedAt
                ? ` Última sincronización: ${new Date(counts.lastSyncedAt).toLocaleString("es-MX")}.`
                : ""}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              size="md"
              loading={syncing}
              onClick={() => void handleSyncFromCav()}
            >
              🔄 Sincronizar con CAV HGR 1
            </Button>
            <Button variant="primary" size="md" onClick={handleOpenCreate}>
              + Dar de alta vehículo
            </Button>
          </div>
        </div>
      </Card>

      {bannerMessage ? (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: `1px solid ${
              bannerMessage.type === "error"
                ? "#fecaca"
                : bannerMessage.type === "success"
                  ? "#bbf7d0"
                  : "var(--border)"
            }`,
            background:
              bannerMessage.type === "error"
                ? "#fef2f2"
                : bannerMessage.type === "success"
                  ? "#f0fdf4"
                  : "var(--card)",
            color:
              bannerMessage.type === "error"
                ? "#991b1b"
                : bannerMessage.type === "success"
                  ? "#166534"
                  : "var(--fg)",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span>{bannerMessage.text}</span>
          <Button variant="ghost" size="sm" onClick={() => setBannerMessage(null)}>
            Cerrar
          </Button>
        </div>
      ) : null}

      {/* Tarjetas de métricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Card padding="1rem">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Total Vehículos CAV
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "0.25rem" }}>
            {counts.total.toLocaleString("es-MX")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            BASE: {counts.baseCount} · CONF: {counts.confianzaCount} · VIS: {counts.visitantesCount}
          </div>
        </Card>

        <Card padding="1rem">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#126447", textTransform: "uppercase" }}>
            Accesos Activos
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#126447", marginTop: "0.25rem" }}>
            {counts.active.toLocaleString("es-MX")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            Switch habilitado en pluma HGR 1
          </div>
        </Card>

        <Card padding="1rem">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>
            Suspendidos / Bajas
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#b45309", marginTop: "0.25rem" }}>
            {(counts.suspended + counts.baja).toLocaleString("es-MX")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            Suspendidos: {counts.suspended} · Bajas: {counts.baja}
          </div>
        </Card>

        <Card padding="1rem">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
            Enlazados al Padrón Sindical
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.25rem" }}>
            {counts.linkedToPadron.toLocaleString("es-MX")}{" "}
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>({padronLinkPercent}%)</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            Sin enlazar: {counts.unlinked}
          </div>
        </Card>
      </div>

      {/* Barra de búsqueda y filtros */}
      <Card padding="1rem">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
            alignItems: "end",
          }}
        >
          <Input
            label="Buscar por matrícula, placas, nombre o cajón"
            placeholder="Ej. 99173930, PJJ556C, REBOLLO…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />

          <Select
            label="Estatus"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los estatus</option>
            <option value="activo">Activos (Switch ON)</option>
            <option value="suspendido">Suspendidos (Switch OFF)</option>
            <option value="baja">Bajas registradas</option>
          </Select>

          <Select
            label="Estacionamiento"
            value={lotFilter}
            onChange={(e) => {
              setLotFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos (BASE / CONFIANZA / VISITANTES)</option>
            <option value="1">BASE</option>
            <option value="2">CONFIANZA</option>
            <option value="3">VISITANTES</option>
          </Select>

          <Select
            label="Vínculo con Padrón Sindical"
            value={linkedFilter}
            onChange={(e) => {
              setLinkedFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="linked">Enlazados con Padrón Sindical</option>
            <option value="unlinked">Sin coincidencia en Padrón</option>
          </Select>
        </div>
      </Card>

      {/* Tabla de registros */}
      <Card padding="0">
        {loading ? (
          <div style={{ padding: "2.5rem" }}>
            <LoadingSpinner text="Cargando registros de estacionamiento…" />
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--muted)" }}>
            <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
              {counts.total === 0
                ? "Aún no se han sincronizado los vehículos desde el servidor CAV HGR 1."
                : "No se encontraron vehículos con los filtros seleccionados."}
            </p>
            {counts.total === 0 ? (
              <div style={{ marginTop: "0.875rem" }}>
                <Button variant="primary" loading={syncing} onClick={() => void handleSyncFromCav()}>
                  🔄 Sincronizar ahora desde 11.1.17.44:8080
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8125rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "var(--accent)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}># / Cajón</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Trabajador y Padrón Sindical</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Placas y Vehículo</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Área / Turno</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Estatus CAV</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const isActive = rec.status === "A" && rec.internal_status === "activo";
                  const isBaja = rec.internal_status === "baja";
                  return (
                    <tr
                      key={rec.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 800, fontSize: "0.875rem" }}>
                          Cajón {rec.cajon_number || "0"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          ID #{rec.external_id_reg} · {rec.parking_lot_label}
                        </div>
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>
                          {rec.full_name || "SIN NOMBRE"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                          Matrícula: <strong>{rec.matricula || "—"}</strong>
                        </div>
                        {rec.worker ? (
                          <div style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "0.1rem 0.45rem",
                                borderRadius: 999,
                                background: "#eff6ff",
                                color: "var(--primary)",
                              }}
                            >
                              ✓ En Padrón: {rec.worker.category}
                            </span>
                            <Link
                              href={`/representacion/trabajadores?q=${encodeURIComponent(rec.worker.employee_number)}`}
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--primary)",
                                textDecoration: "none",
                              }}
                            >
                              Ver expediente →
                            </Link>
                          </div>
                        ) : (
                          <div style={{ marginTop: "0.25rem", fontSize: "0.6875rem", color: "var(--muted)" }}>
                            Sin coincidencia en Padrón Sindical
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontFamily: "monospace",
                            fontWeight: 800,
                            fontSize: "0.875rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.25rem",
                            border: "1px solid var(--border)",
                            background: "var(--bg)",
                          }}
                        >
                          {rec.placas || "SIN PLACA"}
                        </span>
                        {rec.vehicle_model_label ? (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                            {rec.vehicle_model_label}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontSize: "0.8125rem" }}>{rec.area_label || rec.area_code || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Turno: {rec.shift_label}
                        </div>
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: "0.15rem 0.55rem",
                            background: isActive ? "#ecf8f2" : isBaja ? "#fef2f2" : "#fffbeb",
                            color: isActive ? "#126447" : isBaja ? "#b91c1c" : "#b45309",
                          }}
                        >
                          {isActive ? "ACTIVO" : isBaja ? "BAJA" : "SUSPENDIDO"}
                        </span>
                        {rec.suspension_reason ? (
                          <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem", maxWidth: 180 }}>
                            Motivo: {rec.suspension_reason}
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "0.375rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenEdit(rec)}
                          >
                            Modificar
                          </Button>

                          {isActive ? (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setStatusModalTarget({
                                    record: rec,
                                    nextStatus: "suspendido",
                                    reason: "",
                                  })
                                }
                              >
                                Suspender
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  setStatusModalTarget({
                                    record: rec,
                                    nextStatus: "baja",
                                    reason: "",
                                  })
                                }
                              >
                                Baja
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                setStatusModalTarget({
                                  record: rec,
                                  nextStatus: "activo",
                                  reason: "",
                                })
                              }
                            >
                              Reactivar
                            </Button>
                          )}

                          {rec.external_id_reg > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(`/api/union/parking/${encodeURIComponent(rec.id)}/qr`, "_blank", "noopener,noreferrer")
                              }
                            >
                              📄 QR PDF
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              fontSize: "0.8125rem",
            }}
          >
            <span style={{ color: "var(--muted)" }}>
              Mostrando página {page} de {totalPages} ({totalFiltered.toLocaleString("es-MX")} registros)
            </span>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Modal de Alta / Modificación */}
      {formModalMode ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <Card
            padding="1.25rem"
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
                {formModalMode === "create"
                  ? "Alta de Vehículo en Estacionamiento (CAV HGR 1)"
                  : "Modificar Vehículo en Estacionamiento (CAV HGR 1)"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setFormModalMode(null)}>
                ✕
              </Button>
            </div>

            <form onSubmit={(e) => void handleSubmitForm(e)} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.5rem",
                  alignItems: "end",
                }}
              >
                <Input
                  label="Matrícula IMSS"
                  placeholder="Ej. 99173930"
                  required
                  value={formState.matricula}
                  onChange={(e) => setFormState((prev) => ({ ...prev, matricula: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={lookingUpMatricula}
                  onClick={() => void handleLookupMatricula()}
                >
                  🔍 Buscar en Padrón / CAV
                </Button>
              </div>

              {matchedPadronInfo ? (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius)",
                    background: "#eff6ff",
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  {matchedPadronInfo}
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                <Input
                  label="Nombre(s)"
                  required
                  value={formState.nombre}
                  onChange={(e) => setFormState((prev) => ({ ...prev, nombre: e.target.value }))}
                />
                <Input
                  label="Apellido Paterno"
                  required
                  value={formState.apellido_paterno}
                  onChange={(e) => setFormState((prev) => ({ ...prev, apellido_paterno: e.target.value }))}
                />
                <Input
                  label="Apellido Materno"
                  value={formState.apellido_materno}
                  onChange={(e) => setFormState((prev) => ({ ...prev, apellido_materno: e.target.value }))}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                <Input
                  label="Cargo / Categoría"
                  value={formState.cargo}
                  onChange={(e) => setFormState((prev) => ({ ...prev, cargo: e.target.value }))}
                />
                <Select
                  label="Área HGR No. 1"
                  value={formState.area_code}
                  onChange={(e) => setFormState((prev) => ({ ...prev, area_code: e.target.value }))}
                >
                  {CAV_AREAS.map((area) => (
                    <option key={area.code} value={area.code}>
                      {area.code} — {area.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                <Input
                  label="Número de Placas"
                  placeholder="Ej. PJJ556C"
                  required
                  value={formState.placas}
                  onChange={(e) => setFormState((prev) => ({ ...prev, placas: e.target.value.toUpperCase() }))}
                />
                <Select
                  label="Marca / Modelo"
                  value={formState.vehicle_model_id}
                  onChange={(e) => setFormState((prev) => ({ ...prev, vehicle_model_id: e.target.value }))}
                >
                  {CAV_VEHICLE_MODELS.map((model) => (
                    <option key={model.code} value={model.code}>
                      {model.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                <Select
                  label="Estacionamiento"
                  value={formState.parking_lot}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, parking_lot: e.target.value as "1" | "2" | "3" }))
                  }
                >
                  {CAV_PARKING_LOTS.map((lot) => (
                    <option key={lot.code} value={lot.code}>
                      {lot.label}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Turno"
                  value={formState.shift}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, shift: e.target.value as "M" | "V" | "N" | "A" }))
                  }
                >
                  {CAV_SHIFTS.map((shift) => (
                    <option key={shift.code} value={shift.code}>
                      {shift.label}
                    </option>
                  ))}
                </Select>

                {formModalMode === "create" ? (
                  <Select
                    label="Cajón Estacionamiento"
                    value={formState.cajon_number}
                    onChange={(e) => setFormState((prev) => ({ ...prev, cajon_number: e.target.value }))}
                  >
                    {CAJON_OPTIONS.map((num) => (
                      <option key={num} value={num}>
                        Cajón {num}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>

              <Input
                label="Correo electrónico (opcional)"
                type="email"
                placeholder="usuario@imss.gob.mx"
                value={formState.email}
                onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <Button type="button" variant="outline" onClick={() => setFormModalMode(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" loading={savingForm}>
                  {formModalMode === "create" ? "Guardar Alta en CAV HGR 1" : "Guardar Cambios en CAV HGR 1"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {/* Modal de confirmación para Suspender / Reactivar / Dar de Baja */}
      {statusModalTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <Card padding="1.25rem" style={{ width: "100%", maxWidth: 480 }}>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
              {statusModalTarget.nextStatus === "activo"
                ? "Reactivar Acceso Vehicular"
                : statusModalTarget.nextStatus === "suspendido"
                  ? "Suspender Acceso Vehicular"
                  : "Dar de Baja Vehículo"}
            </h2>
            <p style={{ margin: "0.5rem 0 0.875rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              Registro <strong>#{statusModalTarget.record.external_id_reg}</strong> ·{" "}
              <strong>{statusModalTarget.record.full_name}</strong> · Placas{" "}
              <strong>{statusModalTarget.record.placas}</strong>.
              {statusModalTarget.nextStatus === "activo"
                ? " Se activará el switch de acceso en el servidor CAV HGR 1 (SD1=A)."
                : " Se desactivará el switch de acceso en el servidor CAV HGR 1 (SD1=X)."}
            </p>

            {statusModalTarget.nextStatus !== "activo" ? (
              <div style={{ marginBottom: "1rem" }}>
                <Textarea
                  label="Motivo de suspensión o baja (opcional)"
                  placeholder="Ej. Cambio de vehículo, incidencia en estacionamiento, término de comisión…"
                  value={statusModalTarget.reason}
                  onChange={(e) =>
                    setStatusModalTarget((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                />
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="outline" onClick={() => setStatusModalTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant={statusModalTarget.nextStatus === "baja" ? "danger" : "primary"}
                loading={savingStatus}
                onClick={() => void handleConfirmStatusChange()}
              >
                Confirmar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
