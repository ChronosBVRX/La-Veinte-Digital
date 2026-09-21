"use client";

import { Input } from "@/shared/components/ui/Input";
import styles from "./PassageWizard.module.css";

export interface Passage026DetailsProps {
  extramuralFunctions: string;
  onExtramuralFunctionsChange: (v: string) => void;
  transferPeriod: string;
  onTransferPeriodChange: (v: string) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, boolean>;
}

export function Passage026Details({
  extramuralFunctions,
  onExtramuralFunctionsChange,
  transferPeriod,
  onTransferPeriodChange,
  disabled = false,
  fieldErrors = {},
}: Passage026DetailsProps): React.JSX.Element {
  return (
    <section className={styles.sectionCard} aria-labelledby="details-026-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="details-026-title" className={styles.sectionTitle}>
            Detalles de funciones extramuros (Concepto 026)
          </h2>
          <p className={styles.sectionSubtitle}>
            Describe las labores realizadas fuera de la unidad y el periodo de vigencia del traslado.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Funciones extramuros en Textarea multilínea */}
        <div className={styles.fieldGroup}>
          <label htmlFor="passage-extramural-textarea" className={styles.fieldLabel}>
            Funciones extramuros en el desempeño de sus labores
          </label>
          <textarea
            id="passage-extramural-textarea"
            className={`${styles.extramuralTextarea} ${
              fieldErrors.extramuralFunctions ? styles.inputInvalid : ""
            }`}
            placeholder="Describe detalladamente las funciones realizadas fuera del centro habitual de adscripción…"
            rows={3}
            value={extramuralFunctions}
            onChange={(e) => onExtramuralFunctionsChange(e.target.value)}
            disabled={disabled}
            aria-invalid={fieldErrors.extramuralFunctions ? "true" : undefined}
          />
          <span className={styles.fieldHelper}>
            Texto que aparecerá en el recuadro principal del formato oficial 026.
          </span>
        </div>

        {/* Periodo de traslado */}
        <div className={styles.fieldGroup}>
          <Input
            id="passage-transfer-period"
            label="Periodo de traslado"
            placeholder="Ej. 01/01/2026 AL 31/01/2026"
            value={transferPeriod}
            onChange={(e) => onTransferPeriodChange(e.target.value)}
            disabled={disabled}
            className={fieldErrors.transferPeriod ? styles.inputInvalid : undefined}
            aria-invalid={fieldErrors.transferPeriod ? "true" : undefined}
          />
          <span className={styles.fieldHelper}>
            Lapso comprendido para la comisión o traslado autorizado.
          </span>
        </div>
      </div>
    </section>
  );
}
