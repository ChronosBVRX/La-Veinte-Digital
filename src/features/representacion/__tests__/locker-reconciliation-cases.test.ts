import { describe, it, expect } from "vitest";
import { buildReconciliationCases } from "../services/locker-reconciliation-cases";
import type { LockerReviewItem } from "../services/worker-importer/types";

describe("Locker Reconciliation Cases (Agrupador y Contexto Enriquecido)", () => {
  it("TEST 1: trabajador con 3 lockers genera UN SOLO CASO con los 3 lockers visibles como candidatos", () => {
    const mockItems: LockerReviewItem[] = [
      {
        id: "item-1",
        delegation_id: "del-1",
        locker_id: "l-547",
        locker_number: "547",
        source_batch_id: "b-1",
        source_row_number: 10,
        source_employee_number: "98178375",
        source_worker_name: "Rocío Ramírez",
        source_notes: "ACTUALIZADO 2024",
        reason: "WORKER_MULTIPLE_LOCKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-2",
        delegation_id: "del-1",
        locker_id: "l-625",
        locker_number: "625",
        source_batch_id: "b-1",
        source_row_number: 20,
        source_employee_number: "98178375",
        source_worker_name: "Rocío Ramírez",
        source_notes: "ACTUALIZADO 2025",
        reason: "WORKER_MULTIPLE_LOCKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-3",
        delegation_id: "del-1",
        locker_id: "l-701",
        locker_number: "701",
        source_batch_id: "b-1",
        source_row_number: 30,
        source_employee_number: "98178375",
        source_worker_name: "Rocío Ramírez",
        source_notes: null,
        reason: "WORKER_MULTIPLE_LOCKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const result = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [
        { id: "l-547", locker_number: "547", status: "assigned", condition: "ok", zone_id: null, bank_id: null, notes: null },
        { id: "l-625", locker_number: "625", status: "available", condition: "ok", zone_id: null, bank_id: null, notes: null },
        { id: "l-701", locker_number: "701", status: "available", condition: "ok", zone_id: null, bank_id: null, notes: null },
      ],
      workers: [
        { id: "w-rocio", employee_number: "98178375", first_name: "Rocío", paternal_surname: "Ramírez", maternal_surname: "Cazarez" },
      ],
      assignments: [
        { id: "asg-547", locker_id: "l-547", worker_id: "w-rocio", status: "active", source: "import", assigned_at: "2026-09-01" },
      ],
    });

    expect(result.totalCases).toBe(1);
    expect(result.cases).toHaveLength(1);
    const c = result.cases[0];
    expect(c.type).toBe("WORKER_MULTIPLE_LOCKERS");
    expect(c.title).toBe("Ramírez Cazarez Rocío");
    expect(c.candidates).toHaveLength(3);
    expect(c.candidates.map((cand) => cand.label)).toEqual(["Casillero 547", "Casillero 625", "Casillero 701"]);
    expect(c.recommendation?.recommendedCandidateLabel).toBe("Casillero 625");
    expect(c.confidence).toBe("high");
    expect(c.reviewItemIds).toHaveLength(3);
  });

  it("TEST 2: casillero con 4 personas genera UN SOLO CASO con las 4 personas visibles", () => {
    const mockItems: LockerReviewItem[] = [
      {
        id: "item-1",
        delegation_id: "del-1",
        locker_id: "l-44",
        locker_number: "44",
        source_batch_id: "b-1",
        source_row_number: 1,
        source_employee_number: "1111",
        source_worker_name: "Persona A",
        source_notes: "2022",
        reason: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-2",
        delegation_id: "del-1",
        locker_id: "l-44",
        locker_number: "44",
        source_batch_id: "b-1",
        source_row_number: 2,
        source_employee_number: "2222",
        source_worker_name: "Persona B",
        source_notes: "2025",
        reason: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-3",
        delegation_id: "del-1",
        locker_id: "l-44",
        locker_number: "44",
        source_batch_id: "b-1",
        source_row_number: 3,
        source_employee_number: "3333",
        source_worker_name: "Persona C",
        source_notes: "2023",
        reason: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-4",
        delegation_id: "del-1",
        locker_id: "l-44",
        locker_number: "44",
        source_batch_id: "b-1",
        source_row_number: 4,
        source_employee_number: "4444",
        source_worker_name: "Persona D",
        source_notes: "2021",
        reason: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const result = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [{ id: "l-44", locker_number: "44", status: "assigned", condition: "ok", zone_id: null, bank_id: null, notes: null }],
      workers: [],
      assignments: [],
    });

    expect(result.totalCases).toBe(1);
    const c = result.cases[0];
    expect(c.type).toBe("LOCKER_MULTIPLE_WORKERS");
    expect(c.title).toBe("Casillero 44");
    expect(c.candidates).toHaveLength(4);
    expect(c.recommendation?.recommendedCandidateLabel).toBe("Persona B");
    expect(c.confidence).toBe("high");
  });

  it("TEST 3: simulación de 1,899 registros con paginación server-side -> entrega 25 casos exactos sin truncamiento", () => {
    // Simular 1,899 items distribuidos entre 500 trabajadores con lockers múltiples y 1,399 no encontrados
    const mockItems: LockerReviewItem[] = Array.from({ length: 1899 }, (_, i) => {
      if (i < 500) {
        const workerGroup = Math.floor(i / 2); // 250 casos de 2 lockers cada uno
        return {
          id: `item-${i + 1}`,
          delegation_id: "del-1",
          locker_id: `l-${i + 1}`,
          locker_number: `${i + 1}`,
          source_batch_id: "b-1",
          source_row_number: i + 1,
          source_employee_number: `emp-${workerGroup}`,
          source_worker_name: `Trabajador ${workerGroup}`,
          source_notes: null,
          reason: "WORKER_MULTIPLE_LOCKERS",
          status: "pending",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        };
      }
      return {
        id: `item-${i + 1}`,
        delegation_id: "del-1",
        locker_id: `l-${i + 1}`,
        locker_number: `${i + 1}`,
        source_batch_id: "b-1",
        source_row_number: i + 1,
        source_employee_number: `emp-nf-${i}`,
        source_worker_name: `No Encontrado ${i}`,
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      };
    });

    const result = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [],
      workers: [],
      assignments: [],
      page: 1,
      pageSize: 25,
    });

    // Total review items implicados es 1,899
    expect(result.totalReviewItems).toBe(1899);
    // Casos agrupados son 250 (de los 500 de worker) + 1399 (de worker_not_found) = 1649 casos
    expect(result.totalCases).toBe(1649);
    // La página devuelve exactamente 25 casos
    expect(result.cases).toHaveLength(25);
  });

  it("TEST 4: búsqueda por casillero, matrícula y nombre filtra correctamente", () => {
    const mockItems: LockerReviewItem[] = [
      {
        id: "item-1",
        delegation_id: "del-1",
        locker_id: "l-10",
        locker_number: "10",
        source_batch_id: "b-1",
        source_row_number: 1,
        source_employee_number: "99112233",
        source_worker_name: "ALBERTO GÓMEZ",
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-2",
        delegation_id: "del-1",
        locker_id: "l-20",
        locker_number: "20",
        source_batch_id: "b-1",
        source_row_number: 2,
        source_employee_number: "88223344",
        source_worker_name: "BEATRIZ HERNÁNDEZ",
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    // Búsqueda por número de casillero
    const resLocker = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [],
      workers: [],
      assignments: [],
      search: "10",
    });
    expect(resLocker.totalCases).toBe(1);
    expect(resLocker.cases[0].title).toBe("ALBERTO GÓMEZ");

    // Búsqueda por nombre sin acento
    const resName = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [],
      workers: [],
      assignments: [],
      search: "gomez",
    });
    expect(resName.totalCases).toBe(1);
    expect(resName.cases[0].title).toBe("ALBERTO GÓMEZ");

    // Búsqueda por matrícula
    const resEmp = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [],
      workers: [],
      assignments: [],
      search: "88223344",
    });
    expect(resEmp.totalCases).toBe(1);
    expect(resEmp.cases[0].title).toBe("BEATRIZ HERNÁNDEZ");
  });

  it("TEST 5: coincidencias seguras separan casilleros en mantenimiento y trabajadores ocupados", () => {
    const mockItems: LockerReviewItem[] = [
      {
        id: "item-safe",
        delegation_id: "del-1",
        locker_id: "l-1",
        locker_number: "1",
        source_batch_id: "b-1",
        source_row_number: 1,
        source_employee_number: "111",
        source_worker_name: "Safe Worker",
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-maint",
        delegation_id: "del-1",
        locker_id: "l-2",
        locker_number: "2",
        source_batch_id: "b-1",
        source_row_number: 2,
        source_employee_number: "222",
        source_worker_name: "Maint Worker",
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-busy",
        delegation_id: "del-1",
        locker_id: "l-3",
        locker_number: "3",
        source_batch_id: "b-1",
        source_row_number: 3,
        source_employee_number: "333",
        source_worker_name: "Busy Worker",
        source_notes: null,
        reason: "WORKER_NOT_FOUND",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const result = buildReconciliationCases({
      items: mockItems,
      sourceRows: [],
      lockers: [
        { id: "l-1", locker_number: "1", status: "available", condition: "ok", zone_id: null, bank_id: null, notes: null },
        { id: "l-2", locker_number: "2", status: "available", condition: "maintenance", zone_id: null, bank_id: null, notes: null },
        { id: "l-3", locker_number: "3", status: "available", condition: "ok", zone_id: null, bank_id: null, notes: null },
        { id: "l-other", locker_number: "99", status: "assigned", condition: "ok", zone_id: null, bank_id: null, notes: null },
      ],
      workers: [
        { id: "w-1", employee_number: "111", first_name: "Safe", paternal_surname: "Worker", maternal_surname: null },
        { id: "w-2", employee_number: "222", first_name: "Maint", paternal_surname: "Worker", maternal_surname: null },
        { id: "w-3", employee_number: "333", first_name: "Busy", paternal_surname: "Worker", maternal_surname: null },
      ],
      assignments: [
        // w-3 ya tiene asignado l-other
        { id: "asg-other", locker_id: "l-other", worker_id: "w-3", status: "active", source: "import", assigned_at: "2026-09-01" },
      ],
    });

    const summary = result.safeMatchesSummary;
    expect(summary.totalFound).toBe(3);
    expect(summary.safeMatches).toHaveLength(1);
    expect(summary.safeMatches[0].lockerNumber).toBe("1");
    expect(summary.blockedOrMaintenance).toBe(1);
    expect(summary.alreadyHasLocker).toBe(1);
  });
});
