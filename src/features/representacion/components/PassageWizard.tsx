"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { validatePassage026, validatePassage027 } from "../lib/passages";

type Concept = "026" | "027";

export function PassageWizard(): React.JSX.Element {
  const [concept, setConcept] = useState<Concept>("027");
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [ooad, setOoad] = useState("MICHOACÁN");
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [control, setControl] = useState("");
  const [extramural, setExtramural] = useState("");
  const [transfer, setTransfer] = useState("");
  const [disc, setDisc] = useState<"Si" | "No" | "">("");
  const [phone, setPhone] = useState("");
  const [obs, setObs] = useState("");
  const [wAddr, setWAddr] = useState({ street: "", neighborhood: "", postalCode: "", municipality: "", state: "" });
  const [aAddr, setAAddr] = useState({ street: "", neighborhood: "", postalCode: "", municipality: "", state: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setWA(k: keyof typeof wAddr, v: string): void {
    setWAddr((s) => ({ ...s, [k]: v }));
  }
  function setAA(k: keyof typeof aAddr, v: string): void {
    setAAddr((s) => ({ ...s, [k]: v }));
  }

  async function prepare(): Promise<void> {
    setError(null);
    setOk(null);
    if (!worker) {
      setError("Selecciona al trabajador.");
      return;
    }
    if (concept === "026") {
      const missing = validatePassage026({
        ooad,
        requestDate,
        controlNumber: control,
        paternalSurname: worker.paternal_surname,
        maternalSurname: worker.maternal_surname,
        firstName: worker.first_name,
        employeeNumber: worker.employee_number,
        category: worker.category,
        assignment: worker.assignment,
        extramuralFunctions: extramural,
        transferPeriod: transfer,
      });
      if (missing.length > 0) {
        setError(`Faltan: ${missing.join(", ")}`);
        return;
      }
    } else {
      const missing = validatePassage027({
        ooad,
        requestDate,
        controlNumber: control,
        paternalSurname: worker.paternal_surname,
        maternalSurname: worker.maternal_surname,
        firstName: worker.first_name,
        employeeNumber: worker.employee_number,
        category: worker.category,
        assignment: worker.assignment,
        discontinuousSchedule: disc,
        workerAddress: wAddr,
        assignmentAddress: aAddr,
        phone,
      });
      if (missing.length > 0) {
        setError(`Faltan: ${missing.join(", ")}`);
        return;
      }
    }
    setBusy(true);
    try {
      const body =
        concept === "026"
          ? { kind: "passage_026", worker_id: worker.id, ooad, request_date: requestDate, control_number: control, extramural_functions: extramural, transfer_period: transfer, observations: obs }
          : { kind: "passage_027", worker_id: worker.id, ooad, request_date: requestDate, control_number: control, discontinuous_schedule: disc, worker_address: wAddr, assignment_address: aAddr, phone, observations: obs };
      const res = await fetch("/api/union/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { id?: string; folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setCaseId(j.id ?? null);
      setOk(`Expediente ${j.folio ?? ""} preparado. Formato listo para revisión. Pendiente de dictamen.`);
    } catch {
      setError("No se pudo preparar el trámite.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(): Promise<void> {
    if (!caseId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/union/passages/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id: caseId }) });
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pasaje-0${concept}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>¿Qué trámite deseas preparar?</h2>
        <div style={{ display: "flex", gap: "0.5rem" }} role="radiogroup" aria-label="Concepto">
          <Button variant={concept === "026" ? "primary" : "secondary"} onClick={() => setConcept("026")}>
            026 · Fija extramuros
          </Button>
          <Button variant={concept === "027" ? "primary" : "secondary"} onClick={() => setConcept("027")}>
            027 · Por pasajes
          </Button>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          {concept === "026"
            ? "026: compensación fija para categorías con funciones fuera del centro de trabajo."
            : "027: compensación por pasajes conforme a Cl. 103 y Reglamento. Incluye aviso de privacidad (2 páginas)."}
        </p>
      </Card>
      <WorkerPicker selected={worker} onSelect={setWorker} />
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
          <Input label="OOAD" value={ooad} onChange={(e) => setOoad(e.target.value)} />
          <Input label="Fecha de solicitud" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
          <Input label="Número de control (si no existe, queda pendiente)" value={control} onChange={(e) => setControl(e.target.value)} placeholder="pendiente" />
        </div>
        {concept === "026" ? (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Input label="Funciones extramuros" value={extramural} onChange={(e) => setExtramural(e.target.value)} />
            <Input label="Periodo de traslado" value={transfer} onChange={(e) => setTransfer(e.target.value)} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
            <div>
              <label htmlFor="disc" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                Horario discontinuo
              </label>
              <select id="disc" value={disc} onChange={(e) => setDisc(e.target.value as "Si" | "No" | "")} style={{ width: "100%", minHeight: 44, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <option value="">Seleccionar…</option>
                <option value="Si">Sí</option>
                <option value="No">No</option>
              </select>
            </div>
            <h3 style={{ margin: "0.25rem 0 0", fontSize: "0.9375rem" }}>Domicilio del trabajador</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
              <Input aria-label="Calle trabajador" placeholder="Calle" value={wAddr.street} onChange={(e) => setWA("street", e.target.value)} />
              <Input aria-label="Colonia trabajador" placeholder="Colonia" value={wAddr.neighborhood} onChange={(e) => setWA("neighborhood", e.target.value)} />
              <Input aria-label="CP trabajador" placeholder="C.P." value={wAddr.postalCode} onChange={(e) => setWA("postalCode", e.target.value)} />
              <Input aria-label="Municipio trabajador" placeholder="Municipio" value={wAddr.municipality} onChange={(e) => setWA("municipality", e.target.value)} />
              <Input aria-label="Estado trabajador" placeholder="Estado" value={wAddr.state} onChange={(e) => setWA("state", e.target.value)} />
            </div>
            <h3 style={{ margin: "0.25rem 0 0", fontSize: "0.9375rem" }}>Domicilio de adscripción</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
              <Input aria-label="Calle adscripción" placeholder="Calle" value={aAddr.street} onChange={(e) => setAA("street", e.target.value)} />
              <Input aria-label="Colonia adscripción" placeholder="Colonia" value={aAddr.neighborhood} onChange={(e) => setAA("neighborhood", e.target.value)} />
              <Input aria-label="CP adscripción" placeholder="C.P." value={aAddr.postalCode} onChange={(e) => setAA("postalCode", e.target.value)} />
              <Input aria-label="Municipio adscripción" placeholder="Municipio" value={aAddr.municipality} onChange={(e) => setAA("municipality", e.target.value)} />
              <Input aria-label="Estado adscripción" placeholder="Estado" value={aAddr.state} onChange={(e) => setAA("state", e.target.value)} />
            </div>
            <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
        )}
        <Input label="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} />
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
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <Button onClick={() => void prepare()} loading={busy}>
            Preparar formato
          </Button>
          {caseId ? (
            <Button variant="secondary" onClick={() => void downloadPdf()}>
              Descargar PDF
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
