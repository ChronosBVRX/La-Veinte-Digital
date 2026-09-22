"use client";

import { Button } from "@/shared/components/ui/Button";
import { DownloadSimple, FileText, CheckCircle, Info, Printer } from "@phosphor-icons/react";
import styles from "./PassageWizard.module.css";

export interface PassageActionsProps {
  concept: "026" | "027";
  caseId: string | null;
  folio: string | null;
  isDirty: boolean;
  busy: boolean;
  downloading: boolean;
  printing?: boolean;
  printSuccessMessage?: string | null;
  onPrepare: () => void;
  onDownload: () => void;
  onPrint?: () => void;
}

export function PassageActions({
  concept,
  caseId,
  folio,
  isDirty,
  busy,
  downloading,
  printing = false,
  printSuccessMessage = null,
  onPrepare,
  onDownload,
  onPrint,
}: PassageActionsProps): React.JSX.Element {
  const isReady = Boolean(caseId && !isDirty);
  const isAnyActionBusy = busy || downloading || printing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Alerta si el formulario fue modificado tras preparar */}
      {isDirty ? (
        <div className={`${styles.alertBox} ${styles.alertDirty}`} role="status">
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700 }}>
            <Info size={16} weight="bold" />
            Cambios detectados
          </div>
          <div>
            Modificaste información después de preparar el trámite. Prepara nuevamente la solicitud
            para actualizar el documento oficial.
          </div>
        </div>
      ) : null}

      {/* Banner de Solicitud Preparada con Folio */}
      {isReady && folio ? (
        <div className={`${styles.alertBox} ${styles.alertSuccess}`} role="status">
          <div className={styles.alertSuccessTitle} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CheckCircle size={20} weight="fill" />
            Solicitud preparada correctamente
          </div>
          <div>
            Expediente <strong>{folio}</strong> listo. El formato oficial se generó con los datos
            verificados y se encuentra disponible para descargar e imprimir.
          </div>
        </div>
      ) : null}

      {/* Banner de Confirmación de Impresión Enviada */}
      {printSuccessMessage && !isDirty ? (
        <div className={`${styles.alertBox} ${styles.alertSuccess}`} role="status">
          <div className={styles.alertSuccessTitle} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Printer size={20} weight="fill" />
            Enviado a impresora
          </div>
          <div>{printSuccessMessage}</div>
        </div>
      ) : null}

      {/* Botones de acción principales */}
      <div className={styles.actionsBar}>
        {isReady ? (
          <>
            <Button
              className={styles.fullWidthBtn}
              variant="secondary"
              onClick={onDownload}
              loading={downloading}
              disabled={isAnyActionBusy}
              aria-label={`Descargar formato oficial ${concept}`}
            >
              <DownloadSimple size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              {concept === "026" ? "Descargar formato 026" : "Descargar formato 027"}
            </Button>
            {onPrint ? (
              <Button
                className={styles.fullWidthBtn}
                variant="primary"
                onClick={onPrint}
                loading={printing}
                disabled={isAnyActionBusy}
                aria-label={`Mandar a imprimir pasaje ${concept}`}
              >
                <Printer size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
                Mandar a imprimir
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            className={styles.fullWidthBtn}
            onClick={onPrepare}
            loading={busy}
            disabled={isAnyActionBusy}
            aria-label="Preparar solicitud de pasaje"
          >
            <FileText size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            Preparar solicitud
          </Button>
        )}
      </div>
    </div>
  );
}
