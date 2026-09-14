"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { calculateLactation, getLactationModalities, LACTATION_AGREEMENT_NOTICE, type LactationWorkdayType } from "../lib/lactation";

export function LactationTool(): React.JSX.Element {
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [date, setDate] = useState("");
  const [workday, setWorkday] = useState<LactationWorkdayType>("8h");
  const [modality, setModality] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const result = (() => {
    try {
      return date ? calculateLactation(date, today) : null;
    } catch {
      return null;
    }
  })();
  const modalities = getLactationModalities(workday);

  async function onSave(): Promise<void> {
    if (!worker || !date) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/union/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "lactation", worker_id: worker.id, return_to_work: date, workday_type: workday, selected_modality: modality }),
      });
      const j = (await res.json()) as { folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setSaved(`Expediente ${j.folio ?? ""} guardado.`);
    } catch {
      setError("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <WorkerPicker selected={worker} onSelect={setWorker} label="Trabajadora" />
      <Card>
        <Input label="Fecha de reanudación de labores" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label htmlFor="lact-workday" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, margin: "0.625rem 0 0.375rem" }}>
          Jornada
        </label>
        <select
          id="lact-workday"
          value={workday}
          onChange={(e) => setWorkday(e.target.value as LactationWorkdayType)}
          style={{ width: "100%", minHeight: 44, borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "0.5rem" }}
        >
          <option value="8h">Jornada de 8 horas</option>
          <option value="lte6_5h">Jornada de 6.5 horas o menos</option>
          <option value="accumulated">Jornada acumulada (diurna/nocturna)</option>
        </select>
        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {error}
          </p>
        ) : null}
      </Card>
      {result ? (
        <Card>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Periodo contractual: 365 días</h2>
          <p style={{ margin: "0 0 0.375rem", fontSize: "0.875rem" }}>
            <strong>
              {result.periodStart} → {result.periodEnd}
            </strong>
          </p>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem" }}>
            Día actual {result.dayNumber || "—"} de 365 · Transcurridos {result.elapsedDays} · Restantes {result.remainingDays}
          </p>
          <ul style={{ margin: "0 0 0.5rem", paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            {result.monthlyBreakdown.map((m) => (
              <li key={`${m.year}-${m.month}`}>
                {m.label} {m.year}: {m.days} días
              </li>
            ))}
          </ul>
          <h3 style={{ margin: "0.5rem 0", fontSize: "0.9375rem" }}>Modalidad por jornada</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {modalities.map((o) => (
              <label key={o.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.875rem" }}>
                <input type="radio" name="lact-mod" value={o.id} checked={modality === o.id} onChange={() => setModality(o.id)} />
                <span>
                  <strong>{o.title}.</strong> {o.detail}
                </span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {LACTATION_AGREEMENT_NOTICE} Fundamento: CCT 2025-2027, Cl. 77. El plazo es calendario (365 días), no solo días laborables.
          </p>
          <Button onClick={() => void onSave()} disabled={!worker} loading={saving} fullWidth>
            {worker ? "Guardar expediente" : "Selecciona trabajadora para guardar"}
          </Button>
          {saved ? (
            <p role="status" style={{ color: "var(--success)", fontSize: "0.875rem" }}>
              {saved}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
