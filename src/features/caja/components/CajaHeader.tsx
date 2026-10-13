"use client"

import Image from "next/image"
import { SignOut, ShieldCheck } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import type { CajaSessionStatus } from "../services/caja-service"

interface CajaHeaderProps {
  session: CajaSessionStatus | null
  onLogout: () => void
}

export function CajaHeader({ session, onLogout }: CajaHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        padding: "1.25rem",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          style={{
            width: 52,
            height: 52,
            position: "relative",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid var(--border)",
          }}
        >
          <Image
            src="/brand/caja/logo.png"
            alt="Caja de Previsión y Ahorro SNTSS"
            width={48}
            height={48}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
              Caja de Ahorro SNTSS
            </h1>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                padding: "0.15rem 0.5rem",
                background: "rgba(37, 99, 235, 0.1)",
                color: "var(--primary)",
                borderRadius: "var(--radius-pill)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <ShieldCheck size={12} weight="bold" />
              Oficial
            </span>
          </div>
          <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
            Caja de Previsión y Ahorro del SNTSS · Gestión de saldos, retiros y citas
          </p>
        </div>
      </div>

      {session?.authenticated && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
              {session.nombre || `Matrícula: ${session.matricula}`}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Sesión activa en Caja</div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} leadingIcon={<SignOut size={16} />}>
            Cerrar sesión
          </Button>
        </div>
      )}
    </div>
  )
}
