"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { calculateLicense } from "../lib/licenses";

export function LicenseWizard(): React.JSX.Element {
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [withPay, setWithPay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isExtension, setIsExtension] = useState(false);
  const [prevStart, setPrevStart] = useState("");
  const [prevEnd, setPrevEnd] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = (() => {
    try {
      return start && end ? calculateLicense({ withPay, startISO: start, endISO: end }) : null;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error" };
    }
  })();

  async function save(): Promise<void> {
    setError(null);
    if (!worker) {
      setError("Selecciona al trabajador.");
      return;
    }
    if (!reason.trim()) {
      setError("Captura el motivo (grado indispensable).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/union/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "license",
          worker_id: worker.id,
          with_pay: withPay,
          start_date: start,
          end_date: end,
          is_extension: isExtension,
          previous_license_start: prevStart || undefined,
          previous_license_end: prevEnd || undefined,
          reason: reason.trim(),
          proof_description: proof.trim(),
          debt_control_required: withPay,
          notes: notes.trim(),
        }),
      });
      const j = (await res.json()) as { id?: string; folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setCaseId(j.id ?? null);
      setFolio(j.folio ?? null);
    } catch {
      setError("No se pudo guardar. Revisa fechas y motivo.");
    } finally {
      setBusy(false);
    }
  }

  async function download(kind: "excel" | "word"): Promise<void> {
    if (!caseId) return;
    const res = await fetch(`/api/union/licenses/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    });
    if (!res.ok) {
      setError(`No se pudo generar ${kind}.`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "excel" ? `licencia-${folio ?? ""}.xlsx` : `oficio-licencia-${folio ?? ""}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <WorkerPicker selected={worker} onSelect={setWorker} />
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>1. Tipo y periodo</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }} role="radiogroup" aria-label="Tipo de licencia">
          <Button variant={!withPay ? "primary" : "secondary"} onClick={() => setWithPay(false)}>
            Sin goce
          </Button>
          <Button variant={withPay ? "primary" : "secondary"} onClick={() => setWithPay(true)}>
            Con goce
          </Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
          <Input label="Inicio" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Término" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {preview && "totalDays" in preview ? (
          <p style={{ fontSize: "0.875rem" }}>
            Total: <strong>{preview.totalDays} días</strong> · {preview.rangeLabel}
          </p>
        ) : null}
        {preview && "error" in preview ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {preview.error}
          </p>
        ) : null}
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>2. Prórroga, motivo y comprobantes</h2>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
          <input type="checkbox" checked={isExtension} onChange={(e) => setIsExtension(e.target.checked)} />
          ¿Es prórroga?
        </label>
        {isExtension ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Input label="Licencia anterior: inicio" type="date" value={prevStart} onChange={(e) => setPrevStart(e.target.value)} />
            <Input label="Licencia anterior: fin" type="date" value={prevEnd} onChange={(e) => setPrevEnd(e.target.value)} />
          </div>
        ) : null}
        <Input label="Motivo (indispensable, sin diagnóstico clínico)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input label="Comprobante / documentación" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="INE, receta, constancia…" />
        <Input label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {withPay ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Control de adeudos: Pendiente de certificación (el representante debe confirmarlo).</p>
        ) : null}
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>3. Revisa y genera</h2>
        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {error}
          </p>
        ) : null}
        {!caseId ? (
          <Button onClick={() => void save()} loading={busy} fullWidth>
            Guardar expediente
          </Button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p role="status" style={{ color: "var(--success)", fontSize: "0.875rem", margin: 0 }}>
              Expediente {folio} guardado. Formato listo para revisión. Pendiente de firma.
            </p>
            <Button onClick={() => void download("excel")} variant="secondary" fullWidth>
              Descargar Excel (1A74-009-036)
            </Button>
            <Button onClick={() => void download("word")} variant="secondary" fullWidth>
              Descargar oficio Word (Comité XXI)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
