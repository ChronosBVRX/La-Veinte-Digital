// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkerExpediente } from "@/features/representacion/components/workers/WorkerExpediente";
import type { UnionExpedienteCase, UnionWorkerExpediente } from "@/features/representacion/services/worker-directory";

function makeCase(overrides: Partial<UnionExpedienteCase> = {}): UnionExpedienteCase {
  return {
    id: "case-1",
    folio: "XXI-2026-021-000001",
    case_type: "license",
    status: "ready",
    opened_at: "2026-02-10T12:00:00.000Z",
    closed_at: null,
    maternity: null,
    lactation: null,
    passage: null,
    license: null,
    documents: [],
    events: [],
    ...overrides,
  };
}

function makeExpediente(overrides: Partial<UnionWorkerExpediente> = {}): UnionWorkerExpediente {
  return {
    worker: {
      id: "worker-1",
      employee_number: "123456",
      first_name: "Juan",
      paternal_surname: "Pérez",
      maternal_surname: "López",
      siap_full_name: "",
      category: "TÉCNICO RADIÓLOGO",
      assignment: "RAYOS X",
      turn: "VESPERTINO",
      schedule: "14:00 A 21:30",
      rest_days: "Miércoles",
      phone: null,
      notes: null,
      active: true,
      seniority_years: 8,
      seniority_fortnights: 0,
      seniority_days: 0,
      seniority_raw: "08 AÑOS",
      employment_start_date: "2018-01-15",
      contract_type_code: "base",
      plaza_code: "P-100",
      plaza_type_code: "BASE",
      department_code: "D-1",
      department_description: "Rayos X",
      position_code: "T-1",
      position_description: "Técnico Radiólogo",
      schedule_code: "V",
      schedule_description: "Vespertino",
      shift_code: "V",
      occupation_start_date: "2018-01-15",
      occupation_limit_date: null,
      source_import_state: "active",
      updated_at: "2026-02-01T00:00:00.000Z",
    },
    cases: [],
    lockers: [],
    waitlist: [],
    audit: [],
    ...overrides,
  };
}

describe("Expediente del trabajador · encabezado", () => {
  it("muestra nombre, matrícula, categoría, turno y adscripción", () => {
    render(<WorkerExpediente expediente={makeExpediente()} />);
    expect(screen.getByText("Pérez López Juan")).toBeDefined();
    expect(screen.getByText("123456")).toBeDefined();
    expect(screen.getByText("TÉCNICO RADIÓLOGO")).toBeDefined();
    expect(screen.getByText("VESPERTINO")).toBeDefined();
    expect(screen.getByText("RAYOS X")).toBeDefined();
  });

  it("nunca renderiza PII sensible aunque viaje en el payload", () => {
    const withPii = makeExpediente();
    const payload = {
      ...withPii,
      worker: {
        ...withPii.worker,
        rfc: "PEPJ800101ABC",
        curp: "PEPJ800101HDFRRN01",
        nss: "12345678901",
      },
    } as unknown as UnionWorkerExpediente;

    const { container } = render(<WorkerExpediente expediente={payload} />);
    expect(container.textContent).not.toContain("PEPJ800101ABC");
    expect(container.textContent).not.toContain("PEPJ800101HDFRRN01");
    expect(container.textContent).not.toContain("12345678901");
  });
});

