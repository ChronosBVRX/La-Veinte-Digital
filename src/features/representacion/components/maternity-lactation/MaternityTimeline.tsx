"use client";

import Link from "next/link";
import {
  Baby,
  CalendarCheck,
  Briefcase,
  Drop,
  ArrowRight,
  Info,
  Clock,
} from "@phosphor-icons/react";
import type { MaternityResult } from "../../lib/maternity";
import { formatMexicanDate } from "../../lib/maternity-lactation-ui";

export interface MaternityTimelineProps {
  preview: MaternityResult;
  workerId?: string | null;
}

export function MaternityTimeline({ preview, workerId }: MaternityTimelineProps): React.JSX.Element {
  const lactationQuery = new URLSearchParams();
  lactationQuery.set("returnToWork", preview.returnToWork);
  if (workerId) {
    lactationQuery.set("workerId", workerId);
  }
  const lactationUrl = `/representacion/lactancia?${lactationQuery.toString()}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Encabezado del resultado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.0625rem",
            fontWeight: 800,
            color: "var(--fg, #0f172a)",
            letterSpacing: "-0.01em",
          }}
        >
          Línea de tiempo de maternidad
        </h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: "rgba(225, 29, 72, 0.08)",
            color: "#be123c",
            border: "1px solid rgba(225, 29, 72, 0.2)",
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
          }}
        >
          <Clock size={12} weight="bold" aria-hidden="true" />
          <span>90 días naturales (Cl. 77)</span>
        </span>
      </div>

      {/* Línea de tiempo estructurada */}
      <div
        aria-label="Cronograma de maternidad"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0",
          position: "relative",
          paddingLeft: "0.5rem",
        }}
      >
        {/* HITO 1: Inicio de incapacidad */}
        <div style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(225, 29, 72, 0.12)",
                border: "2px solid #e11d48",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#be123c",
                flexShrink: 0,
                zIndex: 2,
              }}
            >
              <Baby size={20} weight="fill" aria-hidden="true" />
            </div>
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: "44px",
                background: "linear-gradient(to bottom, #e11d48, #94a3b8)",
                margin: "4px 0",
              }}
            />
          </div>
          <div style={{ paddingBottom: "1.25rem", flex: 1 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#be123c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hito 1 · Inicio
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--fg, #0f172a)", margin: "0.125rem 0" }}>
              Inicio de incapacidad
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--primary, #2563eb)" }}>
              {formatMexicanDate(preview.incapacityStart, { format: "short" })}
              <span style={{ fontWeight: 500, color: "var(--muted, #64748b)", fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
                ({formatMexicanDate(preview.incapacityStart)})
              </span>
            </div>
          </div>
        </div>

        {/* INDICADOR DE LAPSO: 90 días naturales */}
        <div style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 38 }}>
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: "36px",
                background: "#94a3b8",
              }}
            />
          </div>
          <div
            style={{
              padding: "0.375rem 0.75rem",
              marginBottom: "1rem",
              background: "var(--accent, #f8fafc)",
              border: "1px dashed var(--border, #cbd5e1)",
              borderRadius: "var(--radius, 0.375rem)",
              fontSize: "0.75rem",
              color: "var(--muted, #64748b)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              alignSelf: "flex-start",
            }}
          >
            <Clock size={14} weight="bold" aria-hidden="true" />
            <span>Transcurso de <strong>90 días naturales</strong> con goce de salario íntegro</span>
          </div>
        </div>

        {/* HITO 2: Último día de maternidad */}
        <div style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(234, 179, 8, 0.12)",
                border: "2px solid #ca8a04",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a16207",
                flexShrink: 0,
                zIndex: 2,
              }}
            >
              <CalendarCheck size={19} weight="bold" aria-hidden="true" />
            </div>
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: "44px",
                background: "linear-gradient(to bottom, #ca8a04, #2563eb)",
                margin: "4px 0",
              }}
            />
          </div>
          <div style={{ paddingBottom: "1.25rem", flex: 1 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a16207", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hito 2 · Conclusión de descanso
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--fg, #0f172a)", margin: "0.125rem 0" }}>
              Último día de maternidad
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
              {formatMexicanDate(preview.incapacityEnd, { format: "short" })}
              <span style={{ fontWeight: 500, color: "var(--muted, #64748b)", fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
                ({formatMexicanDate(preview.incapacityEnd)})
              </span>
            </div>
          </div>
        </div>

        {/* HITO 3: Reanudación laboral */}
        <div style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(37, 99, 235, 0.12)",
                border: "2px solid #2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1d4ed8",
                flexShrink: 0,
                zIndex: 2,
              }}
            >
              <Briefcase size={19} weight="bold" aria-hidden="true" />
            </div>
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: "44px",
                background: "linear-gradient(to bottom, #2563eb, #0284c7)",
                margin: "4px 0",
              }}
            />
          </div>
          <div style={{ paddingBottom: "1.25rem", flex: 1 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hito 3 · Regreso al centro de trabajo
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--fg, #0f172a)", margin: "0.125rem 0" }}>
              Reanudación laboral
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--primary, #2563eb)" }}>
              {formatMexicanDate(preview.returnToWork, { format: "short" })}
              <span style={{ fontWeight: 500, color: "var(--muted, #64748b)", fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
                ({formatMexicanDate(preview.returnToWork)})
              </span>
            </div>
          </div>
        </div>

        {/* HITO 4: Lactancia estimada */}
        <div style={{ display: "flex", gap: "1rem", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(2, 132, 199, 0.12)",
                border: "2px solid #0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0369a1",
                flexShrink: 0,
                zIndex: 2,
              }}
            >
              <Drop size={19} weight="fill" aria-hidden="true" />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hito 4 · Inicio de lactancia
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--fg, #0f172a)", margin: "0.125rem 0" }}>
              Lactancia estimada (365 días naturales)
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg, #0f172a)" }}>
              {formatMexicanDate(preview.lactationStart, { format: "short" })}
              {" → "}
              {formatMexicanDate(preview.lactationEnd, { format: "short" })}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginTop: "0.25rem" }}>
              Inicia a partir de la reanudación efectiva de labores.
            </div>
          </div>
        </div>
      </div>

      {/* Aviso informativo estilizado */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "var(--radius, 0.5rem)",
          padding: "0.75rem 0.875rem",
          alignItems: "flex-start",
        }}
      >
        <Info size={20} weight="fill" style={{ color: "#16a34a", flexShrink: 0, marginTop: "0.125rem" }} aria-hidden="true" />
        <div style={{ fontSize: "0.8125rem", color: "#166534", lineHeight: 1.45 }}>
          <strong>Cálculo administrativo orientativo</strong> basado en la fecha de expedición de la incapacidad.
          No sustituye ni emite incapacidad médica institucional.
          <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#15803d" }}>
            Fundamento: CCT IMSS-SNTSS 2025-2027, Cláusula 77.
          </div>
        </div>
      </div>

      {/* Acción de continuidad Maternidad -> Lactancia */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          background: "rgba(2, 132, 199, 0.04)",
          border: "1px solid rgba(2, 132, 199, 0.18)",
          borderRadius: "var(--radius, 0.5rem)",
          padding: "0.875rem 1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0369a1" }}>
              ¿Deseas dar seguimiento al periodo de lactancia?
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              Transfiere automáticamente la fecha de reanudación ({formatMexicanDate(preview.returnToWork, { format: "short" })}) a la calculadora de Lactancia.
            </div>
          </div>
          <Link
            href={lactationUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              background: "#0284c7",
              color: "#ffffff",
              padding: "0.5rem 0.875rem",
              borderRadius: "var(--radius, 0.375rem)",
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: 700,
              minHeight: "44px",
              boxSizing: "border-box",
              boxShadow: "0 1px 2px rgba(2, 132, 199, 0.2)",
            }}
          >
            <span>Continuar con Lactancia</span>
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
