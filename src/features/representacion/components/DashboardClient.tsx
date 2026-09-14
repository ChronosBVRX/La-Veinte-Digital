"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface DashboardData {
  pending: number;
  maternityActive: number;
  lactationActive: number;
  licensePending: number;
  passagePending: number;
  lockersAvailable: number;
  lockersAssigned: number;
  lockersTotal: number;
  waitlist: number;
  recent: Array<{
    id: string;
    folio: string;
    case_type: string;
    status: string;
    opened_at: string;
  }>;
}

const MODULES = [
  { href: "/representacion/trabajadores", title: "Trabajadores", desc: "Padrón, altas y búsqueda por matrícula" },
  { href: "/representacion/maternidad", title: "Maternidad", desc: "Cálculo 90 días + lactancia" },
  { href: "/representacion/lactancia", title: "Lactancia", desc: "Periodo 365 días y modalidades" },
  { href: "/representacion/lockers", title: "Lockers", desc: "Mapa, asignaciones y lista de espera" },
  { href: "/representacion/pasajes", title: "Pasajes 026/027", desc: "Preparar formatos Cl. 103" },
  { href: "/representacion/licencias", title: "Licencias", desc: "Solicitud 1A74-009-036 + oficio" },
  { href: "/representacion/expedientes", title: "Expedientes", desc: "Timeline y resoluciones externas" },
  { href: "/representacion/administracion", title: "Administración", desc: "Comité XXI, miembros y auditoría" },
];

export function DashboardClient(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/union/dashboard", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as DashboardData & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Error");
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el tablero.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <p role="alert" style={{ margin: 0 }}>{error}</p>
      </Card>
    );
  }
  if (!data) return <LoadingSpinner text="Cargando tablero…" />;

  const stats: Array<{ label: string; value: number }> = [
    { label: "Trámites pendientes", value: data.pending },
    { label: "Licencias en trámite", value: data.licensePending },
    { label: "Maternidades activas", value: data.maternityActive },
    { label: "Lactancias activas", value: data.lactationActive },
    { label: "Pasajes en trámite", value: data.passagePending },
    { label: "Lockers disponibles", value: data.lockersAvailable },
    { label: "En lista de espera", value: data.waitlist },
  ];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1rem",
        }}
      >
        {stats.map((s) => (
          <Card key={s.label} padding="0.75rem">
            <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.35 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.625rem" }}>
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            style={{
              display: "block",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "0.875rem",
              textDecoration: "none",
              color: "var(--fg)",
              minHeight: 88,
            }}
          >
            <span style={{ display: "block", fontWeight: 700, fontSize: "0.9375rem" }}>{m.title}</span>
            <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>{m.desc}</span>
          </Link>
        ))}
      </div>
      {data.recent.length > 0 ? (
        <Card>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Actividad reciente</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {data.recent.map((r) => (
              <li key={r.id} style={{ fontSize: "0.8125rem" }}>
                <Link href="/representacion/expedientes" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                  {r.folio}
                </Link>{" "}
                <span style={{ color: "var(--muted)" }}>
                  {r.case_type} · {r.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
