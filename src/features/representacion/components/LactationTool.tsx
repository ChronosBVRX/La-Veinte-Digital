"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { FloppyDisk, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import {
  calculateLactation,
  getLactationModalities,
  LACTATION_AGREEMENT_NOTICE,
  type LactationWorkdayType,
} from "../lib/lactation";
import { parseLactationQueryParams } from "../lib/maternity-lactation-ui";
import { MaternityLactationNav } from "./maternity-lactation/MaternityLactationNav";
import { LactationProgress } from "./maternity-lactation/LactationProgress";
import { LactationMonthlyBreakdown } from "./maternity-lactation/LactationMonthlyBreakdown";
import { LactationModalityCards } from "./maternity-lactation/LactationModalityCards";

export function LactationTool(): React.JSX.Element {
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [date, setDate] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const search = new URLSearchParams(window.location.search);
      const parsed = parseLactationQueryParams(search);
      return parsed.returnToWork ?? "";
    } catch {
      return "";
    }
  });
  const [workday, setWorkday] = useState<LactationWorkdayType>("8h");
  const [modality, setModality] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  // Continuidad fluida: resolver trabajadora si se proporcionó workerId en la URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const search = new URLSearchParams(window.location.search);
      const parsed = parseLactationQueryParams(search);
      if (parsed.workerId) {
        const wid = parsed.workerId;
        void fetch(`/api/union/workers?q=${encodeURIComponent(wid)}`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: { workers?: UnionWorkerOption[] } | null) => {
            const found = json?.workers?.find((w) => w.id === wid);
            if (found) {
              setWorker(found);
            }
          })
          .catch(() => {
            // Falla silenciosa: el usuario puede seleccionar manualmente
          });
      }
    } catch {
      // Ignorar errores de parseo de URL
    }
  }, []);

  const result = (() => {
    try {
      return date ? calculateLactation(date, today) : null;
    } catch {
      return null;
    }
  })();

  const modalities = getLactationModalities(workday);
  const effectiveModality = modalities.some((m) => m.id === modality)
    ? modality
    : (modalities[0]?.id ?? "");

  async function onSave(): Promise<void> {
    if (!worker || !date) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/union/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "lactation",
          worker_id: worker.id,
          return_to_work: date,
          workday_type: workday,
          selected_modality: effectiveModality,
        }),
      });
      const j = (await res.json()) as { folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setSaved(`Expediente ${j.folio ?? ""} guardado.`);
    } catch (e) {
      const msg =
        e instanceof Error && e.message !== "Error"
          ? e.message
          : "No se pudo guardar el expediente de lactancia. Conservamos tus datos capturados.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Navegación contextual entre herramientas */}
      <MaternityLactationNav activeTab="lactancia" />

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

      {/* Paso 2: Reanudación de labores y jornada */}
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
            Fecha de reanudación y tipo de jornada
          </span>
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Input
              label="Fecha de reanudación de labores"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <div>
              <label
                htmlFor="lact-workday"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.375rem",
                  color: "var(--fg, #0f172a)",
                }}
              >
                Jornada contractual
              </label>
              <select
                id="lact-workday"
                value={workday}
                onChange={(e) => setWorkday(e.target.value as LactationWorkdayType)}
                style={{
                  width: "100%",
                  minHeight: 44,
                  borderRadius: "var(--radius, 0.375rem)",
                  border: "1px solid var(--border, #e2e8f0)",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  background: "var(--card, #ffffff)",
                  color: "var(--fg, #0f172a)",
                  boxSizing: "border-box",
                }}
              >
                <option value="8h">Jornada de 8 horas</option>
                <option value="lte6_5h">Jornada de 6.5 horas o menos</option>
                <option value="accumulated">Jornada acumulada (diurna/nocturna)</option>
              </select>
            </div>

            {error && !result ? (
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

      {/* Paso 3: Periodo de lactancia, modalidades y registro */}
      {result ? (
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
              Periodo contractual, modalidades y guardado
            </span>
          </div>

          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Barra de progreso y métricas */}
              <LactationProgress result={result} />

              {/* Desglose mensual plegable/accordion */}
              <LactationMonthlyBreakdown monthlyBreakdown={result.monthlyBreakdown} />

              {/* Modalidad seleccionable por jornada */}
              <LactationModalityCards
                modalities={modalities}
                selectedModality={effectiveModality}
                onSelectModality={setModality}
              />

              {/* Fundamento normativo y aviso */}
              <div
                style={{
                  display: "flex",
                  gap: "0.625rem",
                  background: "var(--accent, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "var(--radius, 0.375rem)",
                  padding: "0.625rem 0.75rem",
                  alignItems: "flex-start",
                }}
              >
                <Info size={18} weight="fill" style={{ color: "var(--muted, #64748b)", flexShrink: 0, marginTop: "0.1rem" }} aria-hidden="true" />
                <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  {LACTATION_AGREEMENT_NOTICE} <strong>Fundamento:</strong> CCT 2025-2027, Cl. 77.
                  El plazo contractual es calendario (365 días naturales), no solo días hábiles o laborables.
                </div>
              </div>

              {/* Guardado */}
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
