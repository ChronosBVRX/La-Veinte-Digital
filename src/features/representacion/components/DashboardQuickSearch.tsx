"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X, User, Folder, ArrowRight, Spinner } from "@phosphor-icons/react";
import { formatCaseTypeLabel, formatCaseStatusLabel } from "../lib/dashboard-format";

interface WorkerMatch {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname?: string | null;
  category: string;
}

interface CaseMatch {
  id: string;
  folio: string;
  case_type: string;
  status: string;
  union_workers?: {
    first_name: string;
    paternal_surname: string;
    employee_number: string;
  } | null;
}

export function DashboardQuickSearch(): React.JSX.Element {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<WorkerMatch[]>([]);
  const [cases, setCases] = useState<CaseMatch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al dar click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Búsqueda en vivo debounced
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.allSettled([
        fetch(`/api/union/workers?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" }).then(async (r) => {
          if (!r.ok) return [];
          const j = await r.json();
          return (j.workers ?? []) as WorkerMatch[];
        }),
        fetch(`/api/union/cases?folio=${encodeURIComponent(trimmed)}`, { cache: "no-store" }).then(async (r) => {
          if (!r.ok) return [];
          const j = await r.json();
          return (j.cases ?? []) as CaseMatch[];
        }),
      ]).then(([wRes, cRes]) => {
        if (cancelled) return;
        setWorkers(wRes.status === "fulfilled" ? wRes.value.slice(0, 4) : []);
        setCases(cRes.status === "fulfilled" ? cRes.value.slice(0, 4) : []);
        setLoading(false);
      });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        setIsOpen(false);

        // Si parece un folio institucional (XXI-, LIC, PAS, etc.) navegar a expedientes
        const isLikelyFolio = /^(xxi|lic|pas|mat|lac|lok)/i.test(trimmed) || trimmed.includes("-");
        const targetUrl = isLikelyFolio
          ? `/representacion/expedientes?folio=${encodeURIComponent(trimmed)}`
          : `/representacion/trabajadores?q=${encodeURIComponent(trimmed)}`;

        if (router) {
          router.push(targetUrl);
        } else if (typeof window !== "undefined") {
          window.location.href = targetUrl;
        }
      }
    },
    [query, router],
  );

  const trimmedQuery = query.trim();
  const activeWorkers = trimmedQuery.length < 2 ? [] : workers;
  const activeCases = trimmedQuery.length < 2 ? [] : cases;
  const isSearching = trimmedQuery.length < 2 ? false : loading;
  const hasResults = activeWorkers.length > 0 || activeCases.length > 0;
  const showDropdown = isOpen && trimmedQuery.length >= 2;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: "640px" }}>
      {/* Barra de entrada */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--card)",
          border: isOpen ? "1px solid var(--primary)" : "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: "0.625rem 0.875rem",
          boxShadow: isOpen ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <MagnifyingGlass size={18} weight="bold" style={{ color: isOpen ? "var(--primary)" : "var(--muted)", flexShrink: 0 }} />
        <input
          type="search"
          role="searchbox"
          aria-label="Buscar trabajador, matrícula o expediente"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar trabajador, matrícula o expediente..."
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "0.9375rem",
            color: "var(--fg)",
            fontFamily: "inherit",
          }}
        />
        {isSearching ? (
          <Spinner size={16} className="animate-spin" style={{ color: "var(--muted)", flexShrink: 0 }} />
        ) : query ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQuery("");
              setWorkers([]);
              setCases([]);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              borderRadius: "999px",
            }}
          >
            <X size={14} weight="bold" />
          </button>
        ) : null}
      </div>

      {/* Menú desplegable flotante */}
      {showDropdown ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 0.375rem)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 0.75rem)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
            maxHeight: "360px",
            overflowY: "auto",
            padding: "0.5rem",
          }}
        >
          {isSearching && !hasResults ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Buscando coincidencias…
            </div>
          ) : !hasResults ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.8125rem", color: "var(--muted)" }}>
              No se encontraron coincidencias para &ldquo;{query}&rdquo;.
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/representacion/trabajadores?q=${encodeURIComponent(query)}`);
                  }}
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Buscar en padrón completo →
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Sección Trabajadores */}
              {activeWorkers.length > 0 ? (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      padding: "0.25rem 0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <User size={13} weight="bold" /> Trabajadores ({activeWorkers.length})
                  </div>
                  {activeWorkers.map((w) => {
                    const fullName = [w.paternal_surname, w.maternal_surname, w.first_name].filter(Boolean).join(" ");
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/representacion/trabajadores/${w.id}`);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          textAlign: "left",
                          padding: "0.5rem 0.625rem",
                          border: "none",
                          background: "transparent",
                          borderRadius: "var(--radius, 0.375rem)",
                          cursor: "pointer",
                          color: "var(--fg)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {fullName}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                            Mat. {w.employee_number} · {w.category}
                          </div>
                        </div>
                        <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0, marginLeft: "0.5rem" }} />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Sección Expedientes */}
              {activeCases.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      padding: "0.25rem 0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <Folder size={13} weight="bold" /> Expedientes ({activeCases.length})
                  </div>
                  {cases.map((c) => {
                    const wName = c.union_workers
                      ? `${c.union_workers.paternal_surname} ${c.union_workers.first_name}`
                      : "";
                    const targetHref =
                      c.case_type === "license"
                        ? `/representacion/licencias?case=${c.id}&action=continue`
                        : `/representacion/expedientes?folio=${c.folio}`;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(targetHref);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          textAlign: "left",
                          padding: "0.5rem 0.625rem",
                          border: "none",
                          background: "transparent",
                          borderRadius: "var(--radius, 0.375rem)",
                          cursor: "pointer",
                          color: "var(--fg)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)" }}>
                            {c.folio}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                            {formatCaseTypeLabel(c.case_type)} · {formatCaseStatusLabel(c.status)}
                            {wName ? ` · ${wName}` : ""}
                          </div>
                        </div>
                        <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0, marginLeft: "0.5rem" }} />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Pie con atajo Enter */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: "0.375rem",
                  paddingTop: "0.375rem",
                  paddingLeft: "0.5rem",
                  paddingRight: "0.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.6875rem",
                  color: "var(--muted)",
                }}
              >
                <span>Presiona <strong>Enter</strong> para buscar</span>
                <span><strong>Esc</strong> para cerrar</span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
