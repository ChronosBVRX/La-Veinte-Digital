"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui";

export function LockerReleaseModal({
  isOpen,
  lockerNumber,
  onConfirm,
  onCancel,
  loading = false,
}: {
  isOpen: boolean;
  lockerNumber: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}): React.JSX.Element | null {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setReason("");
    }
  }, [isOpen]);

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onCancel}
      title={`Liberar locker ${lockerNumber}`}
      description="El casillero volverá a quedar disponible para asignación. El registro anterior se conservará intacto en el historial."
      size="sm"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <Input
            label="Motivo de liberación"
            placeholder="ej. Cambio de turno, baja, solicitud voluntaria…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (reason.trim()) onConfirm(reason.trim());
            }}
            disabled={!reason.trim() || loading}
            loading={loading}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
          >
            Liberar casillero
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
