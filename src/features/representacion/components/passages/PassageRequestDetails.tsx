"use client";

import { Input } from "@/shared/components/ui/Input";
import styles from "./PassageWizard.module.css";

export interface PassageRequestDetailsProps {
  ooad: string;
  onOoadChange: (v: string) => void;
  requestDate: string;
  onRequestDateChange: (v: string) => void;
  controlNumber: string;
  onControlNumberChange: (v: string) => void;
  disabled?: boolean;
}

export function PassageRequestDetails({
  ooad,
  onOoadChange,
  requestDate,
  onRequestDateChange,
  controlNumber,
  onControlNumberChange,
  disabled = false,
}: PassageRequestDetailsProps): React.JSX.Element {
  return (
    <section className={styles.sectionCard} aria-labelledby="request-details-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="request-details-title" className={styles.sectionTitle}>
            Datos de la solicitud
          </h2>
          <p className={styles.sectionSubtitle}>
            Información del órgano desconcentrado, fecha de trámite y control interno.
          </p>
        </div>
      </div>

      <div className={styles.requestDetailsGrid}>
        {/* OOAD */}
        <div className={styles.fieldGroup}>
          <Input
            id="passage-ooad-input"
            label="OOAD (Delegación)"
            value={ooad}
            onChange={(e) => onOoadChange(e.target.value)}
            disabled={disabled}
          />
          <span className={styles.fieldHelper}>Órgano de Operación Administrativa Desconcentrada</span>
        </div>

        {/* Fecha de solicitud */}
        <div className={styles.fieldGroup}>
          <Input
            id="passage-request-date-input"
            label="Fecha de solicitud"
            type="date"
            value={requestDate}
            onChange={(e) => onRequestDateChange(e.target.value)}
            disabled={disabled}
            required
          />
          <span className={styles.fieldHelper}>Fecha en que se presenta formalmente</span>
        </div>

        {/* Número de control */}
        <div className={styles.fieldGroup}>
          <Input
            id="passage-control-number-input"
            label="Número de control"
            placeholder="Pendiente"
            value={controlNumber}
            onChange={(e) => onControlNumberChange(e.target.value)}
            disabled={disabled}
          />
          <span className={styles.fieldHelper}>Opcional. Si aún no existe, déjalo vacío.</span>
        </div>
      </div>
    </section>
  );
}
