"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { WorkerPicker, type UnionWorkerOption, getWorkerDisplayName } from "./WorkerPicker";
import type { LockerReviewItem } from "../services/worker-importer/types";

type FilterTab = "all" | "worker_not_found" | "locker_multiple_workers" | "worker_multiple_lockers" | "other";

interface PendingApiResponse {
  items?: LockerReviewItem[];
  counts?: {
    total: number;
    workerNotFound: number;
    multipleWorkers: number;
    multipleLockers: number;
    other: number;
  };
  newMatchesCount?: number;
  matches?: Array<{
    reviewItemId: string;
    lockerNumber: string;
    employeeNumber: string;
    workerId: string;
    workerName: string;
  }>;
  error?: string;
}

export function LockerPendingReviewList(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [items, setItems] = useState<LockerReviewItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    workerNotFound: 0,
    multipleWorkers: 0,
    multipleLockers: 0,
    other: 0,
  });
  const [newMatchesCount, setNewMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [batchLinking, setBatchLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado del modal de vinculación manual de trabajador
  const [resolvingItem, setResolvingItem] = useState<LockerReviewItem | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<UnionWorkerOption | null>(null);

  // Estados locales para selección en incidencias de opción múltiple
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/union/lockers/pendientes?filter=${activeTab}`, { cache: "no-store" });
      const data = (await res.json()) as PendingApiResponse;
      if (!res.ok) throw new Error(data.error ?? "Error al cargar la lista de pendientes");

      setItems(data.items ?? []);
      if (data.counts) setCounts(data.counts);
      setNewMatchesCount(data.newMatchesCount ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al consultar los registros pendientes.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void loadData();
  }, [loadData]);

  // Acción: Vincular trabajador seleccionado manualmente
  async function handleConfirmLinkWorker(): Promise<void> {
    if (!resolvingItem || !selectedWorker) return;
    setSubmittingId(resolvingItem.id);
    setError(null);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_worker",
          reviewItemId: resolvingItem.id,
          workerId: selectedWorker.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al vincular trabajador");

      setSuccessMessage(`✓ Asignación guardada: Casillero ${resolvingItem.locker_number} vinculado correctamente.`);
      setResolvingItem(null);
      setSelectedWorker(null);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el trabajador.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Acción: Seleccionar persona para locker duplicado
  async function handleSelectWorkerForLocker(item: LockerReviewItem, employeeNumber: string): Promise<void> {
    if (!employeeNumber) return;
    setSubmittingId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select_worker_for_locker",
          reviewItemId: item.id,
          selectedEmployeeNumber: employeeNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al asignar casillero");

      setSuccessMessage(`✓ Casillero ${item.locker_number} asignado exitosamente.`);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la decisión.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Acción: Seleccionar casillero para persona con múltiples casilleros
  async function handleSelectLockerForWorker(item: LockerReviewItem, lockerNumber: string): Promise<void> {
    if (!lockerNumber) return;
    setSubmittingId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select_locker_for_worker",
          reviewItemId: item.id,
          selectedLockerNumber: lockerNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar casillero");

      setSuccessMessage(`✓ Casillero ${lockerNumber} asignado exitosamente.`);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la decisión.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Acción: Dejar pendiente / ignorar
  async function handleIgnoreItem(item: LockerReviewItem): Promise<void> {
    setSubmittingId(item.id);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore", reviewItemId: item.id }),
      });
      if (res.ok) {
        setSuccessMessage(`✓ Registro omitido de la lista de pendientes.`);
        void loadData();
      }
    } finally {
      setSubmittingId(null);
    }
  }

  // Acción: Vincular todas las coincidencias nuevas detectadas
  async function handleBatchLink(): Promise<void> {
    setBatchLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_link_matches" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al vincular coincidencias");

      setSuccessMessage(`✓ Se vincularon automáticamente ${data.linkedCount} personas con sus casilleros.`);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al vincular coincidencias.");
    } finally {
      setBatchLinking(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Navegación y Encabezado Humano */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link
              href="/representacion/lockers"
              style={{ fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
            >
              ← Volver a lockers
            </Link>
          </div>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.25rem", fontWeight: 700 }}>Información por revisar</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
            Aquí encontrarás datos que no pudimos relacionar automáticamente. Puedes corregirlos poco a poco.
          </p>
        </div>

        <Link
          href="/representacion/lockers/importar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.45rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--fg)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Actualizar con otra base
        </Link>
      </div>

      {/* Mensajes de Éxito o Error */}
      {successMessage ? (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            fontSize: "0.8125rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {/* Banner de Sincronización Inteligente con Trabajadores */}
      {newMatchesCount > 0 ? (
        <Card padding="1rem">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🎉</span>
                <strong style={{ fontSize: "0.9375rem", color: "#15803d" }}>
                  Encontramos {newMatchesCount} {newMatchesCount === 1 ? "coincidencia nueva" : "coincidencias nuevas"}
                </strong>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                Hay personas del archivo de lockers que ahora ya existen en la base de trabajadores. Podemos vincularlas automáticamente.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleBatchLink()}
              loading={batchLinking}
            >
              Revisar y vincular ({newMatchesCount})
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Pestañas de Filtro Humanas */}
      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
          overflowX: "auto",
        }}
      >
        <Button
          size="sm"
          variant={activeTab === "all" ? "primary" : "secondary"}
          onClick={() => setActiveTab("all")}
        >
          Todos ({counts.total})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "worker_not_found" ? "primary" : "secondary"}
          onClick={() => setActiveTab("worker_not_found")}
        >
          Personas no encontradas ({counts.workerNotFound})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "locker_multiple_workers" ? "primary" : "secondary"}
          onClick={() => setActiveTab("locker_multiple_workers")}
        >
          Lockers con más de una persona ({counts.multipleWorkers})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "worker_multiple_lockers" ? "primary" : "secondary"}
          onClick={() => setActiveTab("worker_multiple_lockers")}
        >
          Personas con más de un locker ({counts.multipleLockers})
        </Button>
        {counts.other > 0 ? (
          <Button
            size="sm"
            variant={activeTab === "other" ? "primary" : "secondary"}
            onClick={() => setActiveTab("other")}
          >
            Otros ({counts.other})
          </Button>
        ) : null}
      </div>

      {/* Lista de Tarjetas de Pendientes */}
      {loading ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
          <LoadingSpinner text="Cargando registros pendientes..." />
        </div>
      ) : items.length === 0 ? (
        <Card padding="2rem">
          <div style={{ textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✓</div>
            <h3 style={{ margin: 0, fontSize: "1.125rem", color: "var(--fg)" }}>¡Todo revisado!</h3>
            <p style={{ margin: "0.25rem 0 1rem", fontSize: "0.875rem" }}>
              No hay registros pendientes de revisión en esta categoría.
            </p>
            <Link
              href="/representacion/lockers"
              style={{
                display: "inline-block",
                padding: "0.45rem 0.875rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--primary)",
                color: "var(--primary-fg)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ir a lockers
            </Link>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => {
            const isWorkerNotFound = item.reason === "WORKER_NOT_FOUND";
            const isMultipleWorkers =
              item.reason === "LOCKER_MULTIPLE_WORKERS" ||
              item.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS";
            const isMultipleLockers = item.reason === "WORKER_MULTIPLE_LOCKERS";

            return (
              <Card key={item.id} padding="1rem">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxWidth: "600px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "1.0625rem" }}>Locker {item.locker_number}</strong>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "999px",
                          backgroundColor: isWorkerNotFound ? "#ffedd5" : "#f3e8ff",
                          color: isWorkerNotFound ? "#9a3412" : "#6b21a8",
                        }}
                      >
                        {isWorkerNotFound
                          ? "Persona no encontrada"
                          : isMultipleWorkers
                          ? "Locker con más de una persona"
                          : isMultipleLockers
                          ? "Persona con más de un locker"
                          : "Pendiente de revisión"}
                      </span>
                    </div>

                    {isWorkerNotFound ? (
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "var(--fg)" }}>
                          En el archivo aparece: <strong>{item.source_worker_name || "Sin nombre registrado"}</strong>
                          {item.source_employee_number ? ` · Matrícula ${item.source_employee_number}` : ""}
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                          Todavía no existe en la base de trabajadores. Puedes buscarla manualmente o vincularla cuando su información esté disponible.
                        </p>
                      </div>
                    ) : isMultipleWorkers ? (
                      <div>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                          Este casillero aparece asignado a más de una persona en el archivo. ¿Quién lo tiene actualmente?
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                            <input
                              type="radio"
                              name={`worker_select_${item.id}`}
                              value={item.source_employee_number ?? ""}
                              checked={selectedCandidates[item.id] === item.source_employee_number}
                              onChange={(e) => setSelectedCandidates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                            <span>{item.source_worker_name} — {item.source_employee_number}</span>
                          </label>
                        </div>
                      </div>
                    ) : isMultipleLockers ? (
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "var(--fg)" }}>
                          Trabajador: <strong>{item.source_worker_name}</strong> · Matrícula {item.source_employee_number}
                        </div>
                        <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                          Esta persona aparece con más de un casillero en el archivo. Selecciona el correcto:
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Input
                            placeholder="Número de casillero correcto…"
                            value={selectedCandidates[item.id] ?? item.locker_number}
                            onChange={(e) => setSelectedCandidates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            style={{ maxWidth: "200px" }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: "0.875rem" }}>
                          Registro: <strong>{item.source_worker_name}</strong> · Matrícula {item.source_employee_number}
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                          {item.source_notes || "Requiere confirmación de asignación."}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {isWorkerNotFound ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setResolvingItem(item);
                            setSelectedWorker(null);
                          }}
                          disabled={submittingId === item.id}
                        >
                          Buscar trabajador
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleIgnoreItem(item)}
                          disabled={submittingId === item.id}
                        >
                          Dejar pendiente
                        </Button>
                      </>
                    ) : isMultipleWorkers ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleSelectWorkerForLocker(item, selectedCandidates[item.id] ?? item.source_employee_number ?? "")}
                        loading={submittingId === item.id}
                        disabled={!selectedCandidates[item.id] && !item.source_employee_number}
                      >
                        Guardar
                      </Button>
                    ) : isMultipleLockers ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleSelectLockerForWorker(item, selectedCandidates[item.id] ?? item.locker_number)}
                        loading={submittingId === item.id}
                        disabled={!selectedCandidates[item.id] && !item.locker_number}
                      >
                        Guardar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setResolvingItem(item);
                          setSelectedWorker(null);
                        }}
                      >
                        Vincular
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Interactivo: Buscar y Vincular Trabajador */}
      {resolvingItem ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              maxWidth: "500px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                Vincular Casillero {resolvingItem.locker_number}
              </h3>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
              El archivo indica: <strong>{resolvingItem.source_worker_name}</strong>
              {resolvingItem.source_employee_number ? ` (Matrícula: ${resolvingItem.source_employee_number})` : ""}.
              Busca y selecciona a la persona en el padrón de trabajadores:
            </p>

            <WorkerPicker selected={selectedWorker} onSelect={setSelectedWorker} />

            {selectedWorker ? (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1e40af",
                  fontSize: "0.8125rem",
                }}
              >
                <strong>Vas a asignar:</strong>
                <div>Locker {resolvingItem.locker_number} a {getWorkerDisplayName(selectedWorker)} (Mat. {selectedWorker.employee_number})</div>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Button variant="ghost" size="sm" onClick={() => setResolvingItem(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleConfirmLinkWorker()}
                loading={submittingId === resolvingItem.id}
                disabled={!selectedWorker}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
