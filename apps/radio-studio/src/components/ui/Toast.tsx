import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "./Icons";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
  durationMs?: number;
}

interface ToastContextType {
  showToast: (text: string, type?: "success" | "error" | "info", durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (text: string, type: "success" | "error" | "info" = "success", durationMs = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      setToasts((prev) => [...prev, { id, type, text, durationMs }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
              t.type === "success"
                ? "bg-slate-900/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50"
                : t.type === "error"
                ? "bg-slate-900/95 border-rose-500/40 text-rose-200 shadow-rose-950/50"
                : "bg-slate-900/95 border-blue-500/40 text-blue-200 shadow-blue-950/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.type === "success" && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
              {t.type === "error" && <AlertCircle size={16} className="text-rose-400 shrink-0" />}
              {t.type === "info" && <Info size={16} className="text-blue-400 shrink-0" />}
              <span>{t.text}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (text: string) => console.log("[TOAST]", text),
    };
  }
  return ctx;
}
