"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import type { LockerIntegrityReport } from "@/features/representacion/services/lockers-integrity";

interface LockerIntegrityPanelProps {
  onLocateLocker?: (lockerId: string) => void;
}

export function LockerIntegrityPanel({
  onLocateLocker,
}: LockerIntegrityPanelProps): React.JSX.Element {
  const [report, setReport] = useState<LockerIntegrityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    setLoading(true);

    fetch("/api/union/lockers/integrity", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Error al consultar integridad");
        return r.json();
      })
      .then((data: LockerIntegrityReport) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar salud de casilleros");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem 0", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
        Analizando integridad y consistencia del inventario de casilleros...
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card padding="1.5rem" style={{ color: "#dc2626", backgroundColor: "#fef2f2" }}>
        {error || "No se pudo generar el diagnóstico de casilleros."}
      </Card>
    );
  }

  const filteredIssues = report.issues.filter((issue) => {
    if (selectedSeverity === "all") return true;
    return issue.severity === selectedSeverity;
  });

  const severityConfig = {
    critical: { label: "Crítico", bg: "#fef2f2", color: "#991b1b", border: "#fecaca", dot: "#dc2626" },
    warning: { label: "Requiere Atención", bg: "#fff7ed", color: "#9a3412", border: "#fed7aa", dot: "#ea580c" },
    config: { label: "Configuración", bg: "#f0f9ff", color: "#075985", border: "#bae6fd", dot: "#0284c7" },
    info: { label: "Informativo", bg: "#f8fafc", color: "#334155", border: "#e2e8f0", dot: "#64748b" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Resumen de Salud */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Card padding="1rem">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Total Situaciones</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)", marginTop: "0.2rem" }}>
            {report.totalIssues}
          </div>
        </Card>
        <Card padding="1rem" style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
          <div style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 600 }}>Críticos</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#dc2626", marginTop: "0.2rem" }}>
            {report.criticalCount}
          </div>
        </Card>
        <Card padding="1rem" style={{ backgroundColor: "#fff7ed", borderColor: "#fed7aa" }}>
          <div style={{ fontSize: "0.75rem", color: "#9a3412", fontWeight: 600 }}>Requieren Atención</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ea580c", marginTop: "0.2rem" }}>
            {report.warningCount}
          </div>
        </Card>
        <Card padding="1rem" style={{ backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }}>
          <div style={{ fontSize: "0.75rem", color: "#075985", fontWeight: 600 }}>Falta Ubicación</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0284c7", marginTop: "0.2rem" }}>
            {report.unlocatedLockersCount}
          </div>
        </Card>
      </div>

      {/* Filtros de Severidad */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>Filtrar por:</span>
        {[
          { id: "all", label: `Todos (${report.totalIssues})` },
          { id: "critical", label: `Críticos (${report.criticalCount})` },
          { id: "warning", label: `Atención (${report.warningCount})` },
          { id: "config", label: `Configuración (${report.configCount})` },
          { id: "info", label: `Informativos (${report.infoCount})` },
        ].map((f) => {
          const isSelected = selectedSeverity === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedSeverity(f.id)}
              style={{
                fontSize: "0.75rem",
                fontWeight: isSelected ? 700 : 500,
                padding: "0.25rem 0.6rem",
                borderRadius: "9999px",
                border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: isSelected ? "#eff6ff" : "var(--card)",
                color: isSelected ? "#1e40af" : "var(--fg)",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Listado de Incidencias Explicadas */}
      {filteredIssues.length === 0 ? (
        <Card padding="2rem" style={{ textAlign: "center", color: "var(--muted)" }}>
          No hay situaciones en este filtro.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredIssues.slice(0, 50).map((issue) => {
            const conf = severityConfig[issue.severity];
            return (
              <Card
                key={issue.id}
                padding="1.25rem 1.5rem"
                style={{
                  borderLeft: `4px solid ${conf.dot}`,
                  backgroundColor: "var(--card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        backgroundColor: conf.bg,
                        color: conf.color,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        border: `1px solid ${conf.border}`,
                      }}
                    >
                      {conf.label}
                    </span>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                      {issue.title}
                    </span>
                  </div>

                  {/* Botón de acción resolutiva */}
                  {issue.actionType === "resolve_review" && (
                    <Link href={`/representacion/lockers/pendientes?q=${encodeURIComponent(issue.lockerNumber)}`} style={{ textDecoration: "none" }}>
                      <Button variant="secondary" size="sm">
                        Resolver incidencia
                      </Button>
                    </Link>
                  )}
                  {issue.actionType === "locate" && issue.lockerId && onLocateLocker && (
                    <Button variant="secondary" size="sm" onClick={() => onLocateLocker(issue.lockerId!)}>
                      Ubicar en mapa
                    </Button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                  <div style={{ backgroundColor: "var(--accent)", padding: "0.6rem 0.75rem", borderRadius: "0.375rem" }}>
                    <strong style={{ display: "block", color: "var(--muted)", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.15rem" }}>
                      Qué pasa
                    </strong>
                    <span style={{ color: "var(--fg)" }}>{issue.whatHappens}</span>
                  </div>

                  <div style={{ backgroundColor: "var(--accent)", padding: "0.6rem 0.75rem", borderRadius: "0.375rem" }}>
                    <strong style={{ display: "block", color: "var(--muted)", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.15rem" }}>
                      Por qué importa
                    </strong>
                    <span style={{ color: "var(--fg)" }}>{issue.whyItMatters}</span>
                  </div>

                  <div style={{ backgroundColor: "#eff6ff", padding: "0.6rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #bfdbfe" }}>
                    <strong style={{ display: "block", color: "#1e40af", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.15rem" }}>
                      Qué debo hacer
                    </strong>
                    <span style={{ color: "#1e3a8a", fontWeight: 600 }}>{issue.whatToDo}</span>
                  </div>
                </div>
              </Card>
            );
          })}
          {filteredIssues.length > 50 && (
            <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", padding: "1rem 0" }}>
              Mostrando las primeras 50 de {filteredIssues.length} situaciones encontradas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
