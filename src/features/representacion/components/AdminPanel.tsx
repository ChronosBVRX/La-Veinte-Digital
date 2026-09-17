"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface Settings {
  delegation_id: string;
  delegation_display_name: string;
  center_name: string;
  center_address: string;
  default_recipient_name: string;
  default_recipient_role: string;
  general_secretary: string;
  interior_secretary: string;
  conflicts_secretary: string;
  admission_secretary: string;
  social_welfare_secretary: string;
  default_signer_name: string;
  default_signer_role: string;
  institutional_motto: string;
}

export function AdminPanel(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; entity_type: string; created_at: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/union/settings", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { settings?: Settings; error?: string };
        if (!r.ok) throw new Error(j.error ?? "Error");
        if (!cancelled && j.settings) setSettings(j.settings);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar configuración (se requiere union_admin).");
      });
    fetch("/api/union/audit", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { events?: Array<{ id: string; action: string; entity_type: string; created_at: string }> };
        if (r.ok && !cancelled) setAudit(j.events ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof Settings>(k: K, v: string): void {
    setSettings((s) => (s ? { ...s, [k]: v } : s));
  }

  async function save(): Promise<void> {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/union/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setOk("Configuración guardada.");
    } catch {
      setError("No se pudo guardar (se requiere rol union_admin).");
    } finally {
      setSaving(false);
    }
  }

  if (!settings && !error) return <LoadingSpinner text="Cargando administración…" />;
  if (error && !settings) {
    return (
      <Card>
        <p role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      </Card>
    );
  }
  if (!settings) return <Card>Sin datos.</Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>Actualizar base sindical</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
              Carga y concilia de forma segura el padrón de trabajadores y casilleros desde el Excel administrativo más reciente.
            </p>
          </div>
          <Link
            href="/representacion/administracion/actualizar-base"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--primary)",
              color: "var(--primary-fg, #fff)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            📊 Actualizar base sindical
          </Link>
        </div>
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Configuración de Delegación XXI</h2>
        <p style={{ margin: "0 0 0.625rem", fontSize: "0.75rem", color: "var(--muted)" }}>
          Representación Sindical · Versión beta (acceso privado por membresía).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
          <Input label="Nombre de delegación" value={settings.delegation_display_name} onChange={(e) => set("delegation_display_name", e.target.value)} />
          <Input label="Centro de trabajo" value={settings.center_name} onChange={(e) => set("center_name", e.target.value)} />
          <Input label="Dirección" value={settings.center_address} onChange={(e) => set("center_address", e.target.value)} />
          <Input label="Destinatario predeterminado" value={settings.default_recipient_name} onChange={(e) => set("default_recipient_name", e.target.value)} />
          <Input label="Cargo destinatario" value={settings.default_recipient_role} onChange={(e) => set("default_recipient_role", e.target.value)} />
          <Input label="Secretario general" value={settings.general_secretary} onChange={(e) => set("general_secretary", e.target.value)} />
          <Input label="Secretario del interior" value={settings.interior_secretary} onChange={(e) => set("interior_secretary", e.target.value)} />
          <Input label="Secretario de conflictos" value={settings.conflicts_secretary} onChange={(e) => set("conflicts_secretary", e.target.value)} />
          <Input label="Secretario de admisión" value={settings.admission_secretary} onChange={(e) => set("admission_secretary", e.target.value)} />
          <Input label="Previsión social" value={settings.social_welfare_secretary} onChange={(e) => set("social_welfare_secretary", e.target.value)} />
          <Input label="Firmante predeterminado" value={settings.default_signer_name} onChange={(e) => set("default_signer_name", e.target.value)} />
          <Input label="Cargo del firmante" value={settings.default_signer_role} onChange={(e) => set("default_signer_role", e.target.value)} />
        </div>
        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {error}
          </p>
        ) : null}
        {ok ? (
          <p role="status" style={{ color: "var(--success)", fontSize: "0.875rem" }}>
            {ok}
          </p>
        ) : null}
        <div style={{ marginTop: "0.5rem" }}>
          <Button onClick={() => void save()} loading={saving} fullWidth>
            Guardar configuración
          </Button>
        </div>
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Auditoría reciente (sanitizada)</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {audit.slice(0, 30).map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("es-MX")} · {a.entity_type} · {a.action}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
