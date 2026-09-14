"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";

interface CaseRow {
  id: string;
  folio: string;
  case_type: string;
  status: string;
  opened_at: string;
  union_workers: { first_name: string; paternal_surname: string; maternal_surname: string; employee_number: string };
}

const STATUSES = ["draft", "ready", "submitted", "under_review", "approved", "rejected", "completed", "cancelled"] as const;

export function CaseBrowser(): React.JSX.Element {
  const [folio, setFolio] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (folio.trim()) p.set("folio", folio.trim());
      if (type) p.set("type", type);
      if (status) p.set("status", status);
      const res = await fetch(`/api/union/cases?${p.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as { cases?: CaseRow[] };
      if (res.ok) setRows(j.cases ?? []);
    } finally {
      setLoading(false);
    }
  }, [folio, type, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load();
  }, [load]);

  async function setCaseStatus(id: string, s: string): Promise<void> {
    const note = window.prompt("Nota de seguimiento (visible en timeline):") ?? "";
    await fetch("/api/union/cases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: id, status: s, note }),
    });
    void load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
          <Input aria-label="Filtrar por folio" placeholder="Folio…" value={folio} onChange={(e) => setFolio(e.target.value)} />
          <select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)} style={{ minHeight: 44, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <option value="">Todos los tipos</option>
            <option value="maternity">Maternidad</option>
            <option value="lactation">Lactancia</option>
            <option value="passage_026">Pasaje 026</option>
            <option value="passage_027">Pasaje 027</option>
            <option value="license">Licencia</option>
            <option value="locker">Locker</option>
          </select>
          <select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)} style={{ minHeight: 44, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </Card>
      {rows.map((c) => (
        <Card key={c.id} padding="0.75rem">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong>{c.folio}</strong>
            <span style={{ fontSize: "0.75rem", background: "var(--accent)", borderRadius: 999, padding: "0.125rem 0.5rem" }}>
              {c.case_type} · {c.status}
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0" }}>
            {c.union_workers.paternal_surname} {c.union_workers.first_name} · Mat. {c.union_workers.employee_number} ·{" "}
            {new Date(c.opened_at).toLocaleDateString("es-MX")}
          </div>
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" onClick={() => void setCaseStatus(c.id, "submitted")}>
              Marcar enviado
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void setCaseStatus(c.id, "under_review")}>
              En revisión
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void setCaseStatus(c.id, "completed")}>
              Completar
            </Button>
          </div>
          {loading ? null : null}
        </Card>
      ))}
      {rows.length === 0 && !loading ? (
        <Card>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>Sin expedientes con esos filtros.</p>
        </Card>
      ) : null}
    </div>
  );
}
