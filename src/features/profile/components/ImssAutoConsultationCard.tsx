"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck,
  Lock,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/shared/components/ui/Button"
import { useIsNativeApp } from "@/shared/hooks/useIsNativeApp"

interface ImssAutoConsultationCardProps {
  /** Estilo compacto para incrustar en el flujo de tarjetón */
  compact?: boolean
}

export function ImssAutoConsultationCard({ compact = false }: ImssAutoConsultationCardProps) {
  const isNative = useIsNativeApp()
  const [hasTuPerfil, setHasTuPerfil] = useState(false)
  const [hasTarjeton, setHasTarjeton] = useState(false)
  const [showSecurityDetails, setShowSecurityDetails] = useState(!compact)

  const checkCredentials = useCallback(() => {
    if (typeof window === "undefined" || !window.LaVeinteApp) {
      setHasTuPerfil(false)
      setHasTarjeton(false)
      return
    }

    try {
      if (typeof window.LaVeinteApp.hasImssCredentials === "function") {
        setHasTuPerfil(Boolean(window.LaVeinteApp.hasImssCredentials("tuperfil")))
        setHasTarjeton(Boolean(window.LaVeinteApp.hasImssCredentials("tarjetondigital")))
      }
    } catch {
      // Best-effort en consulta nativa
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkCredentials()
    }, 0)

    const onFocus = () => checkCredentials()
    window.addEventListener("focus", onFocus)
    window.addEventListener("laveinte:native-ready", onFocus)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("laveinte:native-ready", onFocus)
    }
  }, [checkCredentials])

  const handleOpenVault = () => {
    if (typeof window !== "undefined" && window.LaVeinteApp?.openOfficialPayslips) {
      window.LaVeinteApp.openOfficialPayslips()
      return
    }
    if (typeof window !== "undefined") {
      window.location.href = "laveinte://bridge/openOfficialPayslips"
    }
  }

  const isConfigured = hasTuPerfil || hasTarjeton

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: compact ? "1.25rem" : "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.125rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Encabezado con badge de estado */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", flex: 1, minWidth: "260px" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: isConfigured ? "#dcfce7" : "rgba(37, 99, 235, 0.1)",
              color: isConfigured ? "#16a34a" : "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                Consultas Automáticas en Portales IMSS
              </h3>
              {isNative && (
                <span
                  style={{
                    background: isConfigured ? "#f0fdf4" : "var(--accent)",
                    color: isConfigured ? "#166534" : "var(--muted)",
                    border: isConfigured ? "1px solid #bbf7d0" : "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.15rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {isConfigured ? "✓ Bóveda configurada en tu celular" : "○ Sin credenciales guardadas"}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.35rem 0 0", lineHeight: 1.5 }}>
              Revisión anticipada de tu próximo tarjetón de nómina y consulta directa de checadas (asistencia biométrica).
            </p>
          </div>
        </div>

        {isNative && (
          <Button
            variant={isConfigured ? "secondary" : "primary"}
            size="sm"
            onClick={handleOpenVault}
            style={{ alignSelf: "flex-start" }}
          >
            <Lock size={15} style={{ marginRight: "0.375rem" }} />
            {isConfigured ? "Gestionar Bóveda IMSS" : "Configurar en Bóveda"}
          </Button>
        )}
      </div>

      {/* Qué hace esta función por el trabajador */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "0.75rem",
          background: "var(--accent)",
          padding: "1rem",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <Sparkles size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
              Sabe cuánto vas a cobrar antes
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4, marginTop: "0.15rem" }}>
              Revisa si ya publicaron el tarjetón y te calcula tu sueldo neto antes del día de pago.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <AlertCircle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
              Detecta conceptos habituales faltantes
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4, marginTop: "0.15rem" }}>
              Si te falta asistencia (032) te avisa que te llegó una falta para revisarla de inmediato, o si falta puntualidad (033) por retardos, explicándote el contexto de cada concepto.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <Clock size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
              Historial de checadas biométricas
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4, marginTop: "0.15rem" }}>
              Consulta directa a Tu Perfil IMSS para tener respaldo de tus registros de asistencia.
            </div>
          </div>
        </div>
      </div>

      {/* Bloque de Garantía de Seguridad y Privacidad Radical */}
      <div
        style={{
          border: "1px solid #bbf7d0",
          background: "#f0fdf4",
          borderRadius: "var(--radius-sm)",
          padding: "0.875rem 1rem",
        }}
      >
        <button
          type="button"
          onClick={() => setShowSecurityDetails((prev) => !prev)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#166534" }}>
              Garantía de Seguridad: Tus datos nunca salen de tu celular
            </span>
          </div>
          {showSecurityDetails ? (
            <ChevronUp size={16} color="#166534" />
          ) : (
            <ChevronDown size={16} color="#166534" />
          )}
        </button>

        {showSecurityDetails && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.78rem", color: "#166534", lineHeight: 1.5 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span>•</span>
              <div>
                <strong>Cero servidores:</strong> Tus contraseñas y accesos a Tu Perfil IMSS <u>NUNCA</u> se suben a los servidores de La Veinte Digital ni a ninguna base de datos en la nube.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span>•</span>
              <div>
                <strong>Bóveda local cifrada en tu teléfono:</strong> Se resguardan con cifrado de hardware <code>AES-256-GCM</code> en el chip de seguridad de tu propio dispositivo (Android KeyStore / Hardware Security Module).
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span>•</span>
              <div>
                <strong>Conexión directa IMSS:</strong> La consulta se realiza directamente desde tu conexión hacia los servidores oficiales del IMSS (<code>tuperfil.imss.gob.mx</code> y <code>rh.imss.gob.mx</code>).
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span>•</span>
              <div>
                <strong>Control total:</strong> Puedes ver tus credenciales, modificarlas o eliminarlas de tu dispositivo en cualquier momento desde la Bóveda Nativa.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Si está en navegador web regular, explicar que requiere la app móvil por hardware security */}
      {!isNative && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Smartphone size={20} color="var(--primary)" />
            <div style={{ fontSize: "0.8125rem", color: "#1e40af" }}>
              <strong>Disponible exclusivamente en la App Móvil:</strong> Por tu seguridad, esta función requiere el chip de cifrado local de tu teléfono y no se habilita en navegadores web.
            </div>
          </div>
          <a
            href="https://la20.com.mx/public/LaVeinteDigital.apk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--primary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Descargar App Android <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
