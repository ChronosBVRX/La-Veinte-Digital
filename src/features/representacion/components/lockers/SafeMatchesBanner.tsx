"use client";

import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import type { SafeMatchesSummary } from "../../services/worker-importer/reconciliation-types";

interface Props {
  summary: SafeMatchesSummary;
  onApplySafeMatches: () => void;
  isLoading: boolean;
}

export function SafeMatchesBanner({ summary, onApplySafeMatches, isLoading }: Props): React.JSX.Element | null {
  if (summary.totalFound === 0) return null;

  const safeCount = summary.safeMatches.length;

  return (
    <Card padding="1rem">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>⚡</span>
              <strong style={{ fontSize: "0.9375rem", color: "var(--fg)" }}>
                Coincidencias en el padrón: {summary.totalFound} personas encontradas
              </strong>
            </div>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              El sistema identificó personas que no existían originalmente pero que ahora ya figuran en la base sindical.
            </p>
          </div>

          {safeCount > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onApplySafeMatches}
              loading={isLoading}
            >
              Aplicar {safeCount} {safeCount === 1 ? "coincidencia segura" : "coincidencias seguras"}
            </Button>
          ) : null}
        </div>

        {/* Desglose de seguridad */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.5rem",
            fontSize: "0.75rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              padding: "0.375rem 0.5rem",
              borderRadius: "0.25rem",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
            }}
          >
            <strong>✓ {safeCount} seguras</strong>
            <div style={{ fontSize: "0.6875rem", color: "#15803d" }}>Casillero libre y trabajador disponible</div>
          </div>

          {summary.requiresLockerReview > 0 ? (
            <div
              style={{
                padding: "0.375rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
              }}
            >
              <strong>⚠ {summary.requiresLockerReview} requieren revisar</strong>
              <div style={{ fontSize: "0.6875rem" }}>Casillero ocupado por otra persona</div>
            </div>
          ) : null}

          {summary.clashesWithManual > 0 ? (
            <div
              style={{
                padding: "0.375rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
              }}
            >
              <strong>🛡 {summary.clashesWithManual} cambio manual</strong>
              <div style={{ fontSize: "0.6875rem" }}>Asignación protegida contra sobrescritura</div>
            </div>
          ) : null}

          {summary.blockedOrMaintenance > 0 ? (
            <div
              style={{
                padding: "0.375rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#475569",
              }}
            >
              <strong>🔧 {summary.blockedOrMaintenance} bloqueadas/mantenimiento</strong>
              <div style={{ fontSize: "0.6875rem" }}>Condición física especial</div>
            </div>
          ) : null}

          {summary.alreadyHasLocker > 0 ? (
            <div
              style={{
                padding: "0.375rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "#fdf4ff",
                border: "1px solid #f5d0fe",
                color: "#86198f",
              }}
            >
              <strong>👥 {summary.alreadyHasLocker} ya tiene casillero</strong>
              <div style={{ fontSize: "0.6875rem" }}>Trabajador con otro casillero activo</div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
