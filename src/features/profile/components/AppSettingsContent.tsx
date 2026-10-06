"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  Fingerprint,
  ArrowsClockwise,
  FileText,
  ShieldCheck,
  Trash,
  CaretRight,
} from "@phosphor-icons/react"
import { BiometricSecurityCard } from "./BiometricSecurityCard"
import { DeleteWorkerDataSection } from "./worker/DeleteWorkerDataSection"
import { useIsNativeApp, useNativePlatform } from "@/shared/hooks/useIsNativeApp"

export function AppSettingsContent() {
  const router = useRouter()
  const isNative = useIsNativeApp()
  const platform = useNativePlatform()

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Link
          href="/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            marginBottom: "0.5rem",
          }}
        >
          <ArrowLeft size={16} weight="bold" />
          Ir a Mi perfil y tarjetón
        </Link>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Configuración
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
          Seguridad del dispositivo, notificaciones, actualizaciones e información legal de tu cuenta.
        </p>
      </div>

      {/* Seguridad / Biometría */}
      {isNative ? (
        <div style={{ marginTop: "-1.5rem" }}>
          <BiometricSecurityCard />
        </div>
      ) : (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "1.25rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Fingerprint size={20} weight="duotone" />
          </div>
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              Bloqueo biométrico (Huella / Face ID)
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>
              Esta opción se activa automáticamente cuando abres La Veinte Digital desde la aplicación móvil en tu teléfono.
            </p>
          </div>
        </div>
      )}

      {/* Notificaciones y Aplicación */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
          Notificaciones y aplicación
        </div>

        <Link
          href="/avisos/preferencias"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.625rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Bell size={20} weight="duotone" color="var(--primary)" />
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Preferencias de notificaciones</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Configura los avisos y comunicados oficiales en tu dispositivo
              </div>
            </div>
          </div>
          <CaretRight size={16} color="var(--muted)" />
        </Link>

        {isNative && platform === "android" && (
          <button
            type="button"
            onClick={() => {
              window.LaVeinteApp?.checkForUpdate?.()
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              padding: "0.625rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--fg)",
              textAlign: "left",
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <ArrowsClockwise size={20} weight="duotone" color="var(--primary)" />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Buscar actualización de la app</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Comprueba si hay una versión más reciente disponible
                </div>
              </div>
            </div>
            <CaretRight size={16} color="var(--muted)" />
          </button>
        )}
      </div>

      {/* Información legal y privacidad */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
          Información legal y privacidad
        </div>

        <Link
          href="/informacion-y-fuentes"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.5rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            color: "var(--fg)",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <FileText size={18} weight="duotone" color="var(--muted)" />
            Información y fuentes oficiales
          </span>
          <CaretRight size={16} color="var(--muted)" />
        </Link>

        <Link
          href="/privacidad"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.5rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            color: "var(--fg)",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <ShieldCheck size={18} weight="duotone" color="var(--muted)" />
            Política de privacidad
          </span>
          <CaretRight size={16} color="var(--muted)" />
        </Link>

        <Link
          href="/terminos"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.5rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            color: "var(--fg)",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <FileText size={18} weight="duotone" color="var(--muted)" />
            Términos y condiciones
          </span>
          <CaretRight size={16} color="var(--muted)" />
        </Link>
      </div>

      {/* Gestión de datos y cuenta */}
      <DeleteWorkerDataSection onDeleted={() => router.refresh()} />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem 1.25rem",
        }}
      >
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.375rem", color: "var(--fg)" }}>
          Cuenta y Sesión
        </div>
        <Link
          href="/eliminar-cuenta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#dc2626",
            padding: "0.25rem 0",
          }}
        >
          <Trash size={18} weight="regular" />
          Eliminar mi cuenta definitivamente
        </Link>
      </div>
    </div>
  )
}
