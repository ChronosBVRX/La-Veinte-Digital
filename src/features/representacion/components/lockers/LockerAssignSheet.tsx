"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Z_INDEX } from "@/shared/constants/z-index";
import { WorkerPicker, type UnionWorkerOption, getWorkerDisplayName } from "../WorkerPicker";
import type { LockerItem } from "./LockerDesktopTable";

export function LockerAssignSheet({
  isOpen,
  onClose,
  initialLocker,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialLocker: LockerItem | null;
  onSuccess: () => void;
}): React.JSX.Element | null {
  const [lockerNumberInput, setLockerNumberInput] = useState("");
  const [resolvedLocker, setResolvedLocker] = useState<LockerItem | null>(null);
  const [resolvingLocker, setResolvingLocker] = useState(false);
  const [lockerSearchError, setLockerSearchError] = useState<string | null>(null);

  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [workerExistingLocker, setWorkerExistingLocker] = useState<{
    hasActiveLocker: boolean;
    currentLockerNumber?: string;
  } | null>(null);
  const [checkingWorker, setCheckingWorker] = useState(false);

  const [dualAssignmentReason, setDualAssignmentReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Inicializar o resetear al abrir
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset sheet state on open
      setSubmitError(null);
      setDualAssignmentReason("");
      if (initialLocker) {
        setLockerNumberInput(initialLocker.locker_number);
        setResolvedLocker(initialLocker);
        setLockerSearchError(null);
      } else {
        setLockerNumberInput("");
        setResolvedLocker(null);
        setLockerSearchError(null);
      }
      setWorker(null);
      setWorkerExistingLocker(null);
    }
  }, [isOpen, initialLocker]);

  // Manejar tecla Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  // Verificar estado del casillero según el número tecleado
  const verifyLockerNumber = useCallback(async (num: string): Promise<void> => {
    const trimmed = num.trim();
    if (!trimmed) {
      setResolvedLocker(null);
      setLockerSearchError(null);
      return;
    }
    setResolvingLocker(true);
    setLockerSearchError(null);
    try {
      const res = await fetch(`/api/union/lockers?q=${encodeURIComponent(trimmed)}&pageSize=10`, { cache: "no-store" });
      const j = (await res.json()) as { lockers?: LockerItem[] };
      const found = (j.lockers ?? []).find(
        (l) => l.locker_number.toLowerCase() === trimmed.toLowerCase()
      );
      if (!found) {
        setResolvedLocker(null);
        setLockerSearchError(`No se encontró el casillero "${trimmed}".`);
      } else if (found.status === "maintenance" || found.status === "blocked") {
        setResolvedLocker(found);
        setLockerSearchError(`El casillero ${trimmed} se encuentra ${found.status === "maintenance" ? "en mantenimiento" : "bloqueado"}.`);
      } else if (found.active_assignment) {
        setResolvedLocker(found);
        setLockerSearchError(`El casillero ${trimmed} ya está asignado a otro trabajador.`);
      } else {
        setResolvedLocker(found);
        setLockerSearchError(null);
      }
    } catch {
      setLockerSearchError("No se pudo verificar el número de casillero.");
    } finally {
      setResolvingLocker(false);
    }
  }, []);

  // Verificar si el trabajador ya tiene un casillero activo
  useEffect(() => {
    if (!worker) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear worker state
      setWorkerExistingLocker(null);
      return;
    }
    let isCancelled = false;
    setCheckingWorker(true);
    fetch(`/api/union/lockers?check_worker_id=${worker.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((j: { hasActiveLocker?: boolean; currentLockerNumber?: string }) => {
        if (!isCancelled) {
          setWorkerExistingLocker({
            hasActiveLocker: Boolean(j.hasActiveLocker),
            currentLockerNumber: j.currentLockerNumber,
          });
        }
      })
      .catch(() => {
        // En caso de fallo de red, continuar sin bloquear
      })
      .finally(() => {
        if (!isCancelled) setCheckingWorker(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [worker]);

  async function handleSubmit(): Promise<void> {
    if (!resolvedLocker || !worker) return;
    if (workerExistingLocker?.hasActiveLocker && !dualAssignmentReason.trim()) {
      setSubmitError("Para asignar un segundo casillero se requiere indicar el motivo.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          locker_id: resolvedLocker.id,
          worker_id: worker.id,
          admin_override: Boolean(dualAssignmentReason.trim()),
          admin_override_reason: dualAssignmentReason.trim(),
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo asignar el casillero.");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Error al asignar casillero.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const isLockerAvailable = resolvedLocker && resolvedLocker.status === "available" && !resolvedLocker.active_assignment;
  const isDuplicateLocker = workerExistingLocker?.hasActiveLocker;
  const canSubmit = isLockerAvailable && worker && (!isDuplicateLocker || Boolean(dualAssignmentReason.trim()));

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.dialog,
        display: "flex",
        justifyContent: "flex-end",
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(2px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-sheet-title"
    >
      {/* Backdrop clickeable para cerrar */}
      <div style={{ position: "absolute", inset: 0 }} onClick={onClose} />

      {/* Panel lateral / Drawer */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          height: "100%",
          backgroundColor: "var(--card)",
          boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          overflowY: "auto",
        }}
      >
        {/* Header del Sheet */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 id="assign-sheet-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
              Asignar casillero
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Selecciona el casillero y el trabajador del padrón.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de asignación"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Contenido del Sheet */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
          {/* SECCIÓN 1: Selección de Locker */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem" }}>
              Casillero
            </label>
            {initialLocker ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  backgroundColor: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.9375rem" }}>
                    Locker {initialLocker.locker_number}
                  </div>
                  {initialLocker.location || initialLocker.section ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {[initialLocker.section ? `Sección ${initialLocker.section}` : "", initialLocker.location].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 700 }}>
                  ✓ Disponible
                </span>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Input
                    placeholder="Número de locker (ej. 25)…"
                    value={lockerNumberInput}
                    onChange={(e) => {
                      setLockerNumberInput(e.target.value);
                      void verifyLockerNumber(e.target.value);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void verifyLockerNumber(lockerNumberInput)}
                    loading={resolvingLocker}
                  >
                    Verificar
                  </Button>
                </div>
                {lockerSearchError ? (
                  <p role="alert" style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "#dc2626" }}>
                    {lockerSearchError}
                  </p>
                ) : isLockerAvailable ? (
                  <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "#166534", fontWeight: 600 }}>
                    ✓ Casillero {resolvedLocker.locker_number} listo para asignar.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: Selección de Trabajador */}
          <div>
            <WorkerPicker selected={worker} onSelect={setWorker} label="Trabajador asignado" />
          </div>

          {/* SECCIÓN 3: Alerta y justificación si el trabajador ya tiene casillero (Sin jerga 'override') */}
          {checkingWorker ? (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Verificando historial del trabajador…</p>
          ) : isDuplicateLocker ? (
            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fed7aa",
                borderRadius: "var(--radius)",
                padding: "0.875rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", color: "#9a3412" }}>
                <strong>Este trabajador ya tiene un casillero asignado.</strong>
                <div style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "#78350f" }}>
                  Casillero actual: <strong>Locker {workerExistingLocker?.currentLockerNumber ?? "activo"}</strong>.
                  <br />
                  ¿Deseas asignarle también el locker <strong>{resolvedLocker?.locker_number}</strong>?
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#78350f", marginBottom: "0.25rem" }}>
                  Para continuar indica el motivo de la asignación adicional:
                </label>
                <input
                  type="text"
                  placeholder="ej. Turno doble, requerimiento operativo…"
                  value={dualAssignmentReason}
                  onChange={(e) => setDualAssignmentReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #fdba74",
                    backgroundColor: "#ffffff",
                    fontSize: "0.8125rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* SECCIÓN 4: Resumen inequívoco de la operación */}
          {resolvedLocker && worker ? (
            <div
              style={{
                backgroundColor: "var(--accent)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.875rem 1rem",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--muted)", marginBottom: "0.375rem" }}>
                RESUMEN DE ASIGNACIÓN
              </div>
              <div>
                <strong>Casillero:</strong> Locker {resolvedLocker.locker_number}
              </div>
              <div>
                <strong>Trabajador:</strong> {getWorkerDisplayName(worker)}
              </div>
              <div>
                <strong>Matrícula:</strong> {worker.employee_number}
              </div>
            </div>
          ) : null}

          {/* Error de envío si ocurre */}
          {submitError ? (
            <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "#dc2626" }}>
              {submitError}
            </p>
          ) : null}
        </div>

        {/* Footer con botones de acción */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            backgroundColor: "var(--card)",
          }}
        >
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            loading={submitting}
          >
            {isDuplicateLocker ? "Asignar de todos modos" : "Asignar locker"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
