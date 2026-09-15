"use client";

import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";

export function WorkerEmptyState({
  variant,
  query,
  onClear,
  onRetry,
}: {
  variant: "empty" | "error";
  query?: string;
  onClear?: () => void;
  onRetry?: () => void;
}): React.JSX.Element {
  if (variant === "error") {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.625rem",
          padding: "1.5rem 1rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--card)",
          textAlign: "center",
        }}
      >
        <WarningCircle size={28} weight="duotone" style={{ color: "var(--error)" }} />
        <div style={{ fontWeight: 700 }}>No se pudo cargar el directorio</div>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.625rem",
        padding: "1.5rem 1rem",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--card)",
        textAlign: "center",
      }}
    >
      <MagnifyingGlass size={28} weight="duotone" style={{ color: "var(--muted)" }} />
      <div style={{ fontWeight: 700 }}>Sin resultados</div>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", maxWidth: 360 }}>
        {query
          ? <>No hay trabajadores que coincidan con “{query}”.</>
          : "No hay trabajadores que coincidan con los filtros seleccionados."}
      </p>
      {onClear ? (
        <Button size="sm" variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
