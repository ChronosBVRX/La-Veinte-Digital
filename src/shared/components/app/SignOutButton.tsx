"use client"

import { useFormStatus } from "react-dom"
import { SignOut } from "@phosphor-icons/react"
import { signOutAction } from "@/app/(auth)/actions"

/**
 * Botón de cierre de sesión al pie del menú lateral.
 * Reutiliza el server action existente (cierra sesión y redirige a /login).
 */
export function SignOutButton({ onDone }: { onDone?: () => void }) {
  return (
    <form
      action={async () => {
        await signOutAction()
        onDone?.()
      }}
      style={{ margin: 0 }}
    >
      <SignOutSubmit />
    </form>
  )
}

function SignOutSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Cerrar sesión"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.625rem 0.75rem",
        borderRadius: "var(--radius)",
        background: "transparent",
        border: "none",
        cursor: pending ? "wait" : "pointer",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        color: "var(--muted)",
        minHeight: 40,
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <SignOut size={18} weight="regular" style={{ flexShrink: 0 }} />
      {pending ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  )
}
