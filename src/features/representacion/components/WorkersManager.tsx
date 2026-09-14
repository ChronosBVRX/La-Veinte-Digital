"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";

interface WorkerRow {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  category: string;
  assignment: string;
  turn: string;
}

const TURNS = ["MATUTINO", "VESPERTINO", "NOCTURNO", "JORNADA ACUMULADA", "MIXTO"];

export function WorkersManager(): React.JSX.Element {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_number: "",
    first_name: "",
    paternal_surname: "",
    maternal_surname: "",
    category: "",
    assignment: "HGR No. 1",
    turn: "VESPERTINO",
    schedule: "",
    rest_days: "",
    phone: "",
  });

  async function search(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/union/workers?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = (await res.json()) as { workers?: WorkerRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setRows(j.workers ?? []);
    } catch {
      setError("No se pudo buscar.");
    } finally {
      setLoading(false);
    }
  }

  async function create(): Promise<void> {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/union/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const j = (await res.json()) as { error?: string; issues?: unknown };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setOk("Trabajador registrado. Ya puede usarse en todos los trámites.");
      setForm({ employee_number: "", first_name: "", paternal_surname: "", maternal_surname: "", category: "", assignment: "HGR No. 1", turn: "VESPERTINO", schedule: "", rest_days: "", phone: "" });
      void search();
    } catch {
      setError("No se pudo registrar. Revisa matrícula, nombre, categoría, adscripción y turno.");
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string): void {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Buscar</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Input aria-label="Buscar por matrícula o nombre" placeholder="Matrícula o apellido…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => void search()} loading={loading}>
            Buscar
          </Button>
        </div>
        {rows.length > 0 ? (
          <ul style={{ listStyle: "none", margin: "0.625rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {rows.map((w) => (
              <li key={w.id} style={{ fontSize: "0.875rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.625rem" }}>
                <strong>
                  {w.paternal_surname} {w.maternal_surname} {w.first_name}
                </strong>
                <br />
                <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  Mat. {w.employee_number} · {w.category} · {w.assignment} · {w.turn}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Alta de trabajador</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
          <Input label="Matrícula" value={form.employee_number} onChange={(e) => set("employee_number", e.target.value)} />
          <Input label="Nombre(s)" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          <Input label="Apellido paterno" value={form.paternal_surname} onChange={(e) => set("paternal_surname", e.target.value)} />
          <Input label="Apellido materno" value={form.maternal_surname} onChange={(e) => set("maternal_surname", e.target.value)} />
          <Input label="Categoría" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="ENFERMERA GENERAL" />
          <Input label="Adscripción" value={form.assignment} onChange={(e) => set("assignment", e.target.value)} />
          <div>
            <label htmlFor="w-turn" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.375rem" }}>
              Turno
            </label>
            <select id="w-turn" value={form.turn} onChange={(e) => set("turn", e.target.value)} style={{ width: "100%", minHeight: 44, borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "0.5rem" }}>
              {TURNS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Input label="Horario" value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="14:00 A 21:30" />
          <Input label="Descansos" value={form.rest_days} onChange={(e) => set("rest_days", e.target.value)} />
          <Input label="Teléfono (opcional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
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
        <div style={{ marginTop: "0.625rem" }}>
          <Button onClick={() => void create()} loading={loading} fullWidth>
            Registrar trabajador
          </Button>
        </div>
      </Card>
    </div>
  );
}
