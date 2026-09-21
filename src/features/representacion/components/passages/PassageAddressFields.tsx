"use client";

import { Input } from "@/shared/components/ui/Input";
import styles from "./PassageWizard.module.css";

export interface PassageAddressState {
  street: string;
  neighborhood: string;
  postalCode: string;
  municipality: string;
  state: string;
}

export interface PassageAddressFieldsProps {
  idPrefix: string;
  address: PassageAddressState;
  onChange: (key: keyof PassageAddressState, value: string) => void;
  disabled?: boolean;
  errors?: Partial<Record<keyof PassageAddressState, boolean>>;
}

export function PassageAddressFields({
  idPrefix,
  address,
  onChange,
  disabled = false,
  errors = {},
}: PassageAddressFieldsProps): React.JSX.Element {
  return (
    <div className={styles.addressFields}>
      {/* Calle (100% de ancho) */}
      <div className={styles.fieldGroup}>
        <Input
          id={`${idPrefix}-street`}
          label="Calle y número"
          placeholder="Ej. Av. Francisco I. Madero Poniente 1234"
          value={address.street}
          onChange={(e) => onChange("street", e.target.value)}
          disabled={disabled}
          className={errors.street ? styles.inputInvalid : undefined}
          aria-invalid={errors.street ? "true" : undefined}
        />
      </div>

      {/* Colonia (65%) y Código Postal (35%) */}
      <div className={`${styles.addressRowDual} ${styles.rowColoniaCp}`}>
        <div className={styles.fieldGroup}>
          <Input
            id={`${idPrefix}-neighborhood`}
            label="Colonia"
            placeholder="Ej. Centro Histórico"
            value={address.neighborhood}
            onChange={(e) => onChange("neighborhood", e.target.value)}
            disabled={disabled}
            className={errors.neighborhood ? styles.inputInvalid : undefined}
            aria-invalid={errors.neighborhood ? "true" : undefined}
          />
        </div>
        <div className={styles.fieldGroup}>
          <Input
            id={`${idPrefix}-postal-code`}
            label="C.P."
            placeholder="58000"
            value={address.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
            disabled={disabled}
            inputMode="numeric"
            maxLength={5}
            className={errors.postalCode ? styles.inputInvalid : undefined}
            aria-invalid={errors.postalCode ? "true" : undefined}
          />
        </div>
      </div>

      {/* Municipio (60%) y Estado (40%) */}
      <div className={`${styles.addressRowDual} ${styles.rowMunEstado}`}>
        <div className={styles.fieldGroup}>
          <Input
            id={`${idPrefix}-municipality`}
            label="Municipio o delegación"
            placeholder="Ej. Morelia"
            value={address.municipality}
            onChange={(e) => onChange("municipality", e.target.value)}
            disabled={disabled}
            className={errors.municipality ? styles.inputInvalid : undefined}
            aria-invalid={errors.municipality ? "true" : undefined}
          />
        </div>
        <div className={styles.fieldGroup}>
          <Input
            id={`${idPrefix}-state`}
            label="Estado"
            placeholder="Ej. Michoacán"
            value={address.state}
            onChange={(e) => onChange("state", e.target.value)}
            disabled={disabled}
            className={errors.state ? styles.inputInvalid : undefined}
            aria-invalid={errors.state ? "true" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
