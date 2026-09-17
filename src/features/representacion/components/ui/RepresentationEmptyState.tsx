"use client";

import type { ReactNode } from "react";
import { MagnifyingGlass, WarningCircle, Tray } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";

export interface RepresentationEmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "empty" | "error" | "filtered";
  style?: React.CSSProperties;
}

export function RepresentationEmptyState({
  title,
  description,
  icon,
  action,
  actionLabel,
  onAction,
  variant = "empty",
  style,
}: RepresentationEmptyStateProps): React.JSX.Element {
  let defaultIcon: ReactNode = <Tray size={36} weight="duotone" />;
  let defaultTitle = "No hay registros disponibles";
  let defaultDesc = "Aún no se ha registrado información en este módulo.";

  if (variant === "filtered") {
    defaultIcon = <MagnifyingGlass size={36} weight="duotone" />;
    defaultTitle = "No se encontraron coincidencias";
    defaultDesc = "Intenta ajustar los términos de búsqueda o limpiar los filtros seleccionados.";
  } else if (variant === "error") {
    defaultIcon = <WarningCircle size={36} weight="duotone" color="#dc2626" />;
    defaultTitle = "No se pudo cargar la información";
    defaultDesc = "Ocurrió un inconveniente al consultar los datos. Por favor, reintenta.";
  }

  const effectiveTitle = title ?? defaultTitle;
  const effectiveDesc = description ?? defaultDesc;
  const effectiveIcon = icon ?? defaultIcon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "3rem 1.5rem",
        backgroundColor: "var(--card)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius-lg, 0.5rem)",
        gap: "0.75rem",
        ...style,
      }}
    >
      <div style={{ color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {effectiveIcon}
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--fg)",
        }}
      >
        {effectiveTitle}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          color: "var(--muted)",
          maxWidth: "48ch",
          lineHeight: 1.45,
        }}
      >
        {effectiveDesc}
      </p>

      {action ? (
        <div style={{ marginTop: "0.5rem" }}>{action}</div>
      ) : actionLabel && onAction ? (
        <div style={{ marginTop: "0.5rem" }}>
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
