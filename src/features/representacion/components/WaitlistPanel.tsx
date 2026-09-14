"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";

interface WaitRow {
  id: string;
  requested_at: string;
  priority_override: number | null;
  notes: string;
  union_workers: { first_name: string; paternal_surname: string; maternal_surname: string; employee_number: string; turn: string };
}

export function WaitlistPanel(): React.JSX.Element {
  const [rows, setRows] = useState<WaitRow[]>([]);
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/union/waitlist", { cache: "no-store" });
    const j = (await res.json()) as { waitlist?: WaitRow[] };
    if (res.ok) setRows(j.waitlist ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load();
  }, [load]);

  async function add(): Promise<void> {
    if (!worker) return;
    setError(null);
    const res = await fetch("/api/union/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: worker.id }),
    });
    if (!res.ok) setError("No se pudo agregar.");
    else {
      setWorker(null);
      void load();
    }
  }

  async function update(id: string, status: "assigned" | "cancelled"): Promise<void> {
    await fetch("/api/union/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    void load();
  }

  return (
    <Card>
      <h2 style={{ margin: "0 0 0.375rem", fontSize: "1rem" }}>Lista de espera</h2>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
        Orden operativo: fecha de solicitud ascendente. Sin criterio jurídico automático de prioridad (Cl. 67/68 solo como fundamento general).
      </p>
      <WorkerPicker selected={worker} onSelect={setWorker} label="Agregar trabajador a la espera" />
      <div style={{ marginTop: "0.5rem" }}>
        <Button onClick={() => void add()} disabled={!worker} fullWidth>
          Agregar a lista de espera
        </Button>
      </div>
      {error ? (
        <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
          {error}
        </p>
      ) : null}
      <ol style={{ margin: "0.625rem 0 0", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
        {rows.map((r, i) => (
          <li key={r.id}>
            <strong>
              #{i + 1} {r.union_workers.paternal_surname} {r.union_workers.first_name}
            </strong>{" "}
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              Mat. {r.union_workers.employee_number} · {new Date(r.requested_at).toLocaleDateString("es-MX")}
            </span>
            <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
              <Button size="sm" variant="secondary" onClick={() => void update(r.id, "assigned")}>
                Asignado
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void update(r.id, "cancelled")}>
                Cancelar
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
