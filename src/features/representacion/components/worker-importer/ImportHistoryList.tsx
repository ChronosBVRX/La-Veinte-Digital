"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface ImportBatch {
  id: string;
  file_name: string;
  file_size_bytes: number;
  total_rows: number;
  new_workers_count: number;
  updated_workers_count: number;
  unchanged_workers_count: number;
  conflicts_count: number;
  missing_in_file_count: number;
  status: "preview" | "confirmed" | "rolled_back" | "failed";
  applied_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
}

export function ImportHistoryList(): React.JSX.Element {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/union/workers/imports", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { batches?: ImportBatch[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Error al cargar historial.");
        if (!cancelled) setBatches(data.batches ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar historial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  async function handleRollback(batchId: string): Promise<void> {
    if (!window.confirm("¿Seguro que deseas revertir esta importación? Los campos actualizados regresarán a su estado anterior y los trabajadores creados en este lote sin expedientes serán removidos.")) {
      return;
    }

    setRollingBackId(batchId);
    try {
      const res = await fetch("/api/union/workers/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo revertir el lote.");
      setLoading(true);
      setRefreshIndex((i) => i + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al revertir.");
    } finally {
      setRollingBackId(null);
    }
  }

  function getStatusLabel(status: ImportBatch["status"]): { label: string; bg: string; fg: string } {
    switch (status) {
      case "confirmed":
        return { label: "Confirmado", bg: "#dcfce7", fg: "#15803d" };
      case "preview":
        return { label: "Solo vista previa", bg: "#fef9c3", fg: "#a16207" };
      case "rolled_back":
        return { label: "Revertido", bg: "#f1f5f9", fg: "#475569" };
      case "failed":
        return { label: "Fallido", bg: "#fee2e2", fg: "#b91c1c" };
    }
  }

  if (loading) return <LoadingSpinner text="Cargando historial de importaciones…" />;
  if (error) return <p style={{ color: "var(--error)", fontSize: "0.8125rem" }}>{error}</p>;
  if (batches.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "1rem 0" }}>
        Aún no se han realizado importaciones de plantillas Excel en esta delegación.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.375rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--accent)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Fecha / Hora</th>
              <th style={{ padding: "0.5rem" }}>Archivo</th>
              <th style={{ padding: "0.5rem" }}>Estado</th>
              <th style={{ padding: "0.5rem" }}>Total leídos</th>
              <th style={{ padding: "0.5rem" }}>Nuevos</th>
              <th style={{ padding: "0.5rem" }}>Modificados</th>
              <th style={{ padding: "0.5rem" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const badge = getStatusLabel(b.status);
              return (
                <tr key={b.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {new Date(b.created_at).toLocaleString("es-MX")}
                  </td>
                  <td style={{ padding: "0.5rem", fontWeight: 600 }}>{b.file_name}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.35rem",
                        borderRadius: "0.2rem",
                        backgroundColor: badge.bg,
                        color: badge.fg,
                        fontWeight: 600,
                        fontSize: "0.6875rem",
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{b.total_rows.toLocaleString("es-MX")}</td>
                  <td style={{ padding: "0.5rem", color: "#16a34a", fontWeight: 600 }}>
                    +{b.new_workers_count}
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--primary)", fontWeight: 600 }}>
                    {b.updated_workers_count}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {b.status === "confirmed" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRollback(b.id)}
                        loading={rollingBackId === b.id}
                        style={{ color: "#dc2626", fontSize: "0.6875rem", padding: "0.2rem 0.4rem" }}
                      >
                        Revertir
                      </Button>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
