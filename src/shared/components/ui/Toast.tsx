"use client"

import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

const bgColors: Record<ToastType, string> = {
  success: "#f0fdf4",
  error: "#fef2f2",
  warning: "#fffbeb",
  info: "#eff6ff",
}

const borderColors: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--info)",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    const durations: Record<ToastType, number> = {
      success: 4000,
      info: 5000,
      warning: 5000,
      error: 7000,
    }
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durations[type])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div style={{
        position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
        display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "360px",
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-up"
            style={{
              background: bgColors[t.type],
              border: `1px solid ${borderColors[t.type]}`,
              borderRadius: "var(--radius)",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "var(--shadow-md)",
              fontSize: "0.875rem",
              color: "var(--fg)",
            }}
          >
            <span style={{ color: borderColors[t.type], flexShrink: 0 }}>{icons[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, flexShrink: 0 }}
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
