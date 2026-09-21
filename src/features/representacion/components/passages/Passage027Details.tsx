"use client";

import { Input } from "@/shared/components/ui/Input";
import { Copy, House, Buildings } from "@phosphor-icons/react";
import {
  PassageAddressFields,
  type PassageAddressState,
} from "./PassageAddressFields";
import styles from "./PassageWizard.module.css";

export interface Passage027DetailsProps {
  discontinuousSchedule: "Si" | "No" | "";
  onDiscontinuousScheduleChange: (v: "Si" | "No" | "") => void;
  workerAddress: PassageAddressState;
  onWorkerAddressChange: (key: keyof PassageAddressState, value: string) => void;
  assignmentAddress: PassageAddressState;
  onAssignmentAddressChange: (key: keyof PassageAddressState, value: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, boolean>;
}

export function Passage027Details({
  discontinuousSchedule,
  onDiscontinuousScheduleChange,
  workerAddress,
  onWorkerAddressChange,
  assignmentAddress,
  onAssignmentAddressChange,
  phone,
  onPhoneChange,
  disabled = false,
  fieldErrors = {},
}: Passage027DetailsProps): React.JSX.Element {
  function handleCopyMunState(): void {
    if (workerAddress.municipality) {
      onAssignmentAddressChange("municipality", workerAddress.municipality);
    }
    if (workerAddress.state) {
      onAssignmentAddressChange("state", workerAddress.state);
    }
  }

  return (
    <section className={styles.sectionCard} aria-labelledby="details-027-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="details-027-title" className={styles.sectionTitle}>
            Detalles de jornada y domicilios (Concepto 027)
          </h2>
          <p className={styles.sectionSubtitle}>
            Indica si la jornada es discontinua y detalla las ubicaciones físicas para cálculo de pasajes.
          </p>
        </div>
      </div>

      {/* Horario Discontinuo: Segmented Control */}
      <div className={styles.fieldGroup}>
        <span id="disc-schedule-label" className={styles.fieldLabel}>
          Horario discontinuo
        </span>
        <div
          className={styles.segmentedGroup}
          role="radiogroup"
          aria-labelledby="disc-schedule-label"
        >
          <button
            type="button"
            role="radio"
            aria-checked={discontinuousSchedule === "Si"}
            className={`${styles.segmentedButton} ${
              discontinuousSchedule === "Si" ? styles.segmentedButtonActive : ""
            } ${fieldErrors.discontinuousSchedule ? styles.inputInvalid : ""}`}
            onClick={() => onDiscontinuousScheduleChange("Si")}
            disabled={disabled}
          >
            Sí
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={discontinuousSchedule === "No"}
            className={`${styles.segmentedButton} ${
              discontinuousSchedule === "No" ? styles.segmentedButtonActive : ""
            } ${fieldErrors.discontinuousSchedule ? styles.inputInvalid : ""}`}
            onClick={() => onDiscontinuousScheduleChange("No")}
            disabled={disabled}
          >
            No
          </button>
        </div>
        <span className={styles.fieldHelper}>
          Selecciona si el trabajador tiene descansos intermedios durante su turno.
        </span>
      </div>

      {/* Domicilios: 2 Tarjetas Lado a Lado en Desktop */}
      <div className={styles.addressesRow}>
        {/* Domicilio del Trabajador */}
        <div className={styles.addressCard}>
          <div className={styles.addressHeader}>
            <h3 className={styles.addressTitle}>
              <House size={18} weight="bold" color="var(--primary)" />
              Domicilio del trabajador
            </h3>
          </div>

          <PassageAddressFields
            idPrefix="worker-addr"
            address={workerAddress}
            onChange={onWorkerAddressChange}
            disabled={disabled}
            errors={{
              street: fieldErrors.workerStreet,
              neighborhood: fieldErrors.workerNeighborhood,
              postalCode: fieldErrors.workerPostalCode,
              municipality: fieldErrors.workerMunicipality,
              state: fieldErrors.workerState,
            }}
          />

          {/* Teléfono de contacto integrado */}
          <div className={styles.fieldGroup} style={{ marginTop: "0.25rem" }}>
            <Input
              id="passage-worker-phone"
              label="Teléfono de contacto"
              placeholder="Ej. 4431234567"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              disabled={disabled}
              type="tel"
              inputMode="tel"
              maxLength={15}
              className={fieldErrors.phone ? styles.inputInvalid : undefined}
              aria-invalid={fieldErrors.phone ? "true" : undefined}
            />
          </div>
        </div>

        {/* Domicilio de Adscripción */}
        <div className={styles.addressCard}>
          <div className={styles.addressHeader}>
            <h3 className={styles.addressTitle}>
              <Buildings size={18} weight="bold" color="var(--primary)" />
              Domicilio de adscripción
            </h3>
            {workerAddress.municipality || workerAddress.state ? (
              <button
                type="button"
                className={styles.addressCopyBtn}
                onClick={handleCopyMunState}
                title="Copiar municipio y estado del trabajador al de adscripción"
              >
                <Copy size={14} weight="bold" />
                Mismo municipio y estado
              </button>
            ) : null}
          </div>

          <PassageAddressFields
            idPrefix="assignment-addr"
            address={assignmentAddress}
            onChange={onAssignmentAddressChange}
            disabled={disabled}
            errors={{
              street: fieldErrors.assignmentStreet,
              neighborhood: fieldErrors.assignmentNeighborhood,
              postalCode: fieldErrors.assignmentPostalCode,
              municipality: fieldErrors.assignmentMunicipality,
              state: fieldErrors.assignmentState,
            }}
          />
        </div>
      </div>
    </section>
  );
}
