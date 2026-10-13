"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Lock, IdentificationCard, Eye, EyeSlash, ShieldCheck, WarningCircle, CheckCircle } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { useUser } from "@/shared/hooks/useUser"
import {
  loadCajaCredentials,
  saveCajaCredentials,
  clearCajaCredentials,
} from "../services/caja-credentials-storage"
import { CajaLoginErrorModal } from "./CajaLoginErrorModal"
import type { CajaLoginError } from "../services/caja-service"

interface CajaLoginCardProps {
  onLogin: (matricula: string, password: string) => Promise<void>
  initialMatricula?: string
  userId?: string
}

export function CajaLoginCard({ onLogin, initialMatricula = "", userId }: CajaLoginCardProps) {
  const { user } = useUser()
  const effectiveUserId = userId || user?.id

  const [matricula, setMatricula] = useState(initialMatricula)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberCredentials, setRememberCredentials] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [modalError, setModalError] = useState<CajaLoginError | Error | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSaved() {
      if (!effectiveUserId) return
      try {
        const saved = await loadCajaCredentials(effectiveUserId)
        if (active && saved) {
          setMatricula(saved.matricula)
          setPassword(saved.password)
          setRememberCredentials(true)
          setHasSaved(true)
        }
      } catch {
        // Ignorar si no se puede leer
      }
    }

    void loadSaved()

    return () => {
      active = false
    }
  }, [effectiveUserId])

  const handleForgetSaved = () => {
    if (effectiveUserId) {
      clearCajaCredentials(effectiveUserId)
    }
    setPassword("")
    setRememberCredentials(false)
    setHasSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matricula.trim() || !password) {
      setError("Por favor ingresa tu matrícula y contraseña de Caja.")
      return
    }

    setError(null)
    setModalError(null)
    setLoading(true)
    try {
      await onLogin(matricula.trim(), password)
      if (effectiveUserId) {
        if (rememberCredentials) {
          await saveCajaCredentials(effectiveUserId, {
            matricula: matricula.trim(),
            password,
          })
          setHasSaved(true)
        } else {
          clearCajaCredentials(effectiveUserId)
          setHasSaved(false)
        }
      }
    } catch (err: unknown) {
      const loginErr = err instanceof Error ? err : new Error(String(err))
      setError(loginErr.message)
      setModalError(loginErr as CajaLoginError | Error)
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "1rem auto", boxSizing: "border-box", minWidth: 0 }}>
      <Card padding="clamp(1.25rem, 4vw, 1.75rem) clamp(1rem, 3vw, 1.5rem)">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 1rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--accent)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image
              src="/brand/caja/logo.png"
              alt="Logo Caja de Previsión y Ahorro"
              width={56}
              height={56}
              style={{ objectFit: "contain" }}
            />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.375rem", color: "var(--fg)" }}>
            Iniciar Sesión en Caja SNTSS
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Consulta tus saldos de ahorro, estado de préstamos, solicita retiros y agenda citas.
          </p>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.8125rem",
              marginBottom: "1.25rem",
            }}
          >
            <WarningCircle size={18} weight="fill" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <Input
              label="Matrícula IMSS"
              placeholder="Ej. 12345678"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              disabled={loading}
              leadingIcon={<IdentificationCard size={18} />}
              required
            />
          </div>

          <div>
            <Input
              label="Contraseña de Caja"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              leadingIcon={<Lock size={18} />}
              trailingElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              }
              required
            />
          </div>

          {hasSaved && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--success, #059669)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0 }}>
                <CheckCircle size={16} weight="fill" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>Credenciales guardadas en este dispositivo</span>
              </div>
              <button
                type="button"
                onClick={handleForgetSaved}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  textDecoration: "underline",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                Olvidar
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.8125rem",
              color: "var(--fg)",
            }}
          >
            <input
              id="caja-remember"
              type="checkbox"
              checked={rememberCredentials}
              onChange={(e) => setRememberCredentials(e.target.checked)}
              disabled={loading}
              style={{
                width: "1.05rem",
                height: "1.05rem",
                accentColor: "var(--primary)",
                cursor: "pointer",
              }}
            />
            <label htmlFor="caja-remember" style={{ cursor: "pointer", userSelect: "none" }}>
              Recordar mis credenciales en este dispositivo
            </label>
          </div>

          <Button type="submit" variant="primary" size="md" loading={loading} fullWidth>
            {loading ? "Validando credenciales..." : "Entrar a Caja de Ahorro"}
          </Button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--muted)",
            fontSize: "0.75rem",
            lineHeight: 1.4,
          }}
        >
          <ShieldCheck size={20} weight="fill" color="var(--primary)" style={{ flexShrink: 0 }} />
          <span>
            {hasSaved
              ? "Tus credenciales están guardadas de forma cifrada (AES-GCM) únicamente en este dispositivo. Puedes olvidarlas en cualquier momento."
              : "Tus datos se transmiten con cifrado seguro al servidor de la Caja SNTSS. Puedes optar por guardarlas cifradas en este dispositivo para mayor comodidad."}
          </span>
        </div>
      </Card>

      <CajaLoginErrorModal
        isOpen={showErrorModal}
        error={modalError}
        matricula={matricula.trim()}
        hasSavedCredentials={hasSaved}
        onClose={() => setShowErrorModal(false)}
        onRetry={() => {
          setShowErrorModal(false)
          const dummyEvent = { preventDefault: () => {} } as React.FormEvent
          void handleSubmit(dummyEvent)
        }}
        onForgetSaved={() => {
          handleForgetSaved()
          setShowErrorModal(false)
        }}
      />
    </div>
  )
}
