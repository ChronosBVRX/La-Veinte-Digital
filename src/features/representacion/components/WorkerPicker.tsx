"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import {
  resolveUnionWorkerName,
  type UnionWorkerNameInput,
} from "../services/worker-name-resolver";

export interface UnionWorkerOption {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  siap_full_name?: string;
  category: string;
  assignment: string;
  turn: string;
  schedule?: string;
  rest_days?: string;
}

export function getWorkerDisplayName(w: UnionWorkerNameInput | null | undefined): string {
  if (!w) return "Sin nombre";
  const resolved = resolveUnionWorkerName(w);
  return resolved.displayName || "Sin nombre";
}

export function WorkerPicker({
  label = "Trabajador",
  onSelect,
  selected,
}: {
  label?: string;
  onSelect: (w: UnionWorkerOption | null) => void;
  selected: UnionWorkerOption | null;
}): React.JSX.Element {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UnionWorkerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/union/workers?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = (await res.json()) as { workers?: UnionWorkerOption[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error");
      setResults(json.workers ?? []);
    } catch {
      setError("No se pudo buscar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <label htmlFor="union-worker-q" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
        {label}
      </label>
      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "0.625rem 0.75rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>
              {getWorkerDisplayName(selected)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Mat. {selected.employee_number} · {selected.category} · {selected.turn}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Input
              id="union-worker-q"
              placeholder="Matrícula o apellido…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
            />
            <Button onClick={() => void search()} loading={loading} aria-label="Buscar trabajador">
              Buscar
            </Button>
          </div>
          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--error)" }}>
              {error}
            </p>
          ) : null}
          {results.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {results.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(w)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "0.625rem 0.75rem",
                      cursor: "pointer",
                      minHeight: 48,
                    }}
                  >
                    <span style={{ display: "block", fontWeight: 700, fontSize: "0.875rem" }}>
                      {getWorkerDisplayName(w)}
                    </span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>
                      Mat. {w.employee_number} · {w.category} · {w.assignment} · {w.turn}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Si no aparece, dalo de alta en <Link href="/representacion/trabajadores">Trabajadores</Link> y vuelve aquí.
          </p>
        </div>
      )}
    </Card>
  );
}
