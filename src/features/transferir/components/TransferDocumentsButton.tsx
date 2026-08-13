"use client"

import { useState } from "react"
import { ArrowsLeftRight } from "@phosphor-icons/react"
import type { CSSProperties, ReactNode } from "react"
import { Button } from "@/shared/components/ui/Button"
import { TransferDocumentsModal } from "@/features/transferir/components/TransferDocumentsModal"

interface TransferDocumentsButtonProps {
  label?: string
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  style?: CSSProperties
  renderTrigger?: (open: () => void) => ReactNode
}

export function TransferDocumentsButton({
  label,
  variant = "primary",
  size = "md",
  style,
  renderTrigger,
}: TransferDocumentsButtonProps) {
  const [open, setOpen] = useState(false)
  const openModal = () => setOpen(true)

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openModal)
      ) : (
        <Button variant={variant} size={size} style={style} onClick={openModal}>
          <ArrowsLeftRight size={18} />
          {label ?? "Transferir documentos"}
        </Button>
      )}
      <TransferDocumentsModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
