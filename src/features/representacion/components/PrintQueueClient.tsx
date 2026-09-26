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
  DownloadSimple,
  Key,
  Desktop,
  CaretDown,
  CaretUp,
  Info,
} from "@phosphor-icons/react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTimeEs } from "../lib/dashboard-format";
import { getPrintableDocumentLabel } from "../lib/print-document-types";

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

  // Detección de Windows y Guía de instalación
  const [isWindows] = useState(() => (typeof navigator !== "undefined" ? /Win/i.test(navigator.userAgent) : true));
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isCheckingDownload, setIsCheckingDownload] = useState(false);

  // Modal de vinculación por código de 6 dígitos
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollCode, setEnrollCode] = useState<{ code: string; formatted: string; expires_at: string } | null>(null);
  const [enrollRemainingSec, setEnrollRemainingSec] = useState<number>(0);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [stationJustConnected, setStationJustConnected] = useState(false);
  const [copiedEnrollCode, setCopiedEnrollCode] = useState(false);

  // Modal de administración manual de estación (modo avanzado para admins)
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
          setStationJustConnected(true);
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [delegationId, fetchQueue]);

  // Temporizador regresivo para el código de vinculación de 6 dígitos
  useEffect(() => {
    if (enrollRemainingSec <= 0) return;
    const timer = setInterval(() => {
      setEnrollRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [enrollRemainingSec]);

  function formatRemaining(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  async function handleOpenEnrollModal() {
    setShowEnrollModal(true);
    setEnrollLoading(true);
    setEnrollError(null);
    setStationJustConnected(false);
    setCopiedEnrollCode(false);

    try {
      const res = await fetch("/api/union/print/enrollment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegation_id: delegationId,
          station_name: station?.name || "Oficina Sindical Delegación XXI",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar el código de vinculación.");
      }
      setEnrollCode({
        code: data.code,
        formatted: data.formatted,
        expires_at: data.expires_at,
      });
      const diffSec = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setEnrollRemainingSec(diffSec);
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : "Error al generar código.");
    } finally {
      setEnrollLoading(false);
    }
  }

  function copyEnrollCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedEnrollCode(true);
    setTimeout(() => setCopiedEnrollCode(false), 2500);
  }

  async function handleDownloadInstaller(e: React.MouseEvent) {
    e.preventDefault();
    setDownloadError(null);
    setIsCheckingDownload(true);
    try {
      const res = await fetch("/api/downloads/print-agent/windows?check=true");
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.available || !data?.download_url) {
        setDownloadError(
          data?.error ||
            "No fue posible descargar La Veinte Print en este momento. El instalador todavía no está disponible."
        );
        return;
      }

      window.location.href = data.download_url;
    } catch {
      setDownloadError(
        "No fue posible descargar La Veinte Print en este momento. El instalador todavía no está disponible."
      );
    } finally {
      setIsCheckingDownload(false);
    }
  }

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

      {/* 2. TARJETA DE INSTALACIÓN Y VINCULACIÓN EN 1 CLIC (WINDOWS) */}
      <Card
        padding="1.25rem 1.5rem"
        style={{
          border: "1px solid rgba(37, 99, 235, 0.2)",
          background: "linear-gradient(180deg, #ffffff 0%, rgba(37, 99, 235, 0.02) 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem" }}>
          <div style={{ maxWidth: "620px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                color: "var(--primary)",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              <Desktop size={14} weight="bold" /> INSTALADOR WINDOWS EN 1 CLIC · CERO CONSOLAS
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.375rem 0", color: "var(--fg)" }}>
              La Veinte Print para Windows
            </h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.45 }}>
              Agente oficial de impresión para la PC física de la oficina sindical. Se ejecuta silenciosamente en segundo plano junto al reloj, inicia automáticamente con Windows y manda las impresiones a la impresora sin mostrar ventanas de comandos.
            </p>
            {!isWindows && (
              <div style={{ marginTop: "0.625rem", fontSize: "0.75rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Info size={14} /> Estás visitando desde un dispositivo no-Windows. Descarga el instalador directamente en la PC con Windows de la oficina.
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
              <Button
                variant="primary"
                size="md"
                onClick={handleDownloadInstaller}
                loading={isCheckingDownload}
              >
                <DownloadSimple size={18} weight="bold" /> Descargar instalador .exe
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleOpenEnrollModal}
              >
                <Key size={18} weight="bold" /> Vincular con código (6 dígitos)
              </Button>
            </div>
            {downloadError && (
              <div
                role="alert"
                style={{
                  marginTop: "0.25rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius, 0.375rem)",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: "0.8125rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  maxWidth: "520px",
                }}
              >
                <Warning size={16} weight="fill" style={{ flexShrink: 0 }} />
                <span>{downloadError}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowInstallGuide(!showInstallGuide)}
              style={{
                background: "none",
                border: "none",
                padding: "0.25rem 0",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--primary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              {showInstallGuide ? <CaretUp size={12} /> : <CaretDown size={12} />}
              {showInstallGuide ? "Ocultar guía de instalación" : "Ver guía rápida en 3 pasos"}
            </button>
          </div>
        </div>

        {/* Guía en 3 pasos desplegable */}
        {showInstallGuide && (
          <div
            style={{
              marginTop: "1.25rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            <div style={{ padding: "0.75rem", borderRadius: "var(--radius, 0.375rem)", backgroundColor: "var(--accent)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--primary)", marginBottom: "0.25rem" }}>
                1. Descarga el archivo
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Descarga <strong>LaVeintePrint-Setup.exe</strong> y ejecútalo con doble clic. Se instala en 5 segundos sin pedir contraseñas de administrador.
              </p>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--radius, 0.375rem)", backgroundColor: "var(--accent)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--primary)", marginBottom: "0.25rem" }}>
                2. Introduce el código
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Pulsa <strong>Vincular con código</strong> en esta página y escribe los 6 números que verás en pantalla dentro del asistente.
              </p>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--radius, 0.375rem)", backgroundColor: "var(--accent)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--primary)", marginBottom: "0.25rem" }}>
                3. ¡Listo para imprimir!
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Confirma la impresora física de la oficina. El programa queda activo en la barra de tareas junto al reloj y prenderá solo con Windows.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* 3. TABLERO DE TRABAJOS EN 2 COLUMNAS */}
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
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.025em", marginBottom: "0.125rem" }}>
                        {getPrintableDocumentLabel(j.document_type)}
                      </div>
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
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.025em", marginBottom: "0.125rem" }}>
                        {getPrintableDocumentLabel(j.document_type)}
                      </div>
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
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.025em", marginBottom: "0.125rem" }}>
                        {getPrintableDocumentLabel(j.document_type)}
                      </div>
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
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.025em", marginBottom: "0.125rem" }}>
                        {getPrintableDocumentLabel(j.document_type)}
                      </div>
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

      {/* 4. MODAL DE VINCULACIÓN POR CÓDIGO DE 6 DÍGITOS */}
      {showEnrollModal && (
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
              borderRadius: "var(--radius, 0.75rem)",
              maxWidth: "460px",
              width: "100%",
              padding: "1.75rem",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                Vincular Estación de Impresión
              </h2>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {stationJustConnected ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.875rem", padding: "1rem 0" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "rgba(22, 163, 74, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#16a34a",
                  }}
                >
                  <CheckCircle size={36} weight="fill" />
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                  ¡Estación Vinculada con Éxito!
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.45 }}>
                  La computadora física de la oficina sindical ya está en línea y configurada. Cuando envíes una licencia a imprimir, saldrá de inmediato por la impresora.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setShowEnrollModal(false)}
                  fullWidth
                  style={{ marginTop: "0.5rem" }}
                >
                  Entendido, volver a la cola
                </Button>
              </div>
            ) : enrollLoading ? (
              <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
                <LoadingSpinner text="Generando código seguro de vinculación…" />
              </div>
            ) : enrollError ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ padding: "0.75rem", backgroundColor: "rgba(220, 38, 38, 0.1)", color: "#dc2626", borderRadius: "4px", fontSize: "0.8125rem" }}>
                  {enrollError}
                </div>
                <Button variant="secondary" onClick={handleOpenEnrollModal} fullWidth>
                  Reintentar generación
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.45 }}>
                  Abre el instalador <strong>La Veinte Print</strong> en la PC de la oficina e introduce el siguiente código de 6 dígitos:
                </p>

                <div
                  style={{
                    padding: "1.25rem 1rem",
                    borderRadius: "var(--radius, 0.5rem)",
                    backgroundColor: "rgba(37, 99, 235, 0.05)",
                    border: "2px dashed rgba(37, 99, 235, 0.4)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "2.5rem",
                      fontWeight: 800,
                      fontFamily: "monospace",
                      letterSpacing: "0.2em",
                      color: "var(--primary)",
                    }}
                  >
                    {enrollCode?.formatted || "--- ---"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", color: "var(--muted)" }}>
                  {enrollRemainingSec > 0 ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={14} /> Válido por: <strong>{formatRemaining(enrollRemainingSec)}</strong>
                    </span>
                  ) : (
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                      Código expirado
                    </span>
                  )}
                  <span>Un solo uso</span>
                </div>

                <div
                  style={{
                    padding: "0.625rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--accent)",
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.375rem",
                  }}
                >
                  <ArrowsClockwise size={14} className="animate-spin" />
                  Esperando conexión desde la computadora de la oficina…
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {enrollRemainingSec > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => copyEnrollCode(enrollCode?.code || "")}
                      fullWidth
                    >
                      <Copy size={16} /> {copiedEnrollCode ? "¡Copiado!" : "Copiar Código"}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleOpenEnrollModal}
                      fullWidth
                    >
                      Generar Nuevo Código
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setShowEnrollModal(false)}
                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    Cerrar
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
