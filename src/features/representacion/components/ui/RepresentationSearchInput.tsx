"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Input } from "@/shared/components/ui/Input";

export interface RepresentationSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onSearchSubmit?: (val: string) => void;
  style?: React.CSSProperties;
}

export function RepresentationSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  ariaLabel = "Buscar",
  onSearchSubmit,
  style,
}: RepresentationSearchInputProps): React.JSX.Element {
  return (
    <div style={{ position: "relative", width: "100%", ...style }}>
      <Input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSearchSubmit?.(value);
          }
        }}
        leadingIcon={<MagnifyingGlass size={16} />}
        trailingElement={
          value ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                onChange("");
                onSearchSubmit?.("");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                padding: "0.25rem",
                borderRadius: "0.25rem",
              }}
            >
              <X size={14} weight="bold" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
