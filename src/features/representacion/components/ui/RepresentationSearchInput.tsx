"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";

export interface RepresentationSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onSearchSubmit?: (val: string) => void;
  showSearchButton?: boolean;
  searchButtonLabel?: string;
  onClear?: () => void;
  loading?: boolean;
  style?: React.CSSProperties;
}

export function RepresentationSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  ariaLabel = "Buscar",
  onSearchSubmit,
  showSearchButton = false,
  searchButtonLabel = "Buscar",
  onClear,
  loading = false,
  style,
}: RepresentationSearchInputProps): React.JSX.Element {
  function handleClear(): void {
    onChange("");
    if (onClear) {
      onClear();
    } else {
      onSearchSubmit?.("");
    }
  }

  function handleSubmit(): void {
    onSearchSubmit?.(value);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        width: "100%",
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          leadingIcon={<MagnifyingGlass size={16} />}
          trailingElement={
            value ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={handleClear}
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

      {showSearchButton ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSubmit}
          leadingIcon={<MagnifyingGlass size={15} />}
          loading={loading}
          style={{
            minHeight: 38,
            whiteSpace: "nowrap",
            flexShrink: 0,
            padding: "0 0.875rem",
          }}
        >
          {searchButtonLabel}
        </Button>
      ) : null}
    </div>
  );
}
