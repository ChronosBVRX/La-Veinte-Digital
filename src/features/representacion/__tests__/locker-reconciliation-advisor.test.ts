import { describe, it, expect } from "vitest";
import { adviseReconciliationCase } from "../services/locker-reconciliation-advisor";
import type { ReconciliationCandidate } from "../services/worker-importer/reconciliation-types";

describe("Locker Reconciliation Advisor (Motor Determinista)", () => {
  it("CASO 1: worker con 547 (2024) y 625 (2025) -> recomienda 625 con confianza ALTA por evidencia temporal", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "l-547",
        label: "Casillero 547",
        sublabel: "Fila 234",
        rowNumber: 234,
        observations: "ACTUALIZADO 2024",
        updateYear: 2024,
        currentStatus: "Asignado actualmente a esta persona",
        hasConflict: false,
        isCurrentAssignment: true,
        isRecommended: false,
        assignmentSource: "import",
      },
      {
        candidateId: "l-625",
        label: "Casillero 625",
        sublabel: "Fila 812",
        rowNumber: 812,
        observations: "ACTUALIZADO 2025",
        updateYear: 2025,
        currentStatus: "Disponible",
        hasConflict: false,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: null,
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "WORKER_MULTIPLE_LOCKERS",
      targetWorkerName: "Rocío Ramírez",
      targetEmployeeNumber: "98178375",
      workerCurrentLockerNumber: "547",
      candidates,
    });

    expect(result.confidence).toBe("high");
    expect(result.recommendation).not.toBeNull();
    expect(result.recommendation?.recommendedCandidateId).toBe("l-625");
    expect(result.recommendation?.recommendedCandidateLabel).toBe("Casillero 625");
    expect(result.explanation).toContain("625 parece ser el casillero más reciente");
    expect(result.consequences).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Se confirmará la asignación activa del Casillero 625 para Rocío Ramírez."),
        expect.stringContaining("Se liberará la asignación previa del Casillero 547 (quedará disponible)."),
        expect.stringContaining("El historial anterior se conservará"),
      ])
    );
  });

  it("CASO 2: worker con 547 (2025) y 625 (2025) -> empate de año, NO recomienda automáticamente (confianza NONE)", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "l-547",
        label: "Casillero 547",
        sublabel: "Fila 234",
        rowNumber: 234,
        observations: "ACTUALIZADO 2025",
        updateYear: 2025,
        currentStatus: "Disponible",
        hasConflict: false,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: null,
      },
      {
        candidateId: "l-625",
        label: "Casillero 625",
        sublabel: "Fila 812",
        rowNumber: 812,
        observations: "ACTUALIZADO 2025",
        updateYear: 2025,
        currentStatus: "Disponible",
        hasConflict: false,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: null,
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "WORKER_MULTIPLE_LOCKERS",
      targetWorkerName: "Juan López",
      targetEmployeeNumber: "12345678",
      candidates,
    });

    expect(result.confidence).toBe("none");
    expect(result.recommendation).toBeNull();
    expect(result.explanation).toContain("Existen múltiples casilleros");
  });

  it("CASO 3: locker 44 con A (2023) y B (2025) -> recomienda B por año más reciente", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "w-a",
        label: "María López",
        sublabel: "Matrícula 11111111 · Fila 420",
        rowNumber: 420,
        observations: "ACTUALIZADO 2023",
        updateYear: 2023,
        currentStatus: "Sin otro casillero",
        hasConflict: false,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: null,
      },
      {
        candidateId: "w-b",
        label: "Juan Pérez",
        sublabel: "Matrícula 22222222 · Fila 901",
        rowNumber: 901,
        observations: "ACTUALIZADO 2025",
        updateYear: 2025,
        currentStatus: "Asignación activa actual de este casillero",
        hasConflict: false,
        isCurrentAssignment: true,
        isRecommended: false,
        assignmentSource: "import",
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "LOCKER_MULTIPLE_WORKERS",
      targetLockerNumber: "44",
      lockerCurrentWorkerName: "Juan Pérez",
      candidates,
    });

    expect(result.confidence).toBe("high");
    expect(result.recommendation?.recommendedCandidateId).toBe("w-b");
    expect(result.recommendation?.recommendedCandidateLabel).toBe("Juan Pérez");
    expect(result.explanation).toContain("Juan Pérez parece ser la asignación vigente");
    expect(result.consequences).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Se asignará formalmente el Casillero 44 a Juan Pérez."),
        expect.stringContaining("Las demás personas en disputa quedarán sin este casillero"),
      ])
    );
  });

  it("CASO 4: candidato tiene asignación manual posterior -> advierte cambio manual", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "l-701",
        label: "Casillero 701",
        sublabel: "Fila 100",
        rowNumber: 100,
        observations: "ACTUALIZADO 2025",
        updateYear: 2025,
        currentStatus: "Asignado actualmente a Carlos Ruiz",
        hasConflict: true,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: "manual",
        hasOtherActiveWorker: true,
        otherActiveWorkerName: "Carlos Ruiz",
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "WORKER_MULTIPLE_LOCKERS",
      targetWorkerName: "Rocío",
      candidates,
    });

    expect(result.recommendation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("asignación manual posterior")])
    );
  });

  it("CASO 5: candidato ya cuenta con otro casillero activo -> genera advertencia explícita", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "w-m",
        label: "María López",
        sublabel: "Matrícula 11111111",
        rowNumber: 10,
        observations: "2024",
        updateYear: 2024,
        currentStatus: "Actualmente tiene Casillero 350",
        hasConflict: true,
        isCurrentAssignment: false,
        isRecommended: false,
        assignmentSource: null,
        hasOtherActiveLocker: true,
        otherActiveLockerNumber: "350",
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "LOCKER_MULTIPLE_WORKERS",
      targetLockerNumber: "44",
      candidates,
    });

    expect(result.recommendation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("ya cuenta con el Casillero 350")])
    );
    expect(result.consequences).toEqual(
      expect.arrayContaining([expect.stringContaining("Se liberará el Casillero 350")])
    );
  });

  it("CASO 6: worker not found con coincidencia exacta por matrícula -> recomienda vincular con confianza ALTA", () => {
    const candidates: ReconciliationCandidate[] = [
      {
        candidateId: "w-exact",
        label: "Pedro Sánchez",
        sublabel: "Matrícula 99887766 (Coincidencia exacta)",
        rowNumber: 50,
        observations: null,
        updateYear: null,
        currentStatus: "Sin casillero asignado",
        hasConflict: false,
        isCurrentAssignment: false,
        isRecommended: true,
        assignmentSource: null,
      },
    ];

    const result = adviseReconciliationCase({
      caseType: "WORKER_NOT_FOUND",
      targetEmployeeNumber: "99887766",
      targetWorkerName: "Pedro Sánchez",
      targetLockerNumber: "105",
      candidates,
    });

    expect(result.confidence).toBe("high");
    expect(result.recommendation?.recommendedCandidateId).toBe("w-exact");
    expect(result.explanation).toContain("coincidencia exacta por matrícula");
  });

  it("CASO 7: sin candidatos -> retorna recomendación nula", () => {
    const result = adviseReconciliationCase({
      caseType: "WORKER_MULTIPLE_LOCKERS",
      candidates: [],
    });

    expect(result.recommendation).toBeNull();
    expect(result.confidence).toBe("none");
  });
});
