"use client"

import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog"
import { Tabs } from "@/shared/components/ui/Tabs"
import { ReceivePanel } from "@/features/transferir/components/ReceivePanel"
import { SendPanel } from "@/features/transferir/components/SendPanel"

interface TransferDocumentsModalProps {
  open: boolean
  onClose: () => void
}

export function TransferDocumentsModal({
  open,
  onClose,
}: TransferDocumentsModalProps) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Transferir documentos"
      description="Envía o recibe documentos entre dispositivos para imprimirlos."
      size="md"
      sheetHeight="large"
    >
      <Tabs
        tabs={[
          { id: "recibir", label: "Recibir" },
          { id: "enviar", label: "Enviar" },
        ]}
        defaultTab="recibir"
      >
        {(active) => (active === "recibir" ? <ReceivePanel /> : <SendPanel />)}
      </Tabs>
    </ResponsiveDialog>
  )
}
