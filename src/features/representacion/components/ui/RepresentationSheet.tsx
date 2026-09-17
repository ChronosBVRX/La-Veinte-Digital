"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useBackLayer } from "@/shared/navigation/useBackLayer";

export interface RepresentationSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | string;
}

export function RepresentationSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
}: RepresentationSheetProps): React.JSX.Element | null {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useBackLayer(open, onClose, "sheet");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: "100%",
          maxWidth,
          height: "100%",
          backgroundColor: "var(--card)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        {/* Header del Sheet */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--fg)",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Sheet */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {children}
        </div>

        {/* Footer opcional */}
        {footer ? (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              backgroundColor: "var(--card)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
