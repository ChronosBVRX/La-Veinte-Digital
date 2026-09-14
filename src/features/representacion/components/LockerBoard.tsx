"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";

interface LockerRow {
  id: string;
  locker_number: string;
  location: string;
  section: string;
  status: string;
  active_assignment: {
    id: string;
    assigned_at: string;
    union_workers: { first_name: string; paternal_surname: string; maternal_surname: string; employee_number: string } | Array<{ first_name: string; paternal_surname: string; maternal_surname: string; employee_number: string }>;
  } | null;
}

const FILTERS = ["all", "available", "assigned", "reserved", "maintenance", "blocked"] as const;

export function LockerBoard(): React.JSX.Element {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LockerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [selectedLocker, setSelectedLocker] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/union/lockers?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as { lockers?: LockerRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error");
      setRows(j.lockers ?? []);
    } catch {
      setError("No se pudo cargar lockers.");
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load();
  }, [load]);

  async function assign(): Promise<void> {
    if (!selectedLocker || !worker) return;
    setError(null);
    const res = await fetch("/api/union/lockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        locker_id: selectedLocker,
        worker_id: worker.id,
        admin_override: Boolean(overrideReason.trim()),
        admin_override_reason: overrideReason.trim(),
      }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(j.error ?? "No se pudo asignar.");
      return;
    }
    setWorker(null);
    setSelectedLocker("");
    setOverrideReason("");
    void load();
  }

  async function release(assignmentId: string): Promise<void> {
    const reason = window.prompt("Motivo de liberación (se conserva en historial):") ?? "";
    if (!reason.trim()) return;
    await fetch("/api/union/lockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", assignment_id: assignmentId, release_reason: reason.trim() }),
    });
    void load();
  }

  async function setStatus(lockerId: string, status: string): Promise<void> {
    await fetch("/api/union/lockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", locker_id: lockerId, status }),
    });
    void load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.5rem" }} role="group" aria-label="Filtrar por estado">
          {FILTERS.map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "primary" : "secondary"} onClick={() => setFilter(f)}>
              {f === "all" ? "Todos" : f}
            </Button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Input aria-label="Buscar por número" placeholder="Número de locker…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => void load()} loading={loading}>
            Buscar
          </Button>
        </div>
        {error ? (
          <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem" }}>
            {error}
          </p>
        ) : null}
      </Card>
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Asignar locker</h2>
        <WorkerPicker selected={worker} onSelect={setWorker} />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <Input aria-label="Locker a asignar" placeholder="ID o número (selecciona abajo)" value={selectedLocker} onChange={(e) => setSelectedLocker(e.target.value)} />
        </div>
        <Input label="Override administrativo (opcional, requiere motivo auditado)" placeholder="Motivo de doble asignación…" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
        <div style={{ marginTop: "0.5rem" }}>
          <Button onClick={() => void assign()} disabled={!worker || !selectedLocker} fullWidth>
            Asignar
          </Button>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
        {rows.map((l) => {
          const w = l.active_assignment?.union_workers;
          const person = Array.isArray(w) ? w[0] : w;
          return (
            <Card key={l.id} padding="0.625rem">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <strong>Locker {l.locker_number}</strong>
                <span style={{ fontSize: "0.6875rem", background: "var(--accent)", borderRadius: 999, padding: "0.125rem 0.5rem" }}>{l.status}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0" }}>
                {person ? `${person.paternal_surname} ${person.first_name} · Mat. ${person.employee_number}` : "Disponible"}
              </div>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                <Button size="sm" variant="secondary" onClick={() => setSelectedLocker(l.id)}>
                  Elegir
                </Button>
                {l.active_assignment ? (
                  <Button size="sm" variant="secondary" onClick={() => void release(l.active_assignment?.id ?? "")}>
                    Liberar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void setStatus(l.id, l.status === "maintenance" ? "available" : "maintenance")}>
                    {l.status === "maintenance" ? "Reactivar" : "Mantenimiento"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
