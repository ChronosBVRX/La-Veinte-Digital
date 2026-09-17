"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, getWorkerDisplayName, type UnionWorkerOption } from "./WorkerPicker";
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
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const preview = (() => {
    try {
      return start && end ? calculateLicense({ withPay, startISO: start, endISO: end }) : null;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error" };
    }
  })();

  const workerDisplayName = worker ? getWorkerDisplayName(worker) : "";
  const isWorkerMissingName = worker ? !workerDisplayName || workerDisplayName === "Sin nombre" : false;
  const isWorkerMissingMatricula = worker ? !worker.employee_number?.trim() : false;

  async function save(): Promise<void> {
    setError(null);
    if (!worker) {
      setError("Selecciona al trabajador.");
      return;
    }
    if (isWorkerMissingName) {
      setError("El trabajador seleccionado no tiene nombre registrado en el sistema. Se requiere nombre para generar los documentos oficiales.");
      return;
    }
    if (isWorkerMissingMatricula) {
      setError("El trabajador seleccionado no tiene matrícula registrada.");
      return;
    }
    if (!start || !end) {
      setError("Selecciona las fechas de inicio y término.");
      return;
    }
    if (preview && "error" in preview) {
      setError(preview.error);
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
      if (!res.ok) throw new Error(j.error ?? "Error al guardar el expediente.");
      setCaseId(j.id ?? null);
      setFolio(j.folio ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Revisa fechas y motivo.");
    } finally {
      setBusy(false);
    }
  }

  async function download(kind: "excel" | "word"): Promise<void> {
    if (!caseId) return;
    setError(null);
    if (kind === "excel") setDownloadingExcel(true);
    else setDownloadingWord(true);

    try {
      const res = await fetch(`/api/union/licenses/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `No se pudo generar el documento ${kind}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "excel" ? `licencia-${folio ?? ""}.xlsm` : `oficio-licencia-${folio ?? ""}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Error al descargar ${kind}.`);
    } finally {
      if (kind === "excel") setDownloadingExcel(false);
      else setDownloadingWord(false);
    }
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
          <p style={{ fontSize: "0.875rem", margin: "0.5rem 0 0" }}>
            Total: <strong>{preview.totalDays} días</strong> · {preview.rangeLabel}
          </p>
        ) : null}
        {preview && "error" in preview ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem", margin: "0.5rem 0 0" }}>
            {preview.error}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>2. Prórroga, motivo y comprobantes</h2>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.875rem", marginBottom: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" checked={isExtension} onChange={(e) => setIsExtension(e.target.checked)} />
          ¿Es prórroga?
        </label>
        {isExtension ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Input label="Licencia anterior: inicio" type="date" value={prevStart} onChange={(e) => setPrevStart(e.target.value)} />
            <Input label="Licencia anterior: fin" type="date" value={prevEnd} onChange={(e) => setPrevEnd(e.target.value)} />
          </div>
        ) : null}
        <Input label="Motivo (indispensable, sin diagnóstico clínico)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cuidados maternos, trámite personal…" />
        <Input label="Comprobante / documentación" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="INE, receta, constancia…" />
        <Input label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {withPay ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.5rem 0 0" }}>
            Control de adeudos: Pendiente de certificación (el representante debe confirmarlo en oficina).
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>3. Revisa y genera</h2>

        {/* Resumen del documento antes de guardar */}
        {worker && (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "6px",
              backgroundColor: "var(--accent)",
              fontSize: "0.8125rem",
              marginBottom: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div>
              <strong>Trabajador:</strong> {workerDisplayName}{" "}
              <span style={{ color: "var(--muted)" }}>({worker.employee_number})</span>
            </div>
            <div>
              <strong>Categoría:</strong> {worker.category || "—"} · <strong>Turno:</strong> {worker.turn || "—"}
            </div>
            {preview && "totalDays" in preview && (
              <div>
                <strong>Licencia:</strong> {withPay ? "Con goce de sueldo" : "Sin goce de sueldo"} · {preview.totalDays} días ({start} al {end})
              </div>
            )}
            {reason && (
              <div>
                <strong>Motivo:</strong> {reason}
              </div>
            )}
            {isWorkerMissingName && (
              <p role="alert" style={{ color: "var(--error)", margin: "0.25rem 0 0", fontWeight: 600 }}>
                ⚠️ Advertencia: El trabajador no tiene nombre completo registrado. Debe asignarse nombre antes de generar los oficios.
              </p>
            )}
          </div>
        )}

        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
            {error}
          </p>
        ) : null}

        {!caseId ? (
          <Button onClick={() => void save()} loading={busy} fullWidth disabled={isWorkerMissingName || isWorkerMissingMatricula}>
            Guardar expediente
          </Button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p role="status" style={{ color: "var(--success)", fontSize: "0.875rem", margin: 0, fontWeight: 500 }}>
              Expediente {folio} guardado. Formato oficial listo para descarga y firma.
            </p>
            <Button
              onClick={() => void download("excel")}
              variant="secondary"
              loading={downloadingExcel}
              disabled={downloadingWord}
              fullWidth
            >
              Descargar Excel Oficial (1A74-009-036 .xlsm)
            </Button>
            <Button
              onClick={() => void download("word")}
              variant="secondary"
              loading={downloadingWord}
              disabled={downloadingExcel}
              fullWidth
            >
              Descargar Oficio Word (Comité XXI .docx)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
