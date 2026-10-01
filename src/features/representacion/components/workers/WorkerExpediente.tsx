"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { getWorkerDisplayName } from "../WorkerPicker";
import type { UnionExpedienteCase, UnionWorkerExpediente } from "../../services/worker-directory";

const CASE_TYPE_LABEL: Record<string, string> = {
  maternity: "Maternidad",
  lactation: "Lactancia",
  passage_026: "Pasaje 026",
  passage_027: "Pasaje 027",
  license: "Licencia",
  locker: "Locker",
};

const CASE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  ready: "Listo",
  submitted: "Enviado",
  under_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  completed: "Concluido",
  cancelled: "Cancelado",
  archived: "Archivado",
};

const LOCKER_ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  released: "Liberado",
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "worker.created": "Alta de trabajador",
  "worker.updated": "Actualización de trabajador",
  "worker.imported": "Importación SIAP",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function caseLabel(caseType: string): string {
  return CASE_TYPE_LABEL[caseType] ?? caseType;
}

function statusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] ?? status;
}

function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }): React.JSX.Element {
  const visible = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "—" && item.value !== "");
  if (visible.length === 0) {
    return <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>Sin datos registrados.</p>;
  }
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem 0.875rem" }}>
      {visible.map((item) => (
        <div key={item.label} style={{ minWidth: 0 }}>
          <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>
            {item.label}
          </dt>
          <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem", overflowWrap: "anywhere" }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  count,
  defaultOpen,
  forceOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const panelId = useId();
  const isOpen = forceOpen !== undefined ? forceOpen : open;

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--card)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.75rem 0.875rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--fg)",
          minHeight: 44,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", minWidth: 0, overflowWrap: "anywhere" }}>{title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {typeof count === "number" ? (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                background: "var(--accent)",
                color: "var(--muted)",
                borderRadius: 999,
                padding: "0.125rem 0.5rem",
              }}
            >
              {count}
            </span>
          ) : null}
          <CaretDown
            size={16}
            weight="bold"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease", color: "var(--muted)" }}
          />
        </span>
      </button>
      {isOpen ? (
        <div id={panelId} style={{ padding: "0 0.875rem 0.875rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ paddingTop: "0.75rem" }}>{children}</div>
        </div>
      ) : null}
    </section>
  );
}

function CaseCard({ item }: { item: UnionExpedienteCase }): React.JSX.Element {
  const detail = item.license ?? item.maternity ?? item.lactation ?? item.passage;
  const rows: Array<{ label: string; value: ReactNode }> = [];

  if (item.license) {
    const license = item.license as Record<string, unknown>;
    rows.push(
      { label: "Tipo", value: license.with_pay ? "Con goce" : "Sin goce" },
      { label: "Periodo", value: `${formatDate(license.start_date as string)} → ${formatDate(license.end_date as string)}` },
      { label: "Días", value: String(license.total_days ?? "") },
      { label: "Motivo", value: String(license.reason ?? "") },
      { label: "Comprobante", value: String(license.proof_description ?? "") },
      { label: "Adeudo", value: String(license.debt_certification_status ?? "") },
    );
  }
  if (item.maternity) {
    const maternity = item.maternity as Record<string, unknown>;
    rows.push(
      { label: "Incapacidad", value: `${formatDate(maternity.incapacity_start as string)} → ${formatDate(maternity.incapacity_end as string)}` },
      { label: "Reanudación", value: formatDate(maternity.return_to_work as string) },
      { label: "Lactancia", value: `${formatDate(maternity.lactation_start as string)} → ${formatDate(maternity.lactation_end as string)}` },
    );
  }
  if (item.lactation) {
    const lactation = item.lactation as Record<string, unknown>;
    rows.push(
      { label: "Reanudación", value: formatDate(lactation.return_to_work as string) },
      { label: "Periodo 365 días", value: `${formatDate(lactation.period_start as string)} → ${formatDate(lactation.period_end as string)}` },
      { label: "Jornada", value: String(lactation.workday_type ?? "") },
      { label: "Modalidad", value: String(lactation.selected_modality ?? "") },
    );
  }
  if (item.passage) {
    const passage = item.passage as Record<string, unknown>;
    rows.push(
      { label: "Concepto", value: String(passage.concept ?? "") },
      { label: "Solicitud", value: formatDate(passage.request_date as string) },
      { label: "OOAD", value: String(passage.ooad ?? "") },
      { label: "Número de control", value: String(passage.control_number ?? "") || "Pendiente" },
      { label: "Estado externo", value: String(passage.external_status ?? "") },
      { label: "Observaciones", value: String(passage.observations ?? "") },
    );
  }
  if (!detail) {
    rows.push({ label: "Detalle", value: "Sin detalle capturado." });
  }

  return (
    <article style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.625rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", overflowWrap: "anywhere" }}>{item.folio}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {caseLabel(item.case_type)} · Abierto {formatDate(item.opened_at)}
            {item.closed_at ? ` · Cerrado ${formatDate(item.closed_at)}` : ""}
          </div>
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            background: "var(--accent)",
            borderRadius: 999,
            padding: "0.125rem 0.5rem",
            flexShrink: 0,
          }}
        >
          {statusLabel(item.status)}
        </span>
      </header>
      <DetailList items={rows} />
    </article>
  );
}

