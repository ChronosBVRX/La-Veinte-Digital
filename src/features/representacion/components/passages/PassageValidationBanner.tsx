"use client";

import { WarningCircle } from "@phosphor-icons/react";
import styles from "./PassageWizard.module.css";

export interface PassageValidationBannerProps {
  missingFields: string[];
  customError?: string | null;
}

export function PassageValidationBanner({
  missingFields,
  customError,
}: PassageValidationBannerProps): React.JSX.Element | null {
  if (missingFields.length === 0 && !customError) return null;

  return (
    <div className={`${styles.alertBox} ${styles.alertError}`} role="alert" aria-live="polite">
      <div className={styles.alertErrorTitle}>
        <WarningCircle size={18} weight="bold" />
        No pudimos preparar la solicitud
      </div>

      {customError ? <div>{customError}</div> : null}

      {missingFields.length > 0 ? (
        <>
          <div>Por favor, completa los siguientes datos obligatorios para continuar:</div>
          <ul className={styles.alertList}>
            {missingFields.map((field, idx) => (
              <li key={idx}>{field}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
