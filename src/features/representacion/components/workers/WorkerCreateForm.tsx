"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input, Select } from "@/shared/components/ui/Input";

const TURNS = ["MATUTINO", "VESPERTINO", "NOCTURNO", "MÓVIL", "JORNADA ACUMULADA"];

const EMPTY_FORM = {
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
};

export function WorkerCreateForm({
  onCreated,
}: {
  onCreated: (displayName: string) => void;
}): React.JSX.Element {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function create(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/union/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error");
      const displayName = [form.paternal_surname, form.maternal_surname, form.first_name].filter(Boolean).join(" ").trim();
      setForm({ ...EMPTY_FORM });
      onCreated(displayName || form.employee_number);
    } catch {
      setError("No se pudo registrar. Revisa matrícula, nombre, categoría, adscripción y turno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
        <Input label="Matrícula" value={form.employee_number} onChange={(e) => set("employee_number", e.target.value)} required />
        <Input label="Nombre(s)" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        <Input label="Apellido paterno" value={form.paternal_surname} onChange={(e) => set("paternal_surname", e.target.value)} required />
        <Input label="Apellido materno" value={form.maternal_surname} onChange={(e) => set("maternal_surname", e.target.value)} />
        <Input label="Categoría" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="ENFERMERA GENERAL" required />
        <Input label="Adscripción" value={form.assignment} onChange={(e) => set("assignment", e.target.value)} required />
        <Select label="Turno" value={form.turn} onChange={(e) => set("turn", e.target.value)} required>
          {TURNS.map((turn) => (
            <option key={turn} value={turn}>
              {turn}
            </option>
          ))}
        </Select>
        <Input label="Horario" value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="14:00 A 21:30" />
        <Input label="Descansos" value={form.rest_days} onChange={(e) => set("rest_days", e.target.value)} />
        <Input label="Teléfono (opcional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "var(--error)", fontSize: "0.8125rem" }}>
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={loading} fullWidth>
        Registrar trabajador
      </Button>
    </form>
  );
}
