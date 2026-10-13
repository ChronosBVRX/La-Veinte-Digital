"use client"

import { useState } from "react"
import { X, CheckCircle, Warning, Bank, ShieldCheck } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Input, Select } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { validateClabe, maskClabe } from "../lib/clabe"
import { requestCajaWithdraw } from "../services/caja-service"
import type { RetiroTipo, SaldoPayload } from "@/lib/caja/models"

interface CajaWithdrawModalProps {
  balance: SaldoPayload | null
  onClose: () => void
  onSuccess: () => void
}

export function CajaWithdrawModal({ balance, onClose, onSuccess }: CajaWithdrawModalProps) {
  const [tipo, setTipo] = useState<RetiroTipo>("PARCIAL")
  const [monto, setMonto] = useState("")
  const [clabe, setClabe] = useState("")
  const [concepto, setConcepto] = useState("Retiro de Ahorro")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{ banco?: string; cuentaClabe?: string } | null>(null)

  const clabeValidation = validateClabe(clabe)
  const maxAvailable = balance?.saldoAhorro ?? balance?.saldoTotal ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numMonto = Number.parseFloat(monto)
    if (Number.isNaN(numMonto) || numMonto <= 0) {
      setError("Ingresa un monto válido mayor a $0.")
      return
    }

    if (maxAvailable > 0 && numMonto > maxAvailable) {
      setError(`El monto no puede exceder el saldo disponible (${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(maxAvailable)}).`)
      return
    }

    if (!clabeValidation.isValid) {
      setError(clabeValidation.error || "La CLABE interbancaria es inválida.")
      return
    }

    setLoading(true)
    try {
      const res = await requestCajaWithdraw({
        tipo,
        monto: numMonto,
        cuentaClabe: clabe.trim(),
        concepto: concepto.trim(),
      })
      setSuccessResult({
        banco: res.banco || clabeValidation.bankName,
        cuentaClabe: res.cuentaClabe || maskClabe(clabe),
      })
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar el retiro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0.5rem, 2vw, 1rem)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", minWidth: 0 }}>
        <Card padding="clamp(1.125rem, 3.5vw, 1.5rem)">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
              Solicitud de Retiro
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {successResult ? (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <CheckCircle size={48} weight="fill" color="var(--success, #22c55e)" style={{ margin: "0 auto 0.75rem" }} />
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                Retiro Registrado con Éxito
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1rem", lineHeight: 1.4 }}>
                Tu solicitud de retiro ha sido enviada al sistema de Caja de Ahorro.
              </p>
              <div
                style={{
                  background: "var(--accent)",
                  padding: "0.875rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.8125rem",
                  textAlign: "left",
                  marginBottom: "1.5rem",
                }}
              >
                <div><strong>Banco:</strong> {successResult.banco}</div>
                <div><strong>CLABE destino:</strong> {successResult.cuentaClabe}</div>
                <div><strong>Tipo:</strong> Retiro {tipo}</div>
              </div>
              <Button variant="primary" size="md" fullWidth onClick={onClose}>
                Entendido
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {error && (
                <div
                  style={{
                    padding: "0.75rem",
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.25)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--error)",
                    fontSize: "0.8125rem",
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <Select
                  label="Modalidad de Retiro"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as RetiroTipo)}
                  disabled={loading}
                >
                  <option value="PARCIAL">Retiro Parcial (Saldo de Ahorro)</option>
                  <option value="TOTAL">Retiro Total / Liquidación</option>
                  <option value="QUINCENAL">Retención / Retiro Quincenal</option>
                </Select>
              </div>

              <div>
                <Input
                  label="Monto a retirar ($ MXN)"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={loading}
                  required
                />
                {maxAvailable > 0 && (
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Disponible aproximado: {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(maxAvailable)}
                  </div>
                )}
              </div>

              <div>
                <Input
                  label="Cuenta CLABE Interbancaria (18 dígitos)"
                  type="text"
                  maxLength={18}
                  placeholder="012180000000000000"
                  value={clabe}
                  onChange={(e) => setClabe(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                  invalid={clabe.length === 18 && !clabeValidation.isValid}
                  required
                />
                <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  {clabe.length === 18 ? (
                    clabeValidation.isValid ? (
                      <span style={{ color: "var(--success, #22c55e)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Bank size={14} />
                        Banco identificado: <strong>{clabeValidation.bankName}</strong>
                      </span>
                    ) : (
                      <span style={{ color: "var(--error)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Warning size={14} />
                        {clabeValidation.error}
                      </span>
                    )
                  ) : (
                    <span style={{ color: "var(--muted)" }}>
                      {clabe.length}/18 dígitos introducidos
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Input
                  label="Concepto (opcional)"
                  type="text"
                  placeholder="Ej. Gastos personales"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--accent)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.6875rem",
                  color: "var(--muted)",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                }}
              >
                <ShieldCheck size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <span>
                  El depósito se realizará exclusivamente a la cuenta bancaria a tu nombre verificada mediante el SPEI de la Caja SNTSS.
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <Button type="button" variant="outline" size="md" onClick={onClose} disabled={loading} fullWidth>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loading}
                  disabled={!clabeValidation.isValid || !monto}
                  fullWidth
                >
                  Confirmar Retiro
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
