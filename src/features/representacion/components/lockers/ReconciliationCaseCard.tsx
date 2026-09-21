"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import type {
  ReconciliationCase,
  ReconciliationCandidate,
} from "../../services/worker-importer/reconciliation-types";

interface Props {
  caseData: ReconciliationCase;
  onSelectOption: (caseData: ReconciliationCase, candidate: ReconciliationCandidate) => void;
  onManualSearchWorker: (caseData: ReconciliationCase) => void;
  onIgnoreCase: (caseData: ReconciliationCase) => void;
  isSubmitting: boolean;
}

export function ReconciliationCaseCard({
  caseData,
  onSelectOption,
  onManualSearchWorker,
  onIgnoreCase,
  isSubmitting,
}: Props): React.JSX.Element {
  // Inicializar selección con el recomendado, o el primero, o el que coincide actualmente
  const initialCandidateId =
    caseData.recommendation?.recommendedCandidateId ||
    caseData.candidates.find((c) => c.isRecommended)?.candidateId ||
    caseData.candidates.find((c) => c.isCurrentAssignment)?.candidateId ||
    caseData.candidates[0]?.candidateId ||
    "";

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(initialCandidateId);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const isWorkerMultipleLockers = caseData.type === "WORKER_MULTIPLE_LOCKERS";
  const isLockerMultipleWorkers = caseData.type === "LOCKER_MULTIPLE_WORKERS";
  const isWorkerNotFound = caseData.type === "WORKER_NOT_FOUND";

  const selectedCandidate =
    caseData.candidates.find((c) => c.candidateId === selectedCandidateId) ||
    caseData.candidates[0] ||
    null;

  const typeBadgeLabel = isWorkerMultipleLockers
    ? "Persona con más de un casillero"
    : isLockerMultipleWorkers
    ? "Casillero con más de una persona"
    : isWorkerNotFound
    ? "Persona no encontrada en el padrón"
    : "Pendiente de revisión";

  const typeBadgeColors = isWorkerMultipleLockers
    ? { bg: "#f3e8ff", fg: "#6b21a8" }
    : isLockerMultipleWorkers
    ? { bg: "#e0f2fe", fg: "#0369a1" }
    : isWorkerNotFound
    ? { bg: "#ffedd5", fg: "#9a3412" }
    : { bg: "#f1f5f9", fg: "#475569" };

  return (
    <Card padding="1.25rem">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Encabezado de la Tarjeta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.5rem",
                  borderRadius: "999px",
                  backgroundColor: typeBadgeColors.bg,
                  color: typeBadgeColors.fg,
                  textTransform: "uppercase",
                  letterSpacing: "0.025em",
                }}
              >
                {typeBadgeLabel}
              </span>
              {caseData.reviewItemIds.length > 1 ? (
                <span style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>
                  ({caseData.reviewItemIds.length} filas agrupadas)
                </span>
              ) : null}
            </div>
            <h4 style={{ margin: "0.35rem 0 0", fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)" }}>
              {caseData.title}
            </h4>
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.15rem" }}>
              {caseData.subtitle}
              {caseData.worker?.category ? ` · ${caseData.worker.category}` : ""}
              {caseData.worker?.turn ? ` · Turno: ${caseData.worker.turn}` : ""}
              {caseData.worker?.assignment || caseData.worker?.adscripcion
                ? ` · Adscripción: ${caseData.worker.assignment || caseData.worker.adscripcion}`
                : ""}
            </div>
          </div>

          {caseData.locker?.lockerNumber ? (
            <Link
              href={`/representacion/lockers?view=table&q=${encodeURIComponent(caseData.locker.lockerNumber)}`}
              target="_blank"
              style={{
                fontSize: "0.75rem",
                color: "var(--primary)",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              📋 Ver ficha de locker
            </Link>
          ) : null}
        </div>

        {/* Candidatos / Alternativas */}
        {caseData.candidates.length > 0 ? (
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem", letterSpacing: "0.05em" }}>
              {isWorkerMultipleLockers
                ? `El archivo relaciona a esta persona con ${caseData.candidates.length} posibles casilleros:`
                : isLockerMultipleWorkers
                ? `El archivo relaciona este casillero con ${caseData.candidates.length} personas:`
                : "Opciones disponibles:"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {caseData.candidates.map((cand) => {
                const isSelected = selectedCandidateId === cand.candidateId;

                return (
                  <label
                    key={cand.candidateId}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.375rem",
                      border: isSelected
                        ? "1.5px solid var(--primary)"
                        : "1px solid var(--border)",
                      backgroundColor: isSelected ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name={`case_${caseData.caseId}`}
                      value={cand.candidateId}
                      checked={isSelected}
                      onChange={() => setSelectedCandidateId(cand.candidateId)}
                      style={{ marginTop: "0.25rem", cursor: "pointer" }}
                    />

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.875rem", color: "var(--fg)" }}>
                          {cand.label}
                        </strong>

                        {cand.isRecommended ? (
                          <span
                            style={{
                              fontSize: "0.625rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#dbeafe",
                              color: "#1e40af",
                            }}
                          >
                            ★ RECOMENDADO
                          </span>
                        ) : null}

                        {cand.updateYear ? (
                          <span
                            style={{
                              fontSize: "0.625rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              color: "#15803d",
                            }}
                          >
                            Actualizado {cand.updateYear}
                          </span>
                        ) : null}

                        {cand.assignmentSource === "manual" ? (
                          <span
                            style={{
                              fontSize: "0.625rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#fef2f2",
                              color: "#991b1b",
                            }}
                          >
                            🛡 Manual
                          </span>
                        ) : null}

                        {isWorkerMultipleLockers && cand.candidateId ? (
                          <Link
                            href={`/representacion/lockers?view=table&q=${encodeURIComponent(cand.candidateId)}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: "0.6875rem",
                              color: "var(--primary)",
                              fontWeight: 600,
                              textDecoration: "none",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "0.25rem",
                              border: "1px solid var(--border)",
                              backgroundColor: "var(--card)",
                            }}
                          >
                            📋 Ver ficha
                          </Link>
                        ) : null}
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        {cand.sublabel ? <span>{cand.sublabel}</span> : null}
                        {cand.observations ? (
                          <span style={{ fontStyle: "italic" }}>«{cand.observations}»</span>
                        ) : null}
                      </div>

                      {/* Estado en base de datos actual */}
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: cand.hasConflict ? "#b45309" : cand.isCurrentAssignment ? "var(--primary)" : "var(--fg)",
                          fontWeight: 500,
                          marginTop: "0.1rem",
                        }}
                      >
                        Estado actual: <strong>{cand.currentStatus}</strong>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Cuadro de Sugerencia / Asesor Determinista */}
        {caseData.recommendation ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor:
                caseData.confidence === "high"
                  ? "#f0fdf4"
                  : caseData.confidence === "medium"
                  ? "#fffbeb"
                  : "var(--accent)",
              border:
                caseData.confidence === "high"
                  ? "1px solid #bbf7d0"
                  : caseData.confidence === "medium"
                  ? "1px solid #fde68a"
                  : "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontSize: "1rem" }}>💡</span>
                <strong
                  style={{
                    fontSize: "0.8125rem",
                    color:
                      caseData.confidence === "high"
                        ? "#166534"
                        : caseData.confidence === "medium"
                        ? "#92400e"
                        : "var(--fg)",
                  }}
                >
                  Sugerencia del Sistema
                </strong>
              </div>

              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "999px",
                  backgroundColor:
                    caseData.confidence === "high"
                      ? "#dcfce7"
                      : caseData.confidence === "medium"
                      ? "#fef3c7"
                      : "#e2e8f0",
                  color:
                    caseData.confidence === "high"
                      ? "#15803d"
                      : caseData.confidence === "medium"
                      ? "#b45309"
                      : "var(--muted)",
                }}
              >
                {caseData.confidence === "high"
                  ? "Confianza Alta"
                  : caseData.confidence === "medium"
                  ? "Confianza Media"
                  : "Baja / Manual"}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "0.8125rem",
                color:
                  caseData.confidence === "high"
                    ? "#166534"
                    : caseData.confidence === "medium"
                    ? "#92400e"
                    : "var(--fg)",
                lineHeight: 1.4,
              }}
            >
              {caseData.explanation}
            </p>

            {caseData.recommendation.warnings.length > 0 ? (
              <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem" }}>
                {caseData.recommendation.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--accent)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "var(--muted)",
            }}
          >
            ℹ {caseData.explanation}
          </div>
        )}

        {/* Historial Expandible */}
        {showHistory ? (
          <div
            style={{
              padding: "0.625rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--accent)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--fg)" }}>Historial de Eventos Relacionados:</div>
            {caseData.candidates.map((c, i) => (
              <div key={i} style={{ color: "var(--muted)" }}>
                • <strong>{c.label}:</strong> {c.updateYear ? `Año ${c.updateYear} en Excel · ` : ""}
                Fila {c.rowNumber ?? "N/A"} · {c.observations ? `Obs: "${c.observations}"` : "Sin obs"} · {c.currentStatus}
              </div>
            ))}
          </div>
        ) : null}

        {/* Acciones del Caso */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
              }}
            >
              {showHistory ? "Ocultar historial" : "Ver historial"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onIgnoreCase(caseData)}
              disabled={isSubmitting}
            >
              Dejar pendiente
            </Button>

            {isWorkerNotFound ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onManualSearchWorker(caseData)}
                  disabled={isSubmitting}
                >
                  Buscar en padrón
                </Button>
                {selectedCandidate ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onSelectOption(caseData, selectedCandidate)}
                    loading={isSubmitting}
                  >
                    Vincular a {selectedCandidate.label}
                  </Button>
                ) : null}
              </>
            ) : selectedCandidate ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onSelectOption(caseData, selectedCandidate)}
                loading={isSubmitting}
              >
                {selectedCandidate.isRecommended
                  ? `Usar ${selectedCandidate.label} (Recomendado)`
                  : `Usar ${selectedCandidate.label}`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
