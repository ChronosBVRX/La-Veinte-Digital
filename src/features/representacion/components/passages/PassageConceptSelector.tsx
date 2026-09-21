"use client";

import type { KeyboardEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import styles from "./PassageWizard.module.css";

export type PassageConcept = "026" | "027";

export interface PassageConceptSelectorProps {
  concept: PassageConcept;
  onChange: (concept: PassageConcept) => void;
  disabled?: boolean;
}

export function PassageConceptSelector({
  concept,
  onChange,
  disabled = false,
}: PassageConceptSelectorProps): React.JSX.Element {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, targetConcept: PassageConcept) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(targetConcept);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange("026");
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange("027");
    }
  }

  return (
    <section className={styles.sectionCard} aria-labelledby="concept-selector-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="concept-selector-title" className={styles.sectionTitle}>
            Tipo de trámite
          </h2>
          <p className={styles.sectionSubtitle}>
            Selecciona el concepto correspondiente a las funciones o traslados del trabajador.
          </p>
        </div>
      </div>

      <div
        className={styles.conceptGrid}
        role="radiogroup"
        aria-label="Concepto de pasajes"
      >
        {/* Concepto 026 */}
        <div
          role="radio"
          tabIndex={concept === "026" ? 0 : -1}
          aria-checked={concept === "026"}
          aria-disabled={disabled}
          className={`${styles.conceptCard} ${concept === "026" ? styles.conceptCardActive : ""}`}
          onClick={() => !disabled && onChange("026")}
          onKeyDown={(e) => handleKeyDown(e, "026")}
        >
          <div className={styles.conceptTopRow}>
            <span className={styles.conceptBadge}>Concepto 026</span>
            {concept === "026" ? (
              <span className={styles.conceptCheckIcon} aria-hidden="true">
                <CheckCircle size={22} weight="fill" />
              </span>
            ) : null}
          </div>
          <p className={styles.conceptTitle}>Compensación fija</p>
          <p className={styles.conceptDesc}>
            Para funciones extramuros fuera del centro de trabajo ordinario.
          </p>
        </div>

        {/* Concepto 027 */}
        <div
          role="radio"
          tabIndex={concept === "027" ? 0 : -1}
          aria-checked={concept === "027"}
          aria-disabled={disabled}
          className={`${styles.conceptCard} ${concept === "027" ? styles.conceptCardActive : ""}`}
          onClick={() => !disabled && onChange("027")}
          onKeyDown={(e) => handleKeyDown(e, "027")}
        >
          <div className={styles.conceptTopRow}>
            <span className={styles.conceptBadge}>Concepto 027</span>
            {concept === "027" ? (
              <span className={styles.conceptCheckIcon} aria-hidden="true">
                <CheckCircle size={22} weight="fill" />
              </span>
            ) : null}
          </div>
          <p className={styles.conceptTitle}>Compensación por pasajes</p>
          <p className={styles.conceptDesc}>
            Conforme a Cláusula 103 y Reglamento. Incluye aviso de privacidad institucional (2 páginas).
          </p>
        </div>
      </div>
    </section>
  );
}
