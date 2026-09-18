"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Printer,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  Clock,
  ArrowLeft,
  Gear,
  Copy,
} from "@phosphor-icons/react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTimeEs } from "../lib/dashboard-format";

interface PrintJob {
  id: string;
  case_id: string | null;
  case_folio?: string;
  worker_name?: string;
  document_type: string;
  document_revision: number;
  status: "queued" | "claimed" | "printing" | "printed" | "failed" | "cancelled";
  copies: number;
  duplex: boolean;
  error_code?: string | null;
  error_message?: string | null;
  attempt_count: number;
  created_at: string;
  claimed_at?: string | null;
  printing_at?: string | null;
  printed_at?: string | null;
  failed_at?: string | null;
}

interface PrintStation {
  id: string;
  delegation_id: string;
  name: string;
  printer_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  agent_version?: string | null;
  isOnline: boolean;
}

export interface PrintQueueClientProps {
  delegationId: string;
  isAdmin?: boolean;
}

export function PrintQueueClient({ delegationId, isAdmin = false }: PrintQueueClientProps): React.JSX.Element {
  const [station, setStation] = useState<PrintStation | null>(null);
  const [queued, setQueued] = useState<PrintJob[]>([]);
  const [printing, setPrinting] = useState<PrintJob[]>([]);
  const [failed, setFailed] = useState<PrintJob[]>([]);
  const [recent, setRecent] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // Modal de administración de estación
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [stationNameInput, setStationNameInput] = useState("");
  const [printerNameInput, setPrinterNameInput] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/union/print/jobs?delegation_id=${delegationId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setStation(data.station || null);
        setQueued(data.queued || []);
        setPrinting(data.printing || []);
        setFailed(data.failed || []);
        setRecent(data.recent || []);
      }
    } catch {
      // Silently retry on next tick
    } finally {
      setLoading(false);
    }
  }, [delegationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void fetchQueue();
    // Polling fallback cada 12 segundos
    const interval = setInterval(() => {
      void fetchQueue();
    }, 12000);

    // Suscripción Realtime a cambios en trabajos de impresión
    const supabase = createClient();
    const channel = supabase
      .channel(`union-print-${delegationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "union_print_jobs",
          filter: `delegation_id=eq.${delegationId}`,
        },
        () => {
          fetchQueue();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "union_print_stations",
          filter: `delegation_id=eq.${delegationId}`,
        },
        () => {
          fetchQueue();
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [delegationId, fetchQueue]);

  async function handleRetry(jobId: string) {
    if (retryingJobId) return;
    setRetryingJobId(jobId);
    try {
      const res = await fetch(`/api/union/print/jobs/${jobId}/retry`, { method: "POST" });
      if (res.ok) {
        await fetchQueue();
      }
    } finally {
      setRetryingJobId(null);
    }
  }

  async function handleCreateOrUpdateStation() {
    setSavingStation(true);
    setAdminError(null);
    try {
      if (station) {
        // Actualizar existente
        const res = await fetch(`/api/union/print/stations/${station.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: stationNameInput.trim(),
            printer_name: printerNameInput.trim(),
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || "No se pudo actualizar.");
        }
        await fetchQueue();
        setShowAdminModal(false);
      } else {
        // Registrar nueva
        const res = await fetch("/api/union/print/stations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delegation_id: delegationId,
            name: stationNameInput.trim(),
            printer_name: printerNameInput.trim(),
          }),
        });
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || "No se pudo registrar.");
        }
        setGeneratedToken(j.raw_token);
        await fetchQueue();
      }
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : "Error al guardar estación.");
    } finally {
      setSavingStation(false);
    }
  }

  async function handleRegenerateToken() {
    if (!station || !confirm("¿Seguro que deseas regenerar el token? El agente en la PC deberá ser reconfigurado.")) {
      return;
    }
    setSavingStation(true);
    setAdminError(null);
    try {
      const res = await fetch(`/api/union/print/stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_token: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error al regenerar token.");
      setGeneratedToken(j.raw_token);
      await fetchQueue();
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : "Error al regenerar token.");
    } finally {
      setSavingStation(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. ENCABEZADO CON ESTADO DE ESTACIÓN */}
      <Card padding="1.25rem 1.5rem">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <Link
                href="/representacion"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.8125rem",
                  color: "var(--primary)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                <ArrowLeft size={14} /> Centro de Control
              </Link>
            </div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0, color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Printer size={26} weight="duotone" style={{ color: "var(--primary)" }} />
              Cola de Impresión Sindical
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
              Impresión automática y silenciosa para documentos oficiales de oficina.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button size="sm" variant="ghost" onClick={fetchQueue} loading={loading}>
              <ArrowsClockwise size={16} /> Actualizar
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStationNameInput(station?.name || "Oficina Sindical Delegación XXI");
                  setPrinterNameInput(station?.printer_name || "");
                  setGeneratedToken(null);
                  setAdminError(null);
                  setShowAdminModal(true);
                }}
              >
                <Gear size={16} /> {station ? "Configurar Estación" : "Registrar Estación"}
              </Button>
            )}
          </div>
        </div>

        {/* Franja de estado de la estación de impresión */}
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.875rem 1rem",
            backgroundColor: "var(--accent)",
            borderRadius: "var(--radius, 0.5rem)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: station?.isOnline ? "#16a34a" : "#dc2626",
                boxShadow: station?.isOnline ? "0 0 0 3px rgba(22, 163, 74, 0.2)" : "0 0 0 3px rgba(220, 38, 38, 0.2)",
              }}
            />
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {station ? station.name : "Sin estación de impresión registrada"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {station ? (
                  <>
                    Impresora: <strong>{station.printer_name || "Predeterminada de Windows"}</strong>
                    {station.last_seen_at && ` · Última conexión ${formatRelativeTimeEs(station.last_seen_at)}`}
                  </>
                ) : (
                  "Un administrador debe registrar la estación de la oficina sindical para habilitar la impresión automática."
                )}
              </div>
            </div>
          </div>

          <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>
            {station?.isOnline ? (
              <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <CheckCircle size={15} weight="fill" /> ESTACIÓN EN LÍNEA
              </span>
            ) : (
              <span style={{ color: "#dc2626", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Warning size={15} weight="fill" /> ESTACIÓN DESCONECTADA
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* 2. TABLERO DE TRABAJOS EN 2 COLUMNAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {/* COLUMNA 1: ACTIVIDAD EN VIVO (EN COLA + IMPRIMIENDO) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* TRABAJOS IMPRIMIENDO */}
          {printing.length > 0 && (
            <Card padding="1rem 1.25rem">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                  Imprimiendo en este momento ({printing.length})
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {printing.map((j) => (
                  <div
                    key={j.id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid var(--primary)",
                      borderRadius: "var(--radius, 0.375rem)",
                      backgroundColor: "rgba(37, 99, 235, 0.04)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)" }}>
                        {j.case_folio || "Expediente"} (Rev. {j.document_revision})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                        {j.worker_name ? `${j.worker_name} · ` : ""}
                        {j.copies} copia(s) · {j.status === "claimed" ? "Reclamado por estación..." : "Enviando a spooler..."}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)" }}>
                      En curso…
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TRABAJOS EN COLA */}
          <Card padding="1rem 1.25rem">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Clock size={16} weight="bold" /> En Cola ({queued.length})
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Orden FIFO</span>
            </div>

            {queued.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem" }}>
                No hay documentos en espera. La cola está despejada.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {queued.map((j, idx) => (
                  <div
                    key={j.id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius, 0.375rem)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        <span style={{ color: "var(--muted)", marginRight: "0.375rem" }}>#{idx + 1}</span>
                        {j.case_folio || "Expediente"} (Rev. {j.document_revision})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                        {j.worker_name ? `${j.worker_name} · ` : ""}
                        Enviado {formatRelativeTimeEs(j.created_at)} · {j.copies} copia(s)
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        backgroundColor: "var(--accent)",
                        borderRadius: "999px",
                        color: "var(--muted)",
                      }}
                    >
                      En cola
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* TRABAJOS FALLIDOS */}
          {failed.length > 0 && (
            <Card padding="1rem 1.25rem">
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.75rem" }}>
                <Warning size={18} weight="fill" style={{ color: "#dc2626" }} />
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#dc2626" }}>
                  Requieren atención ({failed.length})
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {failed.map((j) => (
                  <div
                    key={j.id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid rgba(220, 38, 38, 0.3)",
                      backgroundColor: "rgba(220, 38, 38, 0.03)",
                      borderRadius: "var(--radius, 0.375rem)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                        {j.case_folio || "Expediente"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.125rem" }}>
                        {j.error_message || "Error al enviar a impresora."}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={retryingJobId === j.id}
                      onClick={() => handleRetry(j.id)}
                    >
                      Reintentar
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* COLUMNA 2: IMPRESOS RECIENTES */}
        <div>
          <Card padding="1rem 1.25rem">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CheckCircle size={16} weight="bold" style={{ color: "#16a34a" }} /> Impresos Recientemente
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Últimos {recent.length}</span>
            </div>

            {recent.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem" }}>
                No hay historial de impresiones recientes en esta sesión.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {recent.map((j) => (
                  <div
                    key={j.id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius, 0.375rem)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                        {j.case_folio || "Expediente"} (Rev. {j.document_revision})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                        {j.worker_name ? `${j.worker_name} · ` : ""}
                        {j.copies} copia(s)
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#16a34a" }}>
                        ✓ Impreso
                      </span>
                      {j.printed_at && (
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                          {formatRelativeTimeEs(j.printed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 3. MODAL DE ADMINISTRACIÓN DE ESTACIÓN (SOLO UNION ADMIN) */}
      {showAdminModal && (
        <div
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
              borderRadius: "var(--radius, 0.5rem)",
              maxWidth: "520px",
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                {station ? "Configurar Estación de Impresión" : "Registrar Nueva Estación"}
              </h2>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {adminError && (
              <div style={{ padding: "0.75rem", backgroundColor: "rgba(220, 38, 38, 0.1)", color: "#dc2626", borderRadius: "4px", fontSize: "0.8125rem" }}>
                {adminError}
              </div>
            )}

            {generatedToken ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ padding: "0.75rem", backgroundColor: "rgba(22, 163, 74, 0.1)", color: "#15803d", borderRadius: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
                  ✓ Estación registrada. Guarda este secreto en la PC de la oficina.
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                  Este token se muestra <strong>UNA SOLA VEZ</strong>. Copia y pégalo en la configuración de La Veinte Print Agent:
                </p>
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "var(--accent)",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "0.8125rem",
                    wordBreak: "break-all",
                    userSelect: "all",
                  }}
                >
                  {generatedToken}
                </div>
                <Button
                  variant="primary"
                  onClick={() => copyToClipboard(generatedToken)}
                  fullWidth
                >
                  <Copy size={16} /> {copiedToken ? "¡Copiado!" : "Copiar Token Secreto"}
                </Button>
                <Button variant="ghost" onClick={() => setShowAdminModal(false)} fullWidth>
                  Listo, ya lo configuré
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <Input
                  label="Nombre de la estación"
                  value={stationNameInput}
                  onChange={(e) => setStationNameInput(e.target.value)}
                  placeholder="Ej. Oficina Sindical Delegación XXI"
                />

                <Input
                  label="Nombre de la impresora en Windows"
                  value={printerNameInput}
                  onChange={(e) => setPrinterNameInput(e.target.value)}
                  placeholder="Ej. HP LaserJet Pro M501dn (A7CD7F)"
                />
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "-0.5rem" }}>
                  Debe coincidir exactamente con el nombre instalado en Windows. Si se deja vacío se usará la predeterminada.
                </span>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <Button
                    variant="primary"
                    loading={savingStation}
                    onClick={handleCreateOrUpdateStation}
                    fullWidth
                  >
                    Guardar
                  </Button>
                  {station && (
                    <Button
                      variant="secondary"
                      loading={savingStation}
                      onClick={handleRegenerateToken}
                      fullWidth
                    >
                      Regenerar Secreto
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setShowAdminModal(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