describe("Expediente del trabajador · secciones progresivas", () => {
  it("muestra Resumen abierto y no monta secciones sin datos", () => {
    render(<WorkerExpediente expediente={makeExpediente()} />);
    expect(screen.getByRole("button", { name: /Resumen/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: /Licencias/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pasajes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Lockers/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Documentos/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Historial/ })).toBeNull();
    expect(screen.getByText(/aún no tiene trámites/)).toBeDefined();
  });

  it("oculta la sección de datos laborales cuando no hay datos", () => {
    const base = makeExpediente();
    const empty = {
      ...base,
      worker: {
        ...base.worker,
        contract_type_code: null,
        plaza_code: null,
        plaza_type_code: null,
        department_description: null,
        position_description: null,
        schedule_description: null,
        shift_code: null,
        occupation_start_date: null,
        occupation_limit_date: null,
        source_import_state: null,
      },
    };
    render(<WorkerExpediente expediente={empty} />);
    expect(screen.queryByRole("button", { name: /Datos laborales/ })).toBeNull();
  });

  it("muestra licencias con detalle y folio al expandir", () => {
    const expediente = makeExpediente({
      cases: [
        makeCase({
          license: {
            with_pay: true,
            license_range_type: "MENOR",
            start_date: "2026-02-12",
            end_date: "2026-02-14",
            total_days: 3,
            reason: "Asunto personal",
            proof_description: "INE",
            debt_certification_status: "certified",
          },
        }),
      ],
    });
    render(<WorkerExpediente expediente={expediente} />);

    const section = screen.getByRole("button", { name: /Licencias/ });
    expect(section.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Asunto personal")).toBeNull();

    fireEvent.click(section);
    expect(section.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("XXI-2026-021-000001")).toBeDefined();
    expect(screen.getByText("Asunto personal")).toBeDefined();
    expect(screen.getByText("Con goce")).toBeDefined();
  });

  it("agrupa maternidad y lactancia, pasajes, lockers, documentos e historial", () => {
    const expediente = makeExpediente({
      cases: [
        makeCase({
          id: "case-mat",
          folio: "XXI-2026-021-000002",
          case_type: "maternity",
          maternity: {
            incapacity_start: "2026-01-02",
            incapacity_end: "2026-04-01",
            return_to_work: "2026-04-02",
            lactation_start: "2026-04-02",
            lactation_end: "2027-04-02",
          },
        }),
        makeCase({
          id: "case-lact",
          folio: "XXI-2026-021-000003",
          case_type: "lactation",
          lactation: { return_to_work: "2026-04-02", period_start: "2026-04-02", period_end: "2027-04-02", workday_type: "8h" },
        }),
        makeCase({
          id: "case-pass",
          folio: "XXI-2026-021-000004",
          case_type: "passage_027",
          passage: { concept: "027", request_date: "2026-03-01", ooad: "MICHOACÁN", control_number: "C-9" },
        }),
      ],
      lockers: [
        {
          id: "locker-a",
          locker_number: "A-12",
          location: "Vestidores",
          section: "Enfermería",
          status: "active",
          assigned_at: "2026-01-10T00:00:00.000Z",
          released_at: null,
        },
      ],
      waitlist: [{ id: "wait-1", requested_at: "2026-01-05T00:00:00.000Z", status: "waiting", notes: null }],
      audit: [{ id: "audit-1", action: "worker.created", entity_type: "union_worker", created_at: "2026-01-01T00:00:00.000Z" }],
    });

    render(<WorkerExpediente expediente={expediente} />);
    expect(screen.getByRole("button", { name: /Maternidad y lactancia/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Pasajes/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Lockers/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Historial/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Documentos/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Lockers/ }));
    expect(screen.getByText(/A-12/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Historial/ }));
    expect(screen.getByText("Alta de trabajador")).toBeDefined();
  });

  it("documentos se muestran solo cuando existen y sin rutas de storage", () => {
    const expediente = makeExpediente({
      cases: [
        makeCase({
          documents: [
            {
              id: "doc-1",
              document_type: "oficio",
              file_name: "oficio-licencia.pdf",
              mime_type: "application/pdf",
              template_version: "v2",
              created_at: "2026-02-11T00:00:00.000Z",
            },
          ],
        }),
      ],
    });
    const { container } = render(<WorkerExpediente expediente={expediente} />);
    expect(screen.getByRole("button", { name: /Documentos/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Documentos/ }));
    expect(screen.getByText("oficio-licencia.pdf")).toBeDefined();
    expect(container.textContent).not.toContain("union-private/");
  });
});
