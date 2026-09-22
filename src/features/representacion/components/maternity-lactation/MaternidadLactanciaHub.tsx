"use client";

import Link from "next/link";
import {
  Baby,
  Drop,
  ArrowRight,
  Briefcase,
  ShieldCheck,
  CheckCircle,
  Sparkle,
} from "@phosphor-icons/react";

export function MaternidadLactanciaHub(): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Secuencia visual del acompañamiento sindical */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(2, 132, 199, 0.03) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.15)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: "clamp(1rem, 3vw, 1.25rem)",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkle size={18} weight="fill" style={{ color: "var(--primary, #2563eb)" }} aria-hidden="true" />
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "var(--primary, #2563eb)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Secuencia continua de protección laboral (Cl. 77)
          </span>
        </div>

        {/* Flujo horizontal responsivo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
            alignItems: "stretch",
          }}
        >
          {/* Paso 1: Maternidad */}
          <div
            style={{
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 0.5rem)",
              padding: "0.875rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(225, 29, 72, 0.1)",
                color: "#be123c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Baby size={20} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
                1. Maternidad
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginTop: "0.125rem" }}>
                90 días naturales con goce íntegro de salario.
              </div>
            </div>
          </div>

          {/* Paso 2: Reanudación */}
          <div
            style={{
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 0.5rem)",
              padding: "0.875rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(37, 99, 235, 0.1)",
                color: "#1d4ed8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Briefcase size={20} weight="bold" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
                2. Reanudación
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginTop: "0.125rem" }}>
                Reincorporación al término de la incapacidad.
              </div>
            </div>
          </div>

          {/* Paso 3: Lactancia */}
          <div
            style={{
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 0.5rem)",
              padding: "0.875rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(2, 132, 199, 0.1)",
                color: "#0369a1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Drop size={20} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
                3. Lactancia
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginTop: "0.125rem" }}>
                365 días naturales con modalidad según jornada.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOS TARJETAS PRINCIPALES */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {/* TARJETA 1: MATERNIDAD */}
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 0.75rem)",
            padding: "clamp(1.25rem, 3vw, 1.5rem)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Acento superior sutil */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #e11d48, #f43f5e)",
            }}
          />

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "var(--radius-md, 0.5rem)",
                  background: "rgba(225, 29, 72, 0.08)",
                  border: "1px solid rgba(225, 29, 72, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#be123c",
                }}
              >
                <Baby size={28} weight="duotone" aria-hidden="true" />
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#be123c",
                    lineHeight: 1,
                  }}
                >
                  90 días
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--muted, #64748b)",
                    textTransform: "uppercase",
                    marginTop: "0.125rem",
                  }}
                >
                  Periodo de maternidad
                </span>
              </div>
            </div>

            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--fg, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              Maternidad
            </h2>

            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.875rem",
                color: "var(--muted, #64748b)",
                lineHeight: 1.5,
              }}
            >
              Registra la incapacidad, consulta el periodo de 90 días naturales y conoce automáticamente la fecha de reanudación laboral.
            </p>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                color: "var(--fg, #0f172a)",
              }}
            >
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Cálculo automático de inicio, fin y reanudación</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Vinculación con padrón de trabajadoras</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Generación de expediente sindical oficial</span>
              </li>
            </ul>
          </div>

          <Link
            href="/representacion/maternidad"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              background: "#be123c",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9375rem",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius, 0.375rem)",
              minHeight: "44px",
              boxSizing: "border-box",
              boxShadow: "0 2px 4px rgba(190, 18, 60, 0.2)",
              transition: "background 0.15s ease",
            }}
          >
            <span>Abrir Maternidad</span>
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        {/* TARJETA 2: LACTANCIA */}
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 0.75rem)",
            padding: "clamp(1.25rem, 3vw, 1.5rem)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Acento superior sutil */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #0284c7, #38bdf8)",
            }}
          />

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "var(--radius-md, 0.5rem)",
                  background: "rgba(2, 132, 199, 0.08)",
                  border: "1px solid rgba(2, 132, 199, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0369a1",
                }}
              >
                <Drop size={28} weight="duotone" aria-hidden="true" />
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#0284c7",
                    lineHeight: 1,
                  }}
                >
                  365 días
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--muted, #64748b)",
                    textTransform: "uppercase",
                    marginTop: "0.125rem",
                  }}
                >
                  Periodo contractual
                </span>
              </div>
            </div>

            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--fg, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              Lactancia
            </h2>

            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.875rem",
                color: "var(--muted, #64748b)",
                lineHeight: 1.5,
              }}
            >
              Consulta el periodo de lactancia, días transcurridos, días restantes y modalidad correspondiente a la jornada.
            </p>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                color: "var(--fg, #0f172a)",
              }}
            >
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Barra de progreso y estado humano del periodo</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Modalidades por tipo de jornada (8h, ≤6.5h, acumulada)</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={15} weight="fill" style={{ color: "#16a34a" }} aria-hidden="true" />
                <span>Desglose mensual de los 12 meses naturales</span>
              </li>
            </ul>
          </div>

          <Link
            href="/representacion/lactancia"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              background: "#0284c7",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9375rem",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius, 0.375rem)",
              minHeight: "44px",
              boxSizing: "border-box",
              boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
              transition: "background 0.15s ease",
            }}
          >
            <span>Abrir Lactancia</span>
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Pie normativo y aclaración */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          padding: "0.75rem 1rem",
          background: "var(--accent, #f8fafc)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 0.5rem)",
          fontSize: "0.75rem",
          color: "var(--muted, #64748b)",
          lineHeight: 1.4,
        }}
      >
        <ShieldCheck size={18} weight="fill" style={{ color: "var(--primary, #2563eb)", flexShrink: 0 }} aria-hidden="true" />
        <div>
          <strong>Marco normativo aplicable:</strong> Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027, Cláusula 77.
          Los cálculos realizados son administrativos y orientativos para la representación sindical. No emiten dictámenes médicos.
        </div>
      </div>
    </div>
  );
}
