"use client"

import {
  X,
  UsersThree,
  LockKey,
  WarningCircle,
  ClockCountdown,
  ArrowClockwise,
  Trash,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { CajaLoginError } from "../services/caja-service"

interface CajaLoginErrorModalProps {
  isOpen: boolean
  error: CajaLoginError | Error | null
  matricula?: string
  hasSavedCredentials?: boolean
  onClose: () => void
  onRetry?: () => void
  onForgetSaved?: () => void
}

export function CajaLoginErrorModal({
  isOpen,
  error,
  matricula,
  hasSavedCredentials = false,
  onClose,
  onRetry,
  onForgetSaved,
}: CajaLoginErrorModalProps) {
  if (!isOpen || !error) return null

  const errorMessage = error.message || "Error al autenticar con Caja SNTSS"
  const cajaErr = error as CajaLoginError
  const isSessionActive =
    cajaErr.isSessionActive ||
    /sesi[oó]n.*activa/i.test(errorMessage) ||
    cajaErr.code === "1041"

  const isCredentialsError =
    cajaErr.code === "1040" ||
    /incorrect[oa]s/i.test(errorMessage) ||
    /password/i.test(errorMessage) ||
    /contrase[ñn]a/i.test(errorMessage)

  const isMatriculaNotFound =
    /no.*encontrada/i.test(errorMessage) ||
    /no.*existe/i.test(errorMessage)

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "clamp(0.5rem, 2vw, 1rem)",
        boxSizing: "border-box",
        minWidth: 0,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-error-modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "92vh",
          overflowY: "auto",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        <Card padding="clamp(1.25rem, 3.5vw, 1.75rem)">
          {/* Encabezado y botón cerrar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--radius-lg)",
                background: isSessionActive
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(220, 38, 38, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: isSessionActive
                  ? "1px solid rgba(245, 158, 11, 0.3)"
                  : "1px solid rgba(220, 38, 38, 0.25)",
              }}
            >
              {isSessionActive ? (
                <UsersThree size={30} weight="duotone" color="#d97706" />
              ) : isCredentialsError ? (
                <LockKey size={30} weight="duotone" color="var(--error, #dc2626)" />
              ) : (
                <WarningCircle size={30} weight="duotone" color="var(--error, #dc2626)" />
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--muted)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Título */}
          <h3
            id="login-error-modal-title"
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              margin: "0 0 0.5rem",
              color: "var(--fg)",
            }}
          >
            {isSessionActive
              ? "Sesión Activa Detectada en Caja SNTSS"
              : isMatriculaNotFound
              ? "Matrícula no encontrada"
              : isCredentialsError
              ? "Credenciales no válidas"
              : "No fue posible iniciar sesión"}
          </h3>

          {/* Mensaje oficial del servidor de Caja */}
          <div
            style={{
              padding: "0.75rem 1rem",
              background: isSessionActive ? "#fffbeb" : "rgba(220, 38, 38, 0.06)",
              border: isSessionActive ? "1px solid #fde68a" : "1px solid rgba(220, 38, 38, 0.2)",
              borderRadius: "var(--radius-md)",
              marginBottom: "1rem",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: isSessionActive ? "#92400e" : "var(--error, #dc2626)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                marginBottom: "0.25rem",
              }}
            >
              Respuesta del servidor oficial:
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                color: isSessionActive ? "#78350f" : "var(--fg)",
                fontWeight: 500,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {errorMessage}
            </div>
          </div>

          {/* Explicación y pasos a seguir */}
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
              lineHeight: 1.5,
              marginBottom: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
            }}
          >
            {isSessionActive ? (
              <>
                <p style={{ margin: 0 }}>
                  El servidor de la <strong>Caja de Ahorro SNTSS</strong> únicamente permite <strong>una sesión conectada a la vez</strong> por matrícula{matricula ? ` (${matricula})` : ""}.
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    padding: "0.625rem 0.75rem",
                    background: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--fg)",
                  }}
                >
                  <ClockCountdown size={18} style={{ flexShrink: 0, marginTop: "0.15rem" }} color="#d97706" />
                  <span>
                    Si cerraste la aplicación recientemente o abriste tu cuenta en otro teléfono, el servidor de Caja liberará el acceso automáticamente en <strong>unos momentos (2 a 3 minutos)</strong>.
                  </span>
                </div>
              </>
            ) : isCredentialsError ? (
              <>
                <p style={{ margin: 0 }}>
                  La matrícula o la contraseña ingresadas no coinciden con las registradas ante la Caja de Previsión y Ahorro SNTSS.
                </p>
                <p style={{ margin: 0, fontSize: "0.78125rem" }}>
                  <em>Nota:</em> La contraseña de la Caja de Ahorro es la de tu cuenta de Caja SNTSS, la cual puede ser diferente a la de tu tarjetón IMSS o de La Veinte Digital.
                </p>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                Ocurrió una eventualidad al comunicar con los servicios de Caja SNTSS. Por favor verifica tu conexión a internet o intenta en un momento.
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              width: "100%",
            }}
          >
            {onRetry && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onRetry}
                fullWidth
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                  <ArrowClockwise size={16} />
                  <span>Reintentar inicio de sesión</span>
                </span>
              </Button>
            )}

            {hasSavedCredentials && onForgetSaved && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onForgetSaved}
                fullWidth
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                  <Trash size={16} />
                  <span>Borrar credenciales guardadas y reescribir</span>
                </span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              fullWidth
            >
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
