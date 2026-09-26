"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { WorkerPicker, type UnionWorkerOption, getWorkerDisplayName } from "../WorkerPicker";
import { buildLockerReceiptPdf } from "@/features/representacion/services/locker-receipt-pdf";
import type { LockerItem } from "./LockerDesktopTable";

export function LockerRenewalWizard({
  initialLockerId,
}: {
  initialLockerId?: string | null;
}): React.JSX.Element {
  const [, startTransition] = useTransition();

  // Modo de búsqueda: 'worker' | 'locker'
  const [searchMode, setSearchMode] = useState<"worker" | "locker">("worker");

  // Estado del Trabajador
  const [selectedWorker, setSelectedWorker] = useState<UnionWorkerOption | null>(null);
  const [phone, setPhone] = useState("");

  // Estado del Casillero
  const [lockerNumberQuery, setLockerNumberQuery] = useState("");
  const [searchingLocker, setSearchingLocker] = useState(false);
  const [lockerSearchError, setLockerSearchError] = useState<string | null>(null);
  const [selectedLocker, setSelectedLocker] = useState<LockerItem | null>(null);

  // Verificación de casillero del trabajador
  const [loadingWorkerLocker, setLoadingWorkerLocker] = useState(false);

  // Parámetros de la Actualización
  const [movementType, setMovementType] = useState<"actualizacion_2026" | "asignacion_nueva" | "cambio" | "baja">("actualizacion_2026");
  const [condition, setCondition] = useState<"ok" | "maintenance" | "damaged" | "blocked">("ok");
  const [physicalCode, setPhysicalCode] = useState("");
  const [observations, setObservations] = useState("");

  // Estado de Envío / Guardado
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Estado de Éxito y Folio Emitido
  const [createdCase, setCreatedCase] = useState<{
    id: string;
    folio: string;
    lockerNumber: string;
    workerName: string;
    delegationId: string;
  } | null>(null);

  // Estado de Impresión en la Oficina Sindical
  const [autoPrintStatus, setAutoPrintStatus] = useState<"idle" | "preparing" | "queued" | "printing" | "printed" | "failed">("idle");
  const [autoPrintError, setAutoPrintError] = useState<string | null>(null);
  const [lastPrintedTime, setLastPrintedTime] = useState<string | null>(null);

  // Cargar casillero inicial si viene por query param
  useEffect(() => {
    if (!initialLockerId) return;
    fetch(`/api/union/lockers?locker_id=${initialLockerId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.locker) {
          const lk = data.locker as LockerItem;
          setSelectedLocker(lk);
          setCondition((lk.condition as "ok" | "maintenance" | "damaged" | "blocked") || "ok");
          setPhysicalCode(lk.physical_code || "");
          if (lk.active_assignment?.union_workers) {
            const w = lk.active_assignment.union_workers as UnionWorkerOption;
            setSelectedWorker(w);
            setPhone(w.phone || "");
          }
        }
      })
      .catch(() => {});
  }, [initialLockerId]);

  // Manejador cuando se selecciona o deselecciona un trabajador
  function handleSelectWorker(w: UnionWorkerOption | null): void {
    setSelectedWorker(w);
    if (!w) {
      if (!initialLockerId) setSelectedLocker(null);
      setPhone("");
      return;
    }

    setPhone(w.phone || "");
    setLoadingWorkerLocker(true);

    fetch(`/api/union/lockers?check_worker_id=${w.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((j: { hasActiveLocker?: boolean; currentLockerNumber?: string; lockerId?: string }) => {
        if (j.hasActiveLocker && j.currentLockerNumber) {
          fetch(`/api/union/lockers?q=${encodeURIComponent(j.currentLockerNumber)}&pageSize=10`, { cache: "no-store" })
            .then((r) => r.json())
            .then((resData: { lockers?: LockerItem[] }) => {
              const matched = (resData.lockers || []).find(
                (l) => l.locker_number.toLowerCase() === j.currentLockerNumber?.toLowerCase(),
              );
              if (matched) {
                setSelectedLocker(matched);
                setCondition((matched.condition as "ok" | "maintenance" | "damaged" | "blocked") || "ok");
                setPhysicalCode(matched.physical_code || "");
                setMovementType("actualizacion_2026");
              }
            })
            .catch(() => {});
        } else {
          setSelectedLocker(null);
          setMovementType("asignacion_nueva");
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingWorkerLocker(false);
      });
  }

  // Buscar casillero por número tecleado
  async function handleSearchLockerByNumber(): Promise<void> {
    const trimmed = lockerNumberQuery.trim();
    if (!trimmed) return;

    setSearchingLocker(true);
    setLockerSearchError(null);

    try {
      const res = await fetch(`/api/union/lockers?q=${encodeURIComponent(trimmed)}&pageSize=10`, { cache: "no-store" });
      const j = (await res.json()) as { lockers?: LockerItem[] };
      const found = (j.lockers ?? []).find(
        (l) => l.locker_number.toLowerCase() === trimmed.toLowerCase(),
      );

      if (!found) {
        setSelectedLocker(null);
        setLockerSearchError(`No se encontró ningún casillero con el número "${trimmed}".`);
        return;
      }

      setSelectedLocker(found);
      setCondition((found.condition as "ok" | "maintenance" | "damaged" | "blocked") || "ok");
      setPhysicalCode(found.physical_code || "");

      // Si el casillero tiene asignación activa con trabajador vinculado, seleccionarlo
      if (found.active_assignment?.union_workers) {
        const w = found.active_assignment.union_workers as UnionWorkerOption;
        setSelectedWorker(w);
        setPhone(w.phone || "");
        setMovementType("actualizacion_2026");
      }
    } catch {
      setLockerSearchError("Error al consultar el número de casillero.");
    } finally {
      setSearchingLocker(false);
    }
  }

  // Enviar y Registrar Actualización 2026
  async function handleSubmitRenewal(): Promise<void> {
    if (!selectedWorker || !selectedLocker) {
      setSubmitError("Debes seleccionar tanto al trabajador como al casillero.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/union/lockers/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: selectedWorker.id,
          locker_id: selectedLocker.id,
          phone: phone.trim(),
          movement_type: movementType,
          condition,
          physical_code: physicalCode.trim(),
          observations: observations.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo completar la actualización.");
      }

      const caseInfo = {
        id: data.case_id as string,
        folio: data.folio as string,
        lockerNumber: data.locker_number as string,
        workerName: data.worker_name as string,
        delegationId: (data.delegation_id as string) || "",
      };

      setCreatedCase(caseInfo);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Error al registrar actualización.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Mandar trabajo a la impresora de la oficina sindical vía Print Agent
  async function handleSendToOfficePrinter(): Promise<void> {
    if (!createdCase) return;

    setAutoPrintError(null);
    setAutoPrintStatus("preparing");

    try {
      const res = await fetch("/api/union/print/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: createdCase.id, copies: 1 }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "No se pudo enviar a la impresora de la oficina.");
      }

      setAutoPrintStatus("queued");

      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/union/print/jobs?delegation_id=${j.job.delegation_id}`, { cache: "no-store" });
          if (!checkRes.ok) return;
          const checkData = await checkRes.json();
          if (!checkData.success) return;

          const isPrinted = (checkData.recent as Array<{ id: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isPrinted) {
            setAutoPrintStatus("printed");
            setLastPrintedTime(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
            clearInterval(pollInterval);
            return;
          }

          const isPrinting = (checkData.printing as Array<{ id: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isPrinting) {
            setAutoPrintStatus("printing");
            return;
          }

          const isFailed = (checkData.failed as Array<{ id: string; error_message?: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isFailed) {
            setAutoPrintStatus("failed");
            setAutoPrintError(isFailed.error_message || "La impresora física no pudo completar el trabajo.");
            clearInterval(pollInterval);
            return;
          }
        } catch {
          // continuar sondeo
        }
      }, 2500);

      setTimeout(() => clearInterval(pollInterval), 90000);
    } catch (err: unknown) {
      setAutoPrintStatus("failed");
      setAutoPrintError(err instanceof Error ? err.message : "Error al enviar a la impresora.");
    }
  }

  // Generar e imprimir directamente desde el navegador (con soporte de descarga)
  function handleDirectBrowserPrint(): void {
    if (!createdCase || !selectedWorker || !selectedLocker) return;

    try {
      const dateFormatted = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date());

      const doc = buildLockerReceiptPdf({
        folio: createdCase.folio,
        dateFormatted,
        worker: {
          name: createdCase.workerName,
          employeeNumber: selectedWorker.employee_number,
          category: selectedWorker.category,
          assignment: selectedWorker.assignment,
          turn: selectedWorker.turn,
          phone: phone.trim() || selectedWorker.phone || "",
        },
        locker: {
          lockerNumber: createdCase.lockerNumber,
          zoneName: selectedLocker.zone?.name || "Área General",
          bankName: selectedLocker.bank?.name || "Mueble",
          physicalCode: physicalCode.trim() || selectedLocker.physical_code || undefined,
          condition,
          movementType,
          observations: observations.trim() || undefined,
        },
      });

      doc.autoPrint();
      const blobUrl = doc.output("bloburl");
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl.toString();
      document.body.appendChild(iframe);

      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {
          window.open(blobUrl.toString(), "_blank");
        }
      }, 500);
    } catch (err) {
      alert("No se pudo generar el PDF para impresión directa: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Descargar archivo PDF
  function handleDownloadPdf(): void {
    if (!createdCase || !selectedWorker || !selectedLocker) return;

    try {
      const dateFormatted = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date());

      const doc = buildLockerReceiptPdf({
        folio: createdCase.folio,
        dateFormatted,
        worker: {
          name: createdCase.workerName,
          employeeNumber: selectedWorker.employee_number,
          category: selectedWorker.category,
          assignment: selectedWorker.assignment,
          turn: selectedWorker.turn,
          phone: phone.trim() || selectedWorker.phone || "",
        },
        locker: {
          lockerNumber: createdCase.lockerNumber,
          zoneName: selectedLocker.zone?.name || "Área General",
          bankName: selectedLocker.bank?.name || "Mueble",
          physicalCode: physicalCode.trim() || selectedLocker.physical_code || undefined,
          condition,
          movementType,
          observations: observations.trim() || undefined,
        },
      });

      doc.save(`recibo-casillero-${createdCase.folio}.pdf`);
    } catch (err) {
      alert("Error al descargar: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Reiniciar estado para atender al siguiente trabajador
  function handleResetForNextWorker(): void {
    startTransition(() => {
      setSelectedWorker(null);
      setSelectedLocker(null);
      setLockerNumberQuery("");
      setPhone("");
      setPhysicalCode("");
      setObservations("");
      setCondition("ok");
      setMovementType("actualizacion_2026");
      setSubmitError(null);
      setCreatedCase(null);
      setAutoPrintStatus("idle");
      setAutoPrintError(null);
      setLastPrintedTime(null);
    });
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Cabecera y Navegación de Regreso */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Link
            href="/representacion/lockers"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "var(--muted)",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
          >
            ← Volver al Centro de Casilleros
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
              Programa de Actualización de Locker 2026
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0 0" }}>
              Censo, refrendo y emisión de acuse con folio y logotipo oficial SNTSS Sección XX.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/representacion/impresion" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm">
                🖨️ Monitor de Impresora
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* CASO COMPLETADO CON ÉXITO: Pantalla de Impresión y Entrega de Recibo */}
      {createdCase ? (
        <Card padding="2rem" style={{ border: "2px solid #bbf7d0", backgroundColor: "#f0fdf4" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#dcfce7",
                color: "#16a34a",
                fontSize: "1.75rem",
                marginBottom: "0.75rem",
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#166534", margin: "0 0 0.5rem 0" }}>
              ¡Actualización Registrada Exitosamente!
            </h2>
            <p style={{ color: "#15803d", fontSize: "0.9375rem", margin: 0 }}>
              Se ha generado el expediente con folio oficial y el resguardo 2026 ha quedado activo en el sistema.
            </p>

            <div
              style={{
                display: "inline-block",
                margin: "1.25rem auto",
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--card)",
                borderRadius: "var(--radius)",
                border: "1px solid #86efac",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Folio Oficial de Resguardo
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#dc2626", letterSpacing: "0.5px" }}>
                {createdCase.folio}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--fg)", marginTop: "0.25rem" }}>
                <strong>{createdCase.workerName}</strong> — Casillero <strong>No. {createdCase.lockerNumber}</strong>
              </div>
            </div>
          </div>

          {/* Opciones de Salida a Impresora */}
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--fg)", marginTop: 0, marginBottom: "0.75rem" }}>
              Emitir e Imprimir Recibo Duplicado (Tanto Trabajador / Tanto Sindicato)
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
              El recibo incluye el logotipo oficial SNTSS, código QR de validación y ambos tantos en una sola hoja tamaño carta.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              {/* Botón 1: Enviar a la impresora física de la oficina */}
              <Button
                variant="primary"
                onClick={handleSendToOfficePrinter}
                disabled={autoPrintStatus === "preparing" || autoPrintStatus === "queued" || autoPrintStatus === "printing"}
              >
                {autoPrintStatus === "preparing" && "Preparando documento…"}
                {autoPrintStatus === "queued" && "Enviado a impresora (En cola)…"}
                {autoPrintStatus === "printing" && "Imprimiendo en oficina…"}
                {autoPrintStatus === "printed" && "✓ Impreso en oficina"}
                {autoPrintStatus === "failed" && "Reintentar impresora de oficina"}
                {autoPrintStatus === "idle" && "🖨️ Mandar a Impresora de la Oficina"}
              </Button>

              {/* Botón 2: Diálogo nativo de impresión del navegador */}
              <Button variant="secondary" onClick={handleDirectBrowserPrint}>
                📄 Imprimir en Navegador
              </Button>

              {/* Botón 3: Descargar PDF */}
              <Button variant="ghost" onClick={handleDownloadPdf}>
                ⬇ Descargar PDF
              </Button>
            </div>

            {/* Mensajes de feedback de impresión en vivo */}
            {autoPrintStatus === "printed" && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "#16a34a", fontWeight: 500 }}>
                ✓ Documento enviado e impreso físicamente a las {lastPrintedTime}.
              </div>
            )}
            {autoPrintError && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "#dc2626" }}>
                ⚠ {autoPrintError} (Puedes usar &quot;Imprimir en Navegador&quot; como alternativa inmediata).
              </div>
            )}
          </div>

          {/* Botón para atender al siguiente trabajador */}
          <div style={{ textAlign: "center" }}>
            <Button variant="primary" size="md" onClick={handleResetForNextWorker}>
              👤 Atender Siguiente Trabajador
            </Button>
          </div>
        </Card>
      ) : (
        /* FORMULARIO DE VENTANILLA: Búsqueda y Actualización */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Tarjeta de Búsqueda Rápida */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--fg)" }}>
                Paso 1: Localizar Trabajador o Casillero
              </div>
              {/* Selector de Modo de Búsqueda */}
              <div style={{ display: "flex", gap: "0.25rem", background: "var(--accent)", padding: "0.25rem", borderRadius: "0.375rem" }}>
                <button
                  type="button"
                  onClick={() => setSearchMode("worker")}
                  style={{
                    border: "none",
                    background: searchMode === "worker" ? "var(--card)" : "transparent",
                    color: searchMode === "worker" ? "var(--primary)" : "var(--muted)",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: searchMode === "worker" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  Buscar por Trabajador / Matrícula
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("locker")}
                  style={{
                    border: "none",
                    background: searchMode === "locker" ? "var(--card)" : "transparent",
                    color: searchMode === "locker" ? "var(--primary)" : "var(--muted)",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: searchMode === "locker" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  Buscar por No. de Casillero
                </button>
              </div>
            </div>

            {searchMode === "worker" ? (
              <div>
                <WorkerPicker
                  label="Escribe la matrícula o apellido del trabajador:"
                  selected={selectedWorker}
                  onSelect={handleSelectWorker}
                />
                {loadingWorkerLocker && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <LoadingSpinner text="Consultando asignación de casillero..." />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Número del casillero (ej. 145 o 45-B):"
                      value={lockerNumberQuery}
                      onChange={(e) => setLockerNumberQuery(e.target.value)}
                      placeholder="Ej. 145"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchLockerByNumber();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleSearchLockerByNumber}
                    disabled={searchingLocker || !lockerNumberQuery.trim()}
                  >
                    {searchingLocker ? "Buscando…" : "Buscar Casillero"}
                  </Button>
                </div>

                {lockerSearchError && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#dc2626" }}>
                    {lockerSearchError}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Tarjeta de Datos y Actualización (Solo si se tiene seleccionado al trabajador o al casillero) */}
          {(selectedWorker || selectedLocker) && (
            <Card padding="1.5rem">
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--fg)", marginBottom: "1rem" }}>
                Paso 2: Verificar Datos de Resguardo y Contacto
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                {/* Bloque del Trabajador */}
                <div
                  style={{
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Datos del Trabajador
                  </div>
                  {selectedWorker ? (
                    <div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                        {getWorkerDisplayName(selectedWorker)}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Matrícula: <strong>{selectedWorker.employee_number}</strong>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                        Categoría: <strong>{selectedWorker.category || "N/A"}</strong>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                        Adscripción: <strong>{selectedWorker.assignment || "HGR No. 1"}</strong>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                        Turno: <strong>{selectedWorker.turn || "Ordinario"}</strong>
                      </div>

                      <div style={{ marginTop: "0.75rem" }}>
                        <Input
                          label="Teléfono de Contacto (Actualizable):"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ej. 443 123 4567"
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontStyle: "italic" }}>
                      Sin trabajador vinculado aún. Utiliza el buscador para asignarle a un trabajador.
                    </div>
                  )}
                </div>

                {/* Bloque del Casillero */}
                <div
                  style={{
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Datos del Casillero
                  </div>
                  {selectedLocker ? (
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#166534" }}>
                        Casillero No. {selectedLocker.locker_number}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Zona / Vestidor: <strong>{selectedLocker.zone?.name || "Área General"}</strong>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                        Mueble / Batería: <strong>{selectedLocker.bank?.name || "Sin bloque"}</strong>
                      </div>

                      <div style={{ marginTop: "0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                          Condición Física del Mueble:
                        </label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value as "ok" | "maintenance" | "damaged" | "blocked")}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--fg)",
                            fontSize: "0.875rem",
                          }}
                        >
                          <option value="ok">Buen Estado / Operativo</option>
                          <option value="maintenance">Requiere Reparación o Chapa</option>
                          <option value="damaged">Dañado / Con Falla Reportada</option>
                          <option value="blocked">Bloqueado Administrativamente</option>
                        </select>
                      </div>

                      <div style={{ marginTop: "0.75rem" }}>
                        <Input
                          label="Código Físico o Candado (Opcional):"
                          value={physicalCode}
                          onChange={(e) => setPhysicalCode(e.target.value)}
                          placeholder="Ej. Candado Yale 40mm / Chapa propia"
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontStyle: "italic" }}>
                      El trabajador no tiene casillero activo asignado. Busca y selecciona un casillero para asignárselo.
                    </div>
                  )}
                </div>
              </div>

              {/* Opciones Adicionales de la Actualización */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                    Tipo de Movimiento:
                  </label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as "actualizacion_2026" | "asignacion_nueva" | "cambio" | "baja")}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--fg)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="actualizacion_2026">Refrendo Anual 2026 (Mismo Casillero)</option>
                    <option value="asignacion_nueva">Asignación Nueva 2026</option>
                    <option value="cambio">Cambio / Reubicación de Casillero</option>
                    <option value="baja">Liberación / Entrega de Casillero</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Observaciones o Notas del Resguardo:"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Ej. Entrega llave física / Llave de repuesto en oficina"
                  />
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius)",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  ⚠ {submitError}
                </div>
              )}

              {/* Botón de Confirmación y Emisión */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmitRenewal}
                  disabled={isSubmitting || !selectedWorker || !selectedLocker}
                >
                  {isSubmitting ? "Registrando actualización…" : "✓ Confirmar Actualización y Emitir Recibo 2026"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
