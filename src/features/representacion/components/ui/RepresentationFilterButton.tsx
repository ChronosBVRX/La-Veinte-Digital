"use client";

import { Funnel } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";

export interface RepresentationFilterButtonProps {
  onClick: () => void;
  activeCount?: number;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  style?: React.CSSProperties;
}

export function RepresentationFilterButton({
  onClick,
  activeCount = 0,
  label = "Filtros",
  variant,
  className,
  style,
}: RepresentationFilterButtonProps): React.JSX.Element {
  const effectiveVariant = variant ?? (activeCount > 0 ? "primary" : "secondary");

  return (
    <Button
      variant={effectiveVariant}
      size="sm"
      onClick={onClick}
      leadingIcon={<Funnel size={15} weight={activeCount > 0 ? "fill" : "regular"} />}
      fullWidth={false}
      className={className}
      style={{
        minHeight: 38,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {activeCount > 0 ? `${label} (${activeCount})` : label}
    </Button>
  );
}