export function WorkerExpediente({ expediente }: { expediente: UnionWorkerExpediente }): React.JSX.Element {
  const { worker, cases, lockers, parking = [], waitlist, audit } = expediente;
  const [activeTab, setActiveTab] = useState<string>("todos");

  const licenseCases = cases.filter((c) => c.case_type === "license");
  const maternityCases = cases.filter((c) => c.case_type === "maternity");
  const lactationCases = cases.filter((c) => c.case_type === "lactation");
  const passageCases = cases.filter((c) => c.case_type === "passage_026" || c.case_type === "passage_027");
  const documents = cases.flatMap((c) => c.documents.map((d) => ({ ...d, folio: c.folio })));
  const events = cases
    .flatMap((c) => c.events.map((e) => ({ ...e, folio: c.folio })))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const hasLaborData = Boolean(
    worker.contract_type_code ||
      worker.plaza_code ||
      worker.plaza_type_code ||
      worker.department_description ||
      worker.position_description ||
      worker.schedule_description ||
      worker.shift_code ||
      worker.occupation_start_date ||
      worker.occupation_limit_date ||
      worker.source_import_state,
  );

  const ageLabel = (() => {
    if (worker.seniority_raw) return worker.seniority_raw;
    if (worker.seniority_years !== null && worker.seniority_years !== undefined) {
      return `${worker.seniority_years} años`;
    }
    return "—";
  })();

  const totalCases = cases.length;
  const totalLockers = lockers.length + waitlist.length;
  const totalParking = parking.length;
  const totalDocuments = documents.length;
  const totalHistory = events.length + audit.length;

  const showTabSection = (tabName: string) => {
    return activeTab === "todos" || activeTab === tabName;
  };

  const activeLocker = lockers[0] ?? null;
  const activeVehicle = parking[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* 1. FICHA PRINCIPAL DEL TRABAJADOR Y HUB OPERATIVO INTEGRADO */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderLeft: "3.5px solid var(--primary)",
          borderRadius: "var(--radius-lg)",
          background: "var(--card)",
          padding: "0.875rem",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(1.125rem, 4.5vw, 1.375rem)", fontWeight: 800, overflowWrap: "anywhere" }}>
              {getWorkerDisplayName(worker)}
            </h2>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                borderRadius: 999,
                padding: "0.15rem 0.55rem",
                background: worker.active ? "#ecf8f2" : "var(--accent)",
                color: worker.active ? "#126447" : "var(--muted)",
                letterSpacing: "0.02em",
              }}
            >
              {worker.active ? "ACTIVO" : "INACTIVO"}
            </span>
          </div>

          <dl style={{ margin: "0.5rem 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.4rem 0.75rem" }}>
            <div>
              <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>Matrícula</dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem", fontWeight: 700 }}>{worker.employee_number}</dd>
            </div>
            <div>
              <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>Categoría</dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}>{worker.category || "—"}</dd>
            </div>
            <div>
              <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>Turno</dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}>{worker.turn || "—"}</dd>
            </div>
            <div>
              <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>Adscripción</dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}>{worker.assignment || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* HUB OPERACIONAL INTEGRADO (Móvil y Escritorio: Locker, Estacionamiento y Trámites a 1 toque) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Card Rápida: Locker Sindical */}
          <div
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              padding: "0.625rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "0.375rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.03em" }}>
                🗄️ Locker
              </span>
              {activeLocker ? (
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "0.0625rem 0.375rem",
                    background: activeLocker.status === "active" ? "#ecf8f2" : "var(--accent)",
                    color: activeLocker.status === "active" ? "#126447" : "var(--muted)",
                  }}
                >
                  {activeLocker.status === "active" ? "ACTIVO" : "LIBERADO"}
                </span>
              ) : waitlist.length > 0 ? (
                <span style={{ fontSize: "0.625rem", fontWeight: 700, borderRadius: 999, padding: "0.0625rem 0.375rem", background: "#fffbeb", color: "#b45309" }}>
                  EN ESPERA
                </span>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                {activeLocker ? "Casillero Asignado" : waitlist.length > 0 ? "En lista de espera" : "Sin casillero"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
                {activeLocker
                  ? `${activeLocker.section ? `Sec. ${activeLocker.section} · ` : ""}${activeLocker.location || "Unidad médica"}`
                  : waitlist.length > 0
                    ? `Solicitado ${formatDate(waitlist[0]?.requested_at)}`
                    : "No asignado"}
              </div>
            </div>

            <div style={{ marginTop: "0.25rem" }}>
              {activeLocker ? (
                <Link
                  href={`/representacion/lockers?locker=${encodeURIComponent(activeLocker.locker_id || activeLocker.id)}&q=${encodeURIComponent(activeLocker.locker_number)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    color: "var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    minHeight: 32,
                    width: "100%",
                  }}
                >
                  🗺 Ver en mapa
                </Link>
              ) : (
                <Link
                  href={`/representacion/lockers?q=${encodeURIComponent(worker.employee_number)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    color: "var(--muted)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    minHeight: 32,
                    width: "100%",
                  }}
                >
                  + Asignar locker
                </Link>
              )}
            </div>
          </div>

          {/* Card Rápida: Estacionamiento CAV con 1-TAP QR */}
          <div
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              padding: "0.625rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "0.375rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.03em" }}>
                🚗 Estacionamiento CAV
              </span>
              {activeVehicle ? (
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "0.0625rem 0.375rem",
                    background: activeVehicle.status === "A" && activeVehicle.internal_status === "activo" ? "#ecf8f2" : "#fffbeb",
                    color: activeVehicle.status === "A" && activeVehicle.internal_status === "activo" ? "#126447" : "#b45309",
                  }}
                >
                  {activeVehicle.status === "A" && activeVehicle.internal_status === "activo" ? "ACTIVO" : "SUSPENDIDO"}
                </span>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                {activeVehicle ? (
                  <span style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>{activeVehicle.placas || "SIN PLACA"}</span>
                ) : (
                  "Sin vehículo"
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
                {activeVehicle
                  ? `Cajón ${activeVehicle.cajon_number || "0"} · ${activeVehicle.parking_lot === "2" ? "Confianza" : activeVehicle.parking_lot === "3" ? "Visitante" : "Base"}`
                  : "No registrado en pluma"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
              {activeVehicle ? (
                <>
                  <a
                    href={`/api/union/parking/${encodeURIComponent(activeVehicle.id)}/qr`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-fg)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      minHeight: 32,
                      flex: "1 1 auto",
                    }}
                  >
                    📄 Tarjetón QR
                  </a>
                  <Link
                    href={`/representacion/estacionamiento?q=${encodeURIComponent(worker.employee_number)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.25rem 0.4rem",
                      borderRadius: "0.25rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--muted)",
                      fontSize: "0.75rem",
                      textDecoration: "none",
                      minHeight: 32,
                    }}
                    title="Administrar en CAV"
                  >
                    ⚙️
                  </Link>
                </>
              ) : (
                <Link
                  href={`/representacion/estacionamiento?q=${encodeURIComponent(worker.employee_number)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    color: "var(--muted)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    minHeight: 32,
                    width: "100%",
                  }}
                >
                  + Registrar vehículo
                </Link>
              )}
            </div>
          </div>

          {/* Card Rápida: Trámites Sindicales */}
          <div
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              padding: "0.625rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "0.375rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.03em" }}>
                📋 Trámites
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "0.0625rem 0.375rem",
                  background: "var(--accent)",
                  color: "var(--muted)",
                }}
              >
                {totalCases}
              </span>
            </div>

            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                {totalCases > 0 ? `${totalCases} caso${totalCases === 1 ? "" : "s"} registrado${totalCases === 1 ? "" : "s"}` : "Sin trámites"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", overflowWrap: "anywhere" }}>
                {totalCases > 0
                  ? `${cases.filter((c) => c.status !== "completed" && c.status !== "cancelled").length} activos · ${documents.length} docs`
                  : "Licencias, maternidad, pasajes"}
              </div>
            </div>

            <div style={{ marginTop: "0.25rem" }}>
              <Link
                href={`/representacion/licencias?q=${encodeURIComponent(worker.employee_number)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--primary)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  minHeight: 32,
                  width: "100%",
                }}
              >
                + Nuevo trámite
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE PESTAÑAS DE NAVEGACIÓN RÁPIDA (Óptimo para móvil) */}
      {(hasLaborData || totalCases > 0 || totalLockers > 0 || totalParking > 0 || totalDocuments > 0 || totalHistory > 0) ? (
        <nav
          role="tablist"
          aria-label="Pestañas del expediente"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            overflowX: "auto",
            paddingBottom: "0.125rem",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {[
            { id: "todos", label: "Vista completa" },
            { id: "resumen", label: "Resumen" },
            ...(hasLaborData ? [{ id: "laboral", label: "Datos laborales" }] : []),
            ...(totalCases > 0 ? [{ id: "tramites", label: `Trámites (${totalCases})` }] : []),
            ...(totalLockers > 0 ? [{ id: "lockers", label: `Lockers (${totalLockers})` }] : []),
            ...(totalParking > 0 ? [{ id: "parking", label: `Estacionamiento (${totalParking})` }] : []),
            ...(totalDocuments > 0 ? [{ id: "documentos", label: `Documentos (${totalDocuments})` }] : []),
            ...(totalHistory > 0 ? [{ id: "historial", label: `Historial (${totalHistory})` }] : []),
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.8125rem",
                  fontWeight: isSelected ? 700 : 600,
                  border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  background: isSelected ? "var(--primary)" : "var(--card)",
                  color: isSelected ? "var(--primary-fg)" : "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  minHeight: 36,
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* 3. SECCIONES DETALLADAS DEL EXPEDIENTE */}
      {showTabSection("resumen") ? (
        <Section title="Resumen" defaultOpen forceOpen={activeTab === "resumen" ? true : undefined}>
          <DetailList
            items={[
              { label: "Antigüedad", value: ageLabel },
              { label: "Ingreso", value: formatDate(worker.employment_start_date) },
              { label: "Horario", value: worker.schedule },
              { label: "Descansos", value: worker.rest_days },
              { label: "Teléfono", value: worker.phone },
              { label: "Notas", value: worker.notes },
            ]}
          />
        </Section>
      ) : null}

      {hasLaborData && showTabSection("laboral") ? (
        <Section title="Datos laborales" forceOpen={activeTab === "laboral" ? true : undefined}>
          <DetailList
            items={[
              { label: "Tipo de contrato", value: worker.contract_type_code },
              { label: "Plaza", value: worker.plaza_code },
              { label: "Tipo de plaza", value: worker.plaza_type_code },
              { label: "Departamento", value: worker.department_description },
              { label: "Puesto", value: worker.position_description },
              { label: "Horario (clave)", value: worker.schedule_description },
              { label: "Turno (clave)", value: worker.shift_code },
              { label: "Inicio de ocupación", value: formatDate(worker.occupation_start_date) },
              { label: "Límite de ocupación", value: formatDate(worker.occupation_limit_date) },
              { label: "Origen", value: worker.source_import_state === "active" || worker.source_import_state === "imported" ? "Importado SIAP" : worker.source_import_state },
            ]}
          />
        </Section>
      ) : null}

      {licenseCases.length > 0 && showTabSection("tramites") ? (
        <Section title="Licencias" count={licenseCases.length} forceOpen={activeTab === "tramites" ? true : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {licenseCases.map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {maternityCases.length + lactationCases.length > 0 && showTabSection("tramites") ? (
        <Section title="Maternidad y lactancia" count={maternityCases.length + lactationCases.length} forceOpen={activeTab === "tramites" ? true : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...maternityCases, ...lactationCases].map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {passageCases.length > 0 && showTabSection("tramites") ? (
        <Section title="Pasajes" count={passageCases.length} forceOpen={activeTab === "tramites" ? true : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {passageCases.map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {lockers.length + waitlist.length > 0 && showTabSection("lockers") ? (
        <Section title="Lockers" count={lockers.length + waitlist.length} forceOpen={activeTab === "lockers" ? true : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {lockers.map((locker) => (
              <div
                key={locker.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem 0.875rem",
                  fontSize: "0.8125rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9375rem" }}>Locker {locker.locker_number}</strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "0.125rem 0.5rem",
                        background: locker.status === "active" ? "#ecf8f2" : "var(--accent)",
                        color: locker.status === "active" ? "#126447" : "var(--muted)",
                      }}
                    >
                      {LOCKER_ASSIGNMENT_STATUS_LABEL[locker.status] ?? locker.status}
                    </span>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem", overflowWrap: "anywhere" }}>
                    {locker.section ? `Sección ${locker.section} · ` : ""}
                    {locker.location ? `${locker.location} · ` : ""}
                    Asignado {formatDate(locker.assigned_at)}
                    {locker.released_at ? ` · Liberado ${formatDate(locker.released_at)}` : ""}
                  </div>
                </div>

                <Link
                  href={`/representacion/lockers?locker=${encodeURIComponent(locker.locker_id || locker.id)}&q=${encodeURIComponent(locker.locker_number)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--accent)",
                    color: "var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    minHeight: 36,
                  }}
                >
                  🗺 Ver en mapa
                </Link>
              </div>
            ))}
            {waitlist.map((entry) => (
              <div key={entry.id} style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "0.625rem 0.75rem", fontSize: "0.8125rem" }}>
                <strong>Lista de espera</strong>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                  Solicitado {formatDate(entry.requested_at)} · {entry.status}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {parking.length > 0 && showTabSection("parking") ? (
        <Section title="Estacionamiento (CAV HGR 1)" count={parking.length} forceOpen={activeTab === "parking" ? true : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {parking.map((veh) => {
              const isActive = veh.status === "A" && veh.internal_status === "activo";
              const isBaja = veh.internal_status === "baja";
              const lotLabel =
                veh.parking_lot === "2"
                  ? "CONFIANZA"
                  : veh.parking_lot === "3"
                    ? "VISITANTES"
                    : "BASE";
              return (
                <div
                  key={veh.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem 0.875rem",
                    fontSize: "0.8125rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
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
                          letterSpacing: "0.04em",
                        }}
                      >
                        {veh.placas || "SIN PLACA"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: "0.125rem 0.5rem",
                          background: isActive ? "#ecf8f2" : isBaja ? "#fef2f2" : "#fffbeb",
                          color: isActive ? "#126447" : isBaja ? "#b91c1c" : "#b45309",
                        }}
                      >
                        {isActive ? "ACTIVO" : isBaja ? "BAJA" : "SUSPENDIDO"}
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem", overflowWrap: "anywhere" }}>
                      {veh.vehicle_model_label ? `${veh.vehicle_model_label} · ` : ""}
                      Cajón <strong>{veh.cajon_number || "0"}</strong> · {lotLabel} · Registro #{veh.external_id_reg}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                    <a
                      href={`/api/union/parking/${encodeURIComponent(veh.id)}/qr`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.25rem",
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-fg)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        minHeight: 36,
                      }}
                    >
                      📄 Tarjetón QR
                    </a>
                    <Link
                      href={`/representacion/estacionamiento?q=${encodeURIComponent(worker.employee_number)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.25rem",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--accent)",
                        color: "var(--fg)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        minHeight: 36,
                      }}
                    >
                      🚗 Administrar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {documents.length > 0 && showTabSection("documentos") ? (
        <Section title="Documentos" count={documents.length} forceOpen={activeTab === "documentos" ? true : undefined}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {documents.map((document) => (
              <li key={document.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                <strong style={{ overflowWrap: "anywhere" }}>{document.file_name ?? document.document_type}</strong>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                  {document.folio} · {document.document_type} · {formatDate(document.created_at)}
                  {document.template_version ? ` · Plantilla ${document.template_version}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {events.length + audit.length > 0 && showTabSection("historial") ? (
        <Section title="Historial" count={events.length + audit.length} forceOpen={activeTab === "historial" ? true : undefined}>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {events.map((event) => (
              <li key={event.id} style={{ borderLeft: "2px solid var(--border)", paddingLeft: "0.625rem", fontSize: "0.8125rem" }}>
                <div style={{ fontWeight: 600 }}>{event.title}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {event.folio} · {formatDateTime(event.created_at)}
                </div>
                {event.detail ? <div style={{ color: "var(--muted)", fontSize: "0.75rem", overflowWrap: "anywhere" }}>{event.detail}</div> : null}
              </li>
            ))}
            {audit.map((entry) => (
              <li key={entry.id} style={{ borderLeft: "2px solid var(--border)", paddingLeft: "0.625rem", fontSize: "0.8125rem" }}>
                <div style={{ fontWeight: 600 }}>{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Registro · {formatDateTime(entry.created_at)}</div>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {cases.length === 0 && lockers.length === 0 && parking.length === 0 && waitlist.length === 0 && documents.length === 0 && events.length === 0 && audit.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
          Este trabajador aún no tiene trámites, documentos ni historial registrados.
        </p>
      ) : null}
    </div>
  );
}
