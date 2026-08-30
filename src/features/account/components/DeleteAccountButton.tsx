"use client"

import type { CSSProperties } from "react"
import { useActionState, useState } from "react"
import { deleteAccountAction } from "../actions"

/**
 * Destructive, two-step account deletion button. Uses `useActionState` (Rule 8) with the
 * server action. The first click reveals a confirmation; the second click, plus an explicit typed
 * confirmation phrase, submits. No data is deleted until the user confirms.
 */
export function DeleteAccountButton() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, undefined)
  const [armed, setArmed] = useState(false)
  const [phrase, setPhrase] = useState("")

  const confirmed = phrase === "ELIMINAR"

  return (
    <div style={{ marginTop: "0.75rem" }}>
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          style={dangerousButtonStyle}
        >
          Eliminar mi cuenta…
        </button>
      ) : (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: "var(--radius)", padding: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#991b1b", margin: "0 0 0.75rem", fontWeight: 600 }}>
            Esto es irreversible
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            Se borrarán tu perfil, tus datos laborales, tarjetones, checadas, agenda, documentos
            compartidos y tu acceso a La Veinte Digital. Escribe <strong>ELIMINAR</strong> para
            confirmar.
          </p>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="Escribe ELIMINAR"
            style={{
              width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", fontSize: "0.875rem", marginBottom: "0.75rem",
            }}
            aria-label="Confirmación de eliminación"
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => { setArmed(false); setPhrase("") }} style={secondaryButtonStyle}>
              Cancelar
            </button>
            <form action={formAction}>
              <button
                type="submit"
                disabled={!confirmed || pending}
                style={{ ...dangerousButtonStyle, opacity: confirmed ? 1 : 0.5, cursor: confirmed ? "pointer" : "not-allowed" }}
              >
                {pending ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </form>
          </div>
          {state?.error ? (
            <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: "0.75rem 0 0" }}>{state.error}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

const dangerousButtonStyle: CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "0.5rem 0.875rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
}

const secondaryButtonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.5rem 0.875rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
}
