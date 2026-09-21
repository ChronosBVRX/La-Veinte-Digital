"use client";

import styles from "./PassageWizard.module.css";

export interface PassageInternalNotesProps {
  notes: string;
  onNotesChange: (v: string) => void;
  disabled?: boolean;
}

export function PassageInternalNotes({
  notes,
  onNotesChange,
  disabled = false,
}: PassageInternalNotesProps): React.JSX.Element {
  return (
    <section className={styles.sectionCard} aria-labelledby="internal-notes-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="internal-notes-title" className={styles.sectionTitle}>
            Observaciones internas
          </h2>
          <p className={styles.sectionSubtitle}>
            Registro de seguimiento y antecedentes sindicales para el expediente digital.
          </p>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <textarea
          id="passage-internal-notes"
          className={styles.notesTextarea}
          placeholder="Notas internas de la delegación sindical sobre este trámite…"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={disabled}
        />
        <span className={styles.fieldHelper}>
          Estas notas son exclusivas del expediente digital y no se imprimen en el formato oficial.
        </span>
      </div>
    </section>
  );
}
