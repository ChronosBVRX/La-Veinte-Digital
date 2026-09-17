"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import type { ImportSummary } from "../../services/worker-importer/types";

interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  summary: ImportSummary;
}

export function ImportConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  summary,
}: ImportConfirmationModalProps): React.JSX.Element | null {
  const [doubleConfirmed, setDoubleConfirmed] = useState(false);

  if (!isOpen) return null;

  const newWorkers = summary.newWorkers ?? summary.newCount ?? 0;
  const updatedWorkers = summary.updatedWorkers ?? summary.updatedCount ?? 0;
  const newLockers = summary.newLockers ?? 0;
  const lockerChanges = summary.lockerChanges ?? 0;
  const conflictsOmitted = summary.conflicts ?? summary.conflictsCount ?? 0;

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
            Confirmar actualización de base sindical
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
          Por favor revisa el balance de operaciones antes de escribir los cambios en la base de datos oficial:
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
          <strong style={{ fontSize: "0.875rem" }}>Se realizarán:</strong>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Trabajadores nuevos:</span>
            <strong style={{ color: "#16a34a" }}>{newWorkers}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Trabajadores actualizados:</span>
            <strong style={{ color: "var(--primary)" }}>{updatedWorkers}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nuevas asignaciones de locker:</span>
            <strong style={{ color: "#0891b2" }}>{newLockers}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Cambios de locker:</span>
            <strong style={{ color: "#2563eb" }}>{lockerChanges}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Eliminaciones físicas:</span>
            <strong style={{ color: "#15803d" }}>0 eliminaciones</strong>
          </div>
          {conflictsOmitted > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: "0.375rem" }}>
              <span style={{ color: "var(--muted)" }}>Conflictos omitidos:</span>
              <strong style={{ color: "#b91c1c" }}>{conflictsOmitted}</strong>
            </div>
          ) : null}
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
            Confirmo que he revisado las diferencias y autorizo la actualización atómica del padrón y casilleros.
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
            Confirmar actualización
          </Button>
        </div>
      </div>
    </div>
  );
}
