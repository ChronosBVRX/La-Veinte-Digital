"use client";

import { ArrowsDownUp } from "@phosphor-icons/react";
import { Select } from "@/shared/components/ui/Input";
import { Button } from "@/shared/components/ui/Button";

export interface SortOption {
  id: string;
  label: string;
}

export interface RepresentationSortButtonProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  onMobileOpen?: () => void;
  style?: React.CSSProperties;
}

export function RepresentationSortButton({
  value,
  options,
  onChange,
  ariaLabel = "Ordenar por",
  onMobileOpen,
  style,
}: RepresentationSortButtonProps): React.JSX.Element {
  const currentOption = options.find((opt) => opt.id === value);
  const currentLabel = currentOption ? currentOption.label : "Ordenar";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", ...style }}>
      {/* Desktop view: native styled select */}
      <div className="desktop-only" style={{ minWidth: 160 }}>
        <Select
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Mobile view: button that triggers mobile sort sheet or direct cycle */}
      <div className="mobile-only">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (onMobileOpen) {
              onMobileOpen();
            } else {
              // Si no se pasó sheet móvil, ciclar a la siguiente opción
              const idx = options.findIndex((opt) => opt.id === value);
              const nextIdx = (idx + 1) % options.length;
              onChange(options[nextIdx].id);
            }
          }}
          leadingIcon={<ArrowsDownUp size={15} />}
          style={{ minHeight: 38, whiteSpace: "nowrap" }}
        >
          {currentLabel}
        </Button>
      </div>
    </div>
  );
}
