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
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const panelId = useId();

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--card)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
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
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease", color: "var(--muted)" }}
          />
        </span>
      </button>
      {open ? (
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
  const { worker, cases, lockers, waitlist, audit } = expediente;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--primary)",
          borderRadius: "var(--radius-lg)",
          background: "var(--card)",
          padding: "0.875rem",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(1.125rem, 4.5vw, 1.375rem)", fontWeight: 800, overflowWrap: "anywhere" }}>
            {getWorkerDisplayName(worker)}
          </h2>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              borderRadius: 999,
              padding: "0.125rem 0.5rem",
              background: worker.active ? "#ecf8f2" : "var(--accent)",
              color: worker.active ? "#126447" : "var(--muted)",
            }}
          >
            {worker.active ? "ACTIVO" : "INACTIVO"}
          </span>
        </div>
        <dl style={{ margin: "0.625rem 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem 0.875rem" }}>
          <div>
            <dt style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>Matrícula</dt>
            <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem", fontWeight: 600 }}>{worker.employee_number}</dd>
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

      <Section title="Resumen" defaultOpen>
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

      {hasLaborData ? (
        <Section title="Datos laborales">
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

      {licenseCases.length > 0 ? (
        <Section title="Licencias" count={licenseCases.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {licenseCases.map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {maternityCases.length + lactationCases.length > 0 ? (
        <Section title="Maternidad y lactancia" count={maternityCases.length + lactationCases.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...maternityCases, ...lactationCases].map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {passageCases.length > 0 ? (
        <Section title="Pasajes" count={passageCases.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {passageCases.map((item) => (
              <CaseCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {lockers.length + waitlist.length > 0 ? (
        <Section title="Lockers" count={lockers.length + waitlist.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {lockers.map((locker) => (
              <div
                key={locker.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.625rem 0.75rem",
                  fontSize: "0.8125rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>Locker {locker.locker_number}</strong>
                  {locker.section ? ` · Sección ${locker.section}` : ""}
                  {locker.location ? ` · ${locker.location}` : ""}
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                    {LOCKER_ASSIGNMENT_STATUS_LABEL[locker.status] ?? locker.status} · Asignado {formatDate(locker.assigned_at)}
                    {locker.released_at ? ` · Liberado ${formatDate(locker.released_at)}` : ""}
                  </div>
                </div>

                <Link
                  href={`/representacion/lockers?locker=${locker.locker_id || locker.id}&q=${locker.locker_number}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--accent)",
                    color: "var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  🗺 Ver en mapa
                </Link>
              </div>
            ))}
            {waitlist.map((entry) => (
              <div key={entry.id} style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                <strong>Lista de espera</strong>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                  Solicitado {formatDate(entry.requested_at)} · {entry.status}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {documents.length > 0 ? (
        <Section title="Documentos" count={documents.length}>
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

      {events.length + audit.length > 0 ? (
        <Section title="Historial" count={events.length + audit.length}>
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

      {cases.length === 0 && lockers.length === 0 && waitlist.length === 0 && documents.length === 0 && events.length === 0 && audit.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
          Este trabajador aún no tiene trámites, documentos ni historial registrados.
        </p>
      ) : null}
    </div>
  );
}
