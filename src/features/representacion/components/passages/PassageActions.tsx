"use client";

import { Button } from "@/shared/components/ui/Button";
import { DownloadSimple, FileText, CheckCircle, Info } from "@phosphor-icons/react";
import styles from "./PassageWizard.module.css";

export interface PassageActionsProps {
  concept: "026" | "027";
  caseId: string | null;
  folio: string | null;
  isDirty: boolean;
  busy: boolean;
  downloading: boolean;
  onPrepare: () => void;
  onDownload: () => void;
}

export function PassageActions({
  concept,
  caseId,
  folio,
  isDirty,
  busy,
  downloading,
  onPrepare,
  onDownload,
}: PassageActionsProps): React.JSX.Element {
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
      {caseId && folio && !isDirty ? (
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

      {/* Botones de acción principales */}
      <div className={styles.actionsBar}>
        {caseId && !isDirty ? (
          <Button
            className={styles.fullWidthBtn}
            onClick={onDownload}
            loading={downloading}
            disabled={busy}
            aria-label={`Descargar formato oficial ${concept}`}
          >
            <DownloadSimple size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            {concept === "026" ? "Descargar formato 026" : "Descargar formato 027"}
          </Button>
        ) : (
          <Button
            className={styles.fullWidthBtn}
            onClick={onPrepare}
            loading={busy}
            disabled={downloading}
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
