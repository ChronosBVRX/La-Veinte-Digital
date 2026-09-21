"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { User, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import type { UnionWorkerOption } from "../WorkerPicker";
import { getWorkerDisplayName } from "../WorkerPicker";
import styles from "./PassageWizard.module.css";

export interface PassageWorkerSectionProps {
  selected: UnionWorkerOption | null;
  onSelect: (worker: UnionWorkerOption | null) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export function PassageWorkerSection({
  selected,
  onSelect,
  disabled = false,
  hasError = false,
}: PassageWorkerSectionProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnionWorkerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(): Promise<void> {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/union/workers?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { workers?: UnionWorkerOption[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al buscar");
      setResults(json.workers ?? []);
    } catch {
      setSearchError("No se pudo completar la búsqueda. Intenta de nuevo.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={`${styles.sectionCard} ${hasError && !selected ? styles.inputInvalid : ""}`}
      aria-labelledby="worker-section-title"
    >
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="worker-section-title" className={styles.sectionTitle}>
            Trabajador solicitante
          </h2>
          <p className={styles.sectionSubtitle}>
            {selected
              ? "Datos del trabajador verificados en la base sindical."
              : "Busca por matrícula, nombre o apellido para precargar su información oficial."}
          </p>
        </div>
      </div>

      {selected ? (
        /* Tarjeta de trabajador seleccionado (Alta jerarquía visual) */
        <div className={styles.selectedWorkerCard} role="region" aria-label="Trabajador seleccionado">
          <div className={styles.workerInfo}>
            <span className={styles.workerStatusTag}>
              <CheckCircle size={16} weight="fill" />
              Trabajador seleccionado
            </span>
            <h3 className={styles.workerName}>{getWorkerDisplayName(selected)}</h3>
            <div className={styles.workerMeta}>
              <strong>Matrícula {selected.employee_number}</strong> · {selected.category} ·{" "}
              {selected.assignment} {selected.turn ? `· ${selected.turn}` : ""}
            </div>
          </div>
          <div className={styles.changeWorkerBtn}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelect(null)}
              disabled={disabled}
              aria-label={`Cambiar trabajador seleccionado (${getWorkerDisplayName(selected)})`}
            >
              Cambiar
            </Button>
          </div>
        </div>
      ) : (
        /* Formulario de búsqueda cuando NO hay trabajador seleccionado */
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Input
              id="passage-worker-search-input"
              label="Buscar trabajador"
              placeholder="Matrícula, nombre o apellido…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              disabled={disabled || loading}
            />
          </div>
          <div className={styles.searchBtnWrapper} style={{ marginTop: "1.5rem" }}>
            <Button
              className={styles.searchBtn}
              onClick={() => void handleSearch()}
              loading={loading}
              disabled={disabled || !query.trim()}
            >
              <MagnifyingGlass size={16} weight="bold" style={{ marginRight: "0.35rem" }} />
              Buscar trabajador
            </Button>
          </div>
        </div>
      )}

      {/* Mensajes de error de búsqueda */}
      {searchError ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--error)" }}>
          {searchError}
        </p>
      ) : null}

      {/* Sin resultados tras buscar */}
      {!selected && hasSearched && !loading && results.length === 0 && !searchError ? (
        <div style={{ padding: "0.75rem", background: "var(--accent)", borderRadius: "var(--radius)", fontSize: "0.8125rem", color: "var(--muted)" }}>
          No se encontraron trabajadores con &ldquo;{query}&rdquo;. Verifica la matrícula o regístralo en{" "}
          <Link href="/representacion/trabajadores" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Trabajadores
          </Link>
          .
        </div>
      ) : null}

      {/* Lista de resultados encontrados */}
      {!selected && results.length > 0 ? (
        <ul className={styles.resultsList} role="listbox" aria-label="Resultados de búsqueda de trabajador">
          {results.map((w) => (
            <li key={w.id} role="option" aria-selected="false">
              <button
                type="button"
                className={styles.resultItem}
                onClick={() => {
                  onSelect(w);
                  setResults([]);
                  setQuery("");
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#e2e8f0",
                      color: "#475569",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <User size={18} weight="bold" />
                  </span>
                  <div className={styles.resultMain}>
                    <span className={styles.resultName}>{getWorkerDisplayName(w)}</span>
                    <span className={styles.resultSub}>
                      {w.category} · {w.assignment} {w.turn ? `· ${w.turn}` : ""}
                    </span>
                  </div>
                </div>
                <span className={styles.resultBadge}>Mat. {w.employee_number}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
