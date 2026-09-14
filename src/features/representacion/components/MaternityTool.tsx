"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { calculateMaternity, type MaternityResult } from "../lib/maternity";

export function MaternityTool(): React.JSX.Element {
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [start, setStart] = useState("");
  const [preview, setPreview] = useState<MaternityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  function onCalculate(): void {
    setError(null);
    setSaved(null);
    try {
      if (!start) throw new Error("Captura la fecha de inicio de la incapacidad.");
      setPreview(calculateMaternity(start));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Fecha inválida.");
    }
  }

  async function onSave(): Promise<void> {
    if (!worker || !preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/union/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "maternity", worker_id: worker.id, incapacity_start: preview.incapacityStart }),
      });
      const j = (await res.json()) as { folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setSaved(`Expediente ${j.folio ?? ""} guardado. Formato listo para revisión.`);
    } catch {
      setError("No se pudo guardar el expediente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <WorkerPicker selected={worker} onSelect={setWorker} label="Trabajadora" />
      <Card>
        <Input label="Fecha de inicio de la incapacidad" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <div style={{ marginTop: "0.625rem" }}>
          <Button onClick={onCalculate} fullWidth>
            Calcular
          </Button>
        </div>
        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {error}
          </p>
        ) : null}
      </Card>
      {preview ? (
        <Card>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Resultado</h2>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem 0.75rem", fontSize: "0.875rem" }}>
            <dt style={{ color: "var(--muted)" }}>Inicio</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{preview.incapacityStart}</dd>
            <dt style={{ color: "var(--muted)" }}>Último día</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{preview.incapacityEnd} (90 días)</dd>
            <dt style={{ color: "var(--muted)" }}>Reanudación</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{preview.returnToWork}</dd>
            <dt style={{ color: "var(--muted)" }}>Lactancia</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>
              {preview.lactationStart} → {preview.lactationEnd} (365 días)
            </dd>
          </dl>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Fundamento: CCT IMSS-SNTSS 2025-2027, Cláusula 77.</p>
          <p style={{ fontSize: "0.8125rem", background: "var(--accent)", borderRadius: "var(--radius)", padding: "0.5rem 0.625rem" }}>
            Cálculo administrativo orientativo basado en fecha de incapacidad registrada. No es una incapacidad médica emitida por el sistema.
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
