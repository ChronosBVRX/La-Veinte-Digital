"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import type { ImportSummary } from "../../services/worker-importer/types";

export interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  summary: ImportSummary;
  domain?: "WORKER" | "LOCKER";
}

export function ImportConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  summary,
  domain = "WORKER",
}: ImportConfirmationModalProps): React.JSX.Element | null {
  const [doubleConfirmed, setDoubleConfirmed] = useState(false);

  if (!isOpen) return null;

  const isLocker = domain === "LOCKER";
  const newWorkers = summary.newWorkers ?? summary.newCount ?? 0;
  const updatedWorkers = summary.updatedWorkers ?? summary.updatedCount ?? 0;
  const unchangedWorkers = summary.unchangedWorkers ?? summary.unchangedCount ?? 0;
  const newLockers = summary.newCount ?? summary.newLockers ?? 0;
  const lockerChanges = summary.lockerChanges ?? summary.updatedCount ?? 0;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "0.5rem",
          maxWidth: "500px",
          width: "100%",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 id="modal-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
            {isLocker
              ? "Importar base de lockers"
              : "Confirmar actualización de base de trabajadores"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
          {isLocker
            ? "Por favor revisa el balance antes de guardar tu base:"
            : "Por favor revisa el balance de operaciones antes de escribir los cambios en el padrón laboral:"}
        </p>

        <div
          style={{
            backgroundColor: "var(--accent)",
            padding: "0.875rem",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <strong style={{ fontSize: "0.875rem" }}>Se guardarán:</strong>
          {isLocker ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Lockers físicos a inventariar:</span>
                <strong style={{ color: "#0891b2" }}>
                  {(summary.uniquePhysicalLockers ?? summary.lockersDetected ?? summary.totalRows).toLocaleString("es-MX")}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Asignaciones directas a aplicar:</span>
                <strong style={{ color: "#16a34a" }}>
                  {(summary.safeAssignmentsCount ?? (newLockers + lockerChanges)).toLocaleString("es-MX")}
                </strong>
              </div>
              {(summary.newWorkersFromExcel ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Trabajadores nuevos a registrar (origen Excel):</span>
                  <strong style={{ color: "var(--primary)" }}>
                    {(summary.newWorkersFromExcel ?? 0).toLocaleString("es-MX")}
                  </strong>
                </div>
              )}
              {(summary.workersMatchedInRoster ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Trabajadores en padrón (datos SIAP protegidos):</span>
                  <strong style={{ color: "var(--muted)" }}>
                    {(summary.workersMatchedInRoster ?? 0).toLocaleString("es-MX")}
                  </strong>
                </div>
              )}
              {(summary.historicalSupersededCount ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Antecedentes históricos resueltos:</span>
                  <strong style={{ color: "#64748b" }}>
                    {(summary.historicalSupersededCount ?? 0).toLocaleString("es-MX")}
                  </strong>
                </div>
              )}
              {(summary.lockersWithoutWorkerCount ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Casilleros sin trabajador:</span>
                  <strong style={{ color: "#64748b" }}>
                    {(summary.lockersWithoutWorkerCount ?? 0).toLocaleString("es-MX")}
                  </strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: "0.375rem" }}>
                <span>Casos ambiguos para revisión:</span>
                <strong style={{ color: "#c2410c" }}>
                  {(summary.realConflictsCount ?? summary.conflicts ?? 0).toLocaleString("es-MX")}
                </strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                Los trabajadores nuevos se registrarán con origen &apos;locker_excel&apos; sin sobreescribir datos si ya existían en SIAP. Los casos ambiguos se guardarán en la bandeja de pendientes.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Trabajadores nuevos:</span>
                <strong style={{ color: "#16a34a" }}>{newWorkers}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Trabajadores actualizados:</span>
                <strong style={{ color: "var(--primary)" }}>{updatedWorkers}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Trabajadores sin cambios:</span>
                <strong style={{ color: "var(--muted)" }}>{unchangedWorkers}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Modificaciones en casilleros:</span>
                <strong style={{ color: "#15803d" }}>0 (operación aislada)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Eliminaciones físicas:</span>
                <strong style={{ color: "#15803d" }}>0 eliminaciones</strong>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.25rem 0" }}>
          <input
            id="confirm-checkbox"
            type="checkbox"
            checked={doubleConfirmed}
            onChange={(e) => setDoubleConfirmed(e.target.checked)}
            disabled={isLoading}
            style={{ marginTop: "0.2rem", cursor: "pointer" }}
          />
          <label htmlFor="confirm-checkbox" style={{ fontSize: "0.8125rem", cursor: "pointer", color: "var(--fg)" }}>
            {isLocker
              ? "Autorizo guardar la base de casilleros y conservar los pendientes para su revisión posterior."
              : "Confirmo que he revisado las diferencias y autorizo la actualización del padrón de trabajadores."}
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.25rem" }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={isLoading}
            disabled={!doubleConfirmed || isLoading}
          >
            {isLocker ? "Importar y continuar" : "Confirmar actualización"}
          </Button>
        </div>
      </div>
    </div>
  );
}
