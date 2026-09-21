"use client";

import { Button } from "@/shared/components/ui/Button";
import { DownloadSimple, FileText, CheckCircle, Clock } from "@phosphor-icons/react";
import type { UnionWorkerOption } from "../WorkerPicker";
import { getWorkerDisplayName } from "../WorkerPicker";
import styles from "./PassageWizard.module.css";

export interface PassageSummarySidebarProps {
  concept: "026" | "027";
  worker: UnionWorkerOption | null;
  requestDate: string;
  caseId: string | null;
  folio: string | null;
  isDirty: boolean;
  busy: boolean;
  downloading: boolean;
  onPrepare: () => void;
  onDownload: () => void;
}

export function PassageSummarySidebar({
  concept,
  worker,
  requestDate,
  caseId,
  folio,
  isDirty,
  busy,
  downloading,
  onPrepare,
  onDownload,
}: PassageSummarySidebarProps): React.JSX.Element {
  const isReadyToDownload = Boolean(caseId && !isDirty);

  return (
    <aside className={styles.summaryPanel} aria-labelledby="summary-panel-title">
      <div className={styles.summaryHeader}>
        <h3 id="summary-panel-title" className={styles.summaryTitle}>
          Resumen del trámite
        </h3>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            background: isReadyToDownload ? "#dcfce7" : "#f1f5f9",
            color: isReadyToDownload ? "#166534" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          {isReadyToDownload ? (
            <>
              <CheckCircle size={14} weight="fill" />
              Listo
            </>
          ) : (
            <>
              <Clock size={14} weight="bold" />
              Borrador
            </>
          )}
        </span>
      </div>

      <div className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryRowLabel}>Concepto</span>
          <span className={styles.summaryRowValue}>
            {concept === "026" ? "026 (Extramuros)" : "027 (Pasajes)"}
          </span>
        </div>

        <div className={styles.summaryRow}>
          <span className={styles.summaryRowLabel}>Trabajador</span>
          <span className={styles.summaryRowValue} title={worker ? getWorkerDisplayName(worker) : undefined}>
            {worker ? getWorkerDisplayName(worker) : "No seleccionado"}
          </span>
        </div>

        {worker ? (
          <div className={styles.summaryRow}>
            <span className={styles.summaryRowLabel}>Matrícula</span>
            <span className={styles.summaryRowValue}>{worker.employee_number}</span>
          </div>
        ) : null}

        <div className={styles.summaryRow}>
          <span className={styles.summaryRowLabel}>Fecha</span>
          <span className={styles.summaryRowValue}>{requestDate || "—"}</span>
        </div>

        {folio ? (
          <div className={styles.summaryRow}>
            <span className={styles.summaryRowLabel}>Folio</span>
            <span className={styles.summaryRowValue} style={{ color: "var(--primary)" }}>
              {folio}
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        {isReadyToDownload ? (
          <Button
            style={{ width: "100%", minHeight: 44 }}
            onClick={onDownload}
            loading={downloading}
            disabled={busy}
            aria-label={`Descargar formato oficial ${concept}`}
          >
            <DownloadSimple size={18} weight="bold" style={{ marginRight: "0.35rem" }} />
            {concept === "026" ? "Descargar 026" : "Descargar 027"}
          </Button>
        ) : (
          <Button
            style={{ width: "100%", minHeight: 44 }}
            onClick={onPrepare}
            loading={busy}
            disabled={downloading}
            aria-label="Preparar solicitud de pasaje"
          >
            <FileText size={18} weight="bold" style={{ marginRight: "0.35rem" }} />
            Preparar solicitud
          </Button>
        )}
      </div>
    </aside>
  );
}
