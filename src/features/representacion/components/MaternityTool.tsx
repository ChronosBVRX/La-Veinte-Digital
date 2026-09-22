"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { Calculator, FloppyDisk, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { calculateMaternity, type MaternityResult } from "../lib/maternity";
import { MaternityLactationNav } from "./maternity-lactation/MaternityLactationNav";
import { MaternityTimeline } from "./maternity-lactation/MaternityTimeline";

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
        body: JSON.stringify({
          kind: "maternity",
          worker_id: worker.id,
          incapacity_start: preview.incapacityStart,
        }),
      });
      const j = (await res.json()) as { folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setSaved(`Expediente ${j.folio ?? ""} guardado. Formato listo para revisión.`);
    } catch (e) {
      const msg = e instanceof Error && e.message !== "Error" ? e.message : "No pudimos guardar el expediente. Conservamos los datos capturados para que puedas intentarlo nuevamente.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Navegación contextual entre herramientas */}
      <MaternityLactationNav activeTab="maternidad" />

      {/* Paso 1: Selección de trabajadora */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--primary, #2563eb)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            1
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
            Seleccionar trabajadora
          </span>
        </div>
        <WorkerPicker selected={worker} onSelect={setWorker} label="Trabajadora sindicalizada" />
      </div>

      {/* Paso 2: Fecha de inicio de incapacidad */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--primary, #2563eb)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            2
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
            Fecha de expedición / inicio de incapacidad
          </span>
        </div>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Input
              label="Fecha de inicio de la incapacidad"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <div>
              <Button onClick={onCalculate} fullWidth>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                  <Calculator size={16} weight="bold" aria-hidden="true" />
                  <span>Calcular periodo de maternidad</span>
                </span>
              </Button>
            </div>
            {error && !preview ? (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--error, #dc2626)",
                  fontSize: "0.8125rem",
                  background: "rgba(220, 38, 38, 0.08)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius, 0.375rem)",
                }}
              >
                <WarningCircle size={16} weight="bold" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Paso 3: Resultado y Guardado */}
      {preview ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--primary, #2563eb)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              3
            </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
              Cronograma resultante y registro sindical
            </span>
          </div>

          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <MaternityTimeline preview={preview} workerId={worker?.id} />

              {/* Botón de guardado */}
              <div
                style={{
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <Button onClick={() => void onSave()} disabled={!worker} loading={saving} fullWidth>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                    <FloppyDisk size={16} weight="bold" aria-hidden="true" />
                    <span>{worker ? "Guardar expediente sindical" : "Selecciona trabajadora para guardar"}</span>
                  </span>
                </Button>

                {error ? (
                  <div
                    role="alert"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "var(--error, #dc2626)",
                      fontSize: "0.8125rem",
                      background: "rgba(220, 38, 38, 0.08)",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius, 0.375rem)",
                    }}
                  >
                    <WarningCircle size={16} weight="bold" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                ) : null}

                {saved ? (
                  <div
                    role="status"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "#15803d",
                      fontSize: "0.875rem",
                      background: "rgba(22, 163, 74, 0.08)",
                      border: "1px solid rgba(22, 163, 74, 0.25)",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius, 0.375rem)",
                    }}
                  >
                    <CheckCircle size={18} weight="bold" aria-hidden="true" />
                    <span>{saved}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
