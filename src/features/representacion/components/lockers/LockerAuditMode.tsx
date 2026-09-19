"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption, getWorkerDisplayName } from "../WorkerPicker";
import type { LockerZone, LockerBank, LockerMapItem } from "../../lib/lockers";

interface LockerAuditModeProps {
  zones: LockerZone[];
  banks: LockerBank[];
  lockers: LockerMapItem[];
  onOpenLockerDetail: (lockerId: string) => void;
  onExit: () => void;
  onRefreshData: () => void;
}

type AuditStep = "select_target" | "walking" | "summary";

interface AuditResultItem {
  lockerId: string;
  lockerNumber: string;
  expectedOccupantName: string | null;
  result: "matches" | "physically_empty" | "different_person" | "damaged" | "unverified";
  observedWorker?: UnionWorkerOption | null;
  notes: string;
}

export function LockerAuditMode({
  zones,
  banks,
  lockers,
  onOpenLockerDetail,
  onExit,
  onRefreshData,
}: LockerAuditModeProps): React.JSX.Element {
  const [, startTransition] = useTransition();

  const [step, setStep] = useState<AuditStep>("select_target");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [auditNotes, setAuditNotes] = useState<string>("");

  // Audit state
  const [auditId, setAuditId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<LockerMapItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [results, setResults] = useState<AuditResultItem[]>([]);

  // Current locker interaction state
  const [differentPersonWorker, setDifferentPersonWorker] = useState<UnionWorkerOption | null>(null);
  const [showDifferentPersonPicker, setShowDifferentPersonPicker] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditSaveError, setAuditSaveError] = useState<string | null>(null);

  // Filter banks by zone
  const availableBanks = selectedZoneId
    ? banks.filter((b) => b.zone_id === selectedZoneId)
    : banks;

  async function handleStartAudit(): Promise<void> {
    setAuditSaveError(null);
    let filtered = [...lockers];

    if (selectedZoneId) {
      filtered = filtered.filter((l) => l.zone_id === selectedZoneId);
    }
    if (selectedBankId) {
      filtered = filtered.filter((l) => l.bank_id === selectedBankId);
    }

    if (filtered.length === 0) {
      setAuditSaveError("No hay casilleros para auditar con el filtro seleccionado.");
      return;
    }

    // Sort lockers naturally by physical order (row, column, or locker number)
    filtered.sort((a, b) => {
      if (a.row_position !== null && b.row_position !== null) {
        if (a.row_position !== b.row_position) return a.row_position - b.row_position;
        return (a.column_position ?? 0) - (b.column_position ?? 0);
      }
      return a.locker_number.localeCompare(b.locker_number, "es-MX", { numeric: true });
    });

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/union/lockers/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_id: selectedZoneId || null,
          bank_id: selectedBankId || null,
          notes: auditNotes,
        }),
      });

      const data = (await res.json()) as { audit?: { id: string }; error?: string };
      if (!res.ok || !data.audit) {
        throw new Error(data.error || "No se pudo iniciar la auditoría.");
      }

      setAuditId(data.audit.id);
      setActiveList(filtered);
      setCurrentIndex(0);
      setResults([]);
      setStep("walking");
    } catch (err: unknown) {
      setAuditSaveError(err instanceof Error ? err.message : "Error al iniciar recorrido");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recordResult(
    resultType: "matches" | "physically_empty" | "different_person" | "damaged" | "unverified"
  ): Promise<void> {
    if (!currentLocker) return;

    setIsSubmitting(true);
    const itemResult: AuditResultItem = {
      lockerId: currentLocker.id,
      lockerNumber: currentLocker.locker_number,
      expectedOccupantName: currentLocker.occupant_name ?? null,
      result: resultType,
      observedWorker: resultType === "different_person" ? differentPersonWorker : null,
      notes: currentNote,
    };

    try {
      if (auditId) {
        await fetch(`/api/union/lockers/audits/${auditId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locker_id: currentLocker.id,
            result: resultType,
            observed_worker_id: differentPersonWorker?.id || null,
            notes: currentNote,
          }),
        });
      }

      setResults((prev) => [...prev.filter((r) => r.lockerId !== currentLocker.id), itemResult]);

      // Reset item local state
      setCurrentNote("");
      setDifferentPersonWorker(null);
      setShowDifferentPersonPicker(false);

      // Move to next locker or finish
      if (currentIndex + 1 < activeList.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        setStep("summary");
      }
    } catch (err: unknown) {
      alert("Error guardando el registro de auditoría: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinishAudit(): Promise<void> {
    if (!auditId) {
      setStep("select_target");
      onRefreshData();
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch(`/api/union/lockers/audits/${auditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          notes: auditNotes,
        }),
      });
      onRefreshData();
      setStep("select_target");
      onExit();
    } catch {
      alert("No se pudo marcar la auditoría como finalizada.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentLocker = activeList[currentIndex];
  const progressPercent =
    activeList.length > 0 ? Math.round(((currentIndex + 1) / activeList.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
      {/* 1. SELECCIÓN DE OBJETIVO DE AUDITORÍA */}
      {step === "select_target" && (
        <Card padding="1.5rem">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }} aria-hidden="true">🚶</span>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                  Recorrido Físico de Casilleros
                </h2>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
                Audita casillero por casillero en el hospital. Diseñado para usarse ágilmente desde el celular.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onExit}>
              ✕ Salir
            </Button>
          </div>

          {auditSaveError && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: "0.8125rem",
                marginBottom: "1rem",
                border: "1px solid #fecaca",
              }}
            >
              {auditSaveError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                1. Selecciona la Zona a auditar
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => {
                  setSelectedZoneId(e.target.value);
                  setSelectedBankId("");
                }}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--fg)",
                  fontSize: "0.875rem",
                }}
              >
                <option value="">Todas las zonas ({lockers.length} casilleros)</option>
                {zones.map((z) => {
                  const countInZone = lockers.filter((l) => l.zone_id === z.id).length;
                  return (
                    <option key={z.id} value={z.id}>
                      {z.name} ({countInZone} casilleros)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                2. Selecciona un Mueble / Bloque específico (opcional)
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                disabled={availableBanks.length === 0}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--fg)",
                  fontSize: "0.875rem",
                }}
              >
                <option value="">Todo el bloque / todos los muebles</option>
                {availableBanks.map((b) => {
                  const countInBank = lockers.filter((l) => l.bank_id === b.id).length;
                  return (
                    <option key={b.id} value={b.id}>
                      {b.name} ({countInBank} casilleros)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                Notas iniciales del recorrido
              </label>
              <input
                type="text"
                placeholder="Ej. Recorrido matutino con jefe de servicio..."
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--fg)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={onExit}>
                Cancelar
              </Button>
              <Button variant="primary" loading={isSubmitting} onClick={() => void handleStartAudit()}>
                Comenzar Recorrido
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 2. PASO A PASO ACTIVO */}
      {step === "walking" && currentLocker && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Barra de progreso superior fija */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem" }}>
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                Casillero {currentIndex + 1} de {activeList.length} ({progressPercent}%)
              </span>
              <button
                type="button"
                onClick={() => setStep("summary")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Finalizar recorrido temprano
              </button>
            </div>

            {/* Barra visual */}
            <div style={{ height: "6px", width: "100%", backgroundColor: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  backgroundColor: "var(--primary)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>

          {/* Tarjeta interactiva del locker actual */}
          <Card padding="1.5rem" style={{ border: "2px solid var(--primary)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
                  {currentLocker.zone_name || "Sin zona"} · {currentLocker.bank_name || "Sin mueble"}
                  {currentLocker.row_position !== null && ` · Fila ${currentLocker.row_position + 1}`}
                </span>
                <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
                  #{currentLocker.locker_number}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenLockerDetail(currentLocker.id)}
                style={{ fontSize: "0.75rem" }}
              >
                Ver ficha completa
              </Button>
            </div>

            {/* Estado registrado en sistema */}
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "0.5rem",
                backgroundColor: currentLocker.status === "assigned" ? "#eff6ff" : "var(--accent)",
                border: "1px solid",
                borderColor: currentLocker.status === "assigned" ? "#bfdbfe" : "var(--border)",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
                OCUPANTE EN SISTEMA:
              </div>

              {currentLocker.status === "assigned" ? (
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e3a8a" }}>
                    {currentLocker.occupant_name}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#3b82f6", display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span>Matrícula: <strong>{currentLocker.occupant_employee_number || "—"}</strong></span>
                    {currentLocker.occupant_category && <span>· {currentLocker.occupant_category}</span>}
                    {currentLocker.occupant_turn && <span>· Turno {currentLocker.occupant_turn}</span>}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontStyle: "italic" }}>
                  🟢 Casillero registrado como DISPONIBLE (libre).
                </div>
              )}
            </div>

            {/* Selector de persona diferente si se activa */}
            {showDifferentPersonPicker && (
              <div
                style={{
                  padding: "0.875rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem" }}>
                  Indica quién está utilizando este casillero:
                </div>
                <WorkerPicker
                  selected={differentPersonWorker}
                  onSelect={(w) => setDifferentPersonWorker(w)}
                  label="Buscar trabajador"
                />
                {differentPersonWorker && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#78350f" }}>
                    Seleccionado: <strong>{getWorkerDisplayName(differentPersonWorker)}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDifferentPersonPicker(false);
                      setDifferentPersonWorker(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isSubmitting}
                    onClick={() => void recordResult("different_person")}
                  >
                    Confirmar persona distinta
                  </Button>
                </div>
              </div>
            )}

            {/* Campo de notas rápidas */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                type="text"
                placeholder="Observación rápida (ej. candado con iniciales, calcomanía, etc.)..."
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--fg)",
                  fontSize: "0.8125rem",
                }}
              />
            </div>

            {/* BOTONES DE DECISIÓN DE AUDITORÍA */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void recordResult("matches")}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#22c55e",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 2px 4px rgba(34, 197, 94, 0.2)",
                }}
              >
                <span>✓</span>
                <span>Coincide con el sistema</span>
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void recordResult("physically_empty")}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🟢 Está libre / vacío
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDifferentPersonPicker(true)}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  👥 Lo tiene otra persona
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void recordResult("damaged")}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    border: "1px solid #fecaca",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🛠 Está dañado / forzado
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void recordResult("unverified")}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#f8fafc",
                    color: "#64748b",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🔒 No puedo verificar
                </button>
              </div>
            </div>

            {/* Navegación manual atrás/adelante */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentIndex === 0 || isSubmitting}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                ‹ Anterior
              </Button>

              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Salta si el locker no está accesible
              </span>

              <Button
                variant="secondary"
                size="sm"
                disabled={currentIndex + 1 >= activeList.length || isSubmitting}
                onClick={() => setCurrentIndex((i) => Math.min(activeList.length - 1, i + 1))}
              >
                Siguiente ›
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 3. RESUMEN FINAL DE DISCREPANCIAS */}
      {step === "summary" && (
        <Card padding="1.5rem">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Resumen del Recorrido Físico
              </h2>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
                Revisa los hallazgos encontrados durante tu inspección física.
              </p>
            </div>
            <Button variant="primary" loading={isSubmitting} onClick={() => void handleFinishAudit()}>
              Guardar y Finalizar
            </Button>
          </div>

          {/* Tarjetas de métricas del recorrido */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.75rem", backgroundColor: "var(--accent)", borderRadius: "0.375rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--fg)" }}>{results.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Total Verificados</div>
            </div>
            <div style={{ padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "0.375rem", textAlign: "center", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#166534" }}>
                {results.filter((r) => r.result === "matches").length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#166534" }}>Correctos</div>
            </div>
            <div style={{ padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "0.375rem", textAlign: "center", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#991b1b" }}>
                {results.filter((r) => r.result !== "matches").length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#991b1b" }}>Discrepancias</div>
            </div>
          </div>

          {/* Listado de discrepancias detectadas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>
              Detalle de Incidencias ({results.filter((r) => r.result !== "matches").length})
            </h3>

            {results.filter((r) => r.result !== "matches").length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
                🎉 ¡Excelente! No se registraron discrepancias en los casilleros auditados.
              </div>
            ) : (
              results
                .filter((r) => r.result !== "matches")
                .map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>#{item.lockerNumber}</span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "9999px",
                            fontWeight: 600,
                            backgroundColor:
                              item.result === "damaged"
                                ? "#fee2e2"
                                : item.result === "different_person"
                                ? "#fef3c7"
                                : item.result === "physically_empty"
                                ? "#e0f2fe"
                                : "#f3f4f6",
                            color:
                              item.result === "damaged"
                                ? "#991b1b"
                                : item.result === "different_person"
                                ? "#92400e"
                                : item.result === "physically_empty"
                                ? "#0369a1"
                                : "#374151",
                          }}
                        >
                          {item.result === "damaged"
                            ? "Dañado"
                            : item.result === "different_person"
                            ? "Otra persona"
                            : item.result === "physically_empty"
                            ? "Libre físico"
                            : "No verificable"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Esperado: {item.expectedOccupantName || "Libre"}
                        {item.observedWorker && ` · Observado: ${getWorkerDisplayName(item.observedWorker)}`}
                        {item.notes && ` · Nota: ${item.notes}`}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenLockerDetail(item.lockerId)}
                    >
                      Ver casillero
                    </Button>
                  </div>
                ))
            )}
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button
              variant="secondary"
              onClick={() => {
                startTransition(() => {
                  setStep("walking");
                });
              }}
            >
              Regresar al recorrido
            </Button>
            <Button variant="primary" loading={isSubmitting} onClick={() => void handleFinishAudit()}>
              Guardar y Finalizar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
