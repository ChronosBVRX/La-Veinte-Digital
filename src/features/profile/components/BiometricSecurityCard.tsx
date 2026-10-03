"use client"

import { useEffect, useState, useCallback } from "react"
import { Fingerprint } from "lucide-react"
import { Button } from "@/shared/components/ui/Button"

export function BiometricSecurityCard() {
  const [isNative, setIsNative] = useState(false)
  const [hasBiometrics, setHasBiometrics] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkBiometricStatus = useCallback(async () => {
    if (typeof window === "undefined" || !window.LaVeinteApp) {
      setIsNative(false)
      setLoading(false)
      return
    }

    const nativeApp = Boolean(window.LaVeinteApp.isNativeApp?.())
    setIsNative(nativeApp)

    if (!nativeApp) {
      setLoading(false)
      return
    }

    try {
      const hasBioResult = await Promise.resolve(window.LaVeinteApp.hasBiometrics?.())
      setHasBiometrics(Boolean(hasBioResult))

      if (hasBioResult) {
        const enabledResult = await Promise.resolve(window.LaVeinteApp.isBiometricsEnabled?.())
        setIsEnabled(Boolean(enabledResult))
      }
    } catch {
      // Best-effort en consulta nativa
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkBiometricStatus()
    }, 0)

    const onFocus = () => void checkBiometricStatus()
    window.addEventListener("focus", onFocus)
    window.addEventListener("laveinte:native-ready", onFocus)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("laveinte:native-ready", onFocus)
    }
  }, [checkBiometricStatus])

  if (!isNative || loading) {
    return null
  }

  const handleToggle = () => {
    if (!window.LaVeinteApp) return

    if (isEnabled) {
      if (typeof window.LaVeinteApp.disableBiometrics === "function") {
        window.LaVeinteApp.disableBiometrics()
      } else {
        window.location.href = "laveinte://bridge/disableBiometrics"
      }
      setIsEnabled(false)
    } else {
      if (typeof window.LaVeinteApp.promptBiometricEnrollment === "function") {
        window.LaVeinteApp.promptBiometricEnrollment()
      } else {
        window.location.href = "laveinte://bridge/promptBiometrics"
      }
      // Re-verificar tras breve pausa para captar el resultado del prompt
      setTimeout(() => void checkBiometricStatus(), 1200)
    }
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
        marginTop: "1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1, minWidth: "240px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: isEnabled ? "#dcfce7" : "var(--accent)",
              color: isEnabled ? "#16a34a" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Fingerprint size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                Bloqueo biométrico (Huella / Face ID)
              </span>
              <span
                style={{
                  background: isEnabled ? "#f0fdf4" : "var(--accent)",
                  color: isEnabled ? "#166534" : "var(--muted)",
                  border: isEnabled ? "1px solid #bbf7d0" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.15rem 0.45rem",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {isEnabled ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
              {hasBiometrics
                ? isEnabled
                  ? "Tu información está protegida. La app solicita tu huella, rostro o PIN seguro al abrirla."
                  : "Accede en 1 segundo con tu huella digital o rostro sin tener que escribir tu contraseña cada vez."
                : "Este dispositivo no cuenta con sensor biométrico o credencial segura registrada en el sistema."}
            </p>
          </div>
        </div>

        {hasBiometrics && (
          <div style={{ flexShrink: 0 }}>
            <Button
              variant={isEnabled ? "secondary" : "primary"}
              size="sm"
              onClick={handleToggle}
            >
              {isEnabled ? "Desactivar" : "Activar biometría"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
