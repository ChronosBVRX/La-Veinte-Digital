"use client";

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
  if (!isOpen) return null;

  const totalToApply = summary.newCount + summary.updatedCount + summary.unchangedCount;

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
            Confirmar importación de trabajadores
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
          Por favor revisa el balance de operaciones antes de aplicar los cambios en el padrón de la delegación:
        </p>

        <div
          style={{
            backgroundColor: "var(--accent)",
            padding: "0.875rem",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nuevos trabajadores a registrar:</span>
            <strong style={{ color: "#16a34a" }}>+{summary.newCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Trabajadores con modificaciones:</span>
            <strong style={{ color: "var(--primary)" }}>{summary.updatedCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Sin modificaciones (solo actualiza fecha):</span>
            <strong>{summary.unchangedCount}</strong>
          </div>
          {summary.conflictsCount > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9333ea" }}>
              <span>Conflictos de identidad (retenidos, no se tocan):</span>
              <strong>{summary.conflictsCount}</strong>
            </div>
          ) : null}
          {summary.missingInFileCount > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ea580c" }}>
              <span>Ausentes en archivo (se conservan en padrón):</span>
              <strong>{summary.missingInFileCount}</strong>
            </div>
          ) : null}
        </div>

        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          🛡️ Los campos manuales (teléfonos, notas, casilleros y expedientes activos) no se sobrescriben. Cada campo modificado quedará registrado en la bitácora de auditoría sindical.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} loading={isLoading}>
            Confirmar y aplicar ({totalToApply} trabajadores)
          </Button>
        </div>
      </div>
    </div>
  );
}
