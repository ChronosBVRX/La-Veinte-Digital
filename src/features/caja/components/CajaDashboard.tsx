"use client"

import { useState } from "react"
import { PiggyBank, HandCoins, CurrencyDollar, CalendarDots, User } from "@phosphor-icons/react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { useUser } from "@/shared/hooks/useUser"
import { useCaja } from "../hooks/useCaja"
import { CajaHeader } from "./CajaHeader"
import { CajaLoginCard } from "./CajaLoginCard"
import { CajaBalanceCard } from "./CajaBalanceCard"
import { CajaWithdrawModal } from "./CajaWithdrawModal"
import { CajaLoanCard } from "./CajaLoanCard"
import { CajaDatesCard } from "./CajaDatesCard"
import { CajaInfoCard } from "./CajaInfoCard"

type ActiveTab = "saldos" | "retiros" | "prestamos" | "citas" | "cuenta"

export function CajaDashboard() {
  const { user } = useUser()
  const {
    session,
    loadingSession,
    loadingData,
    balance,
    account,
    dates,
    login,
    logout,
    refreshData,
  } = useCaja()

  const [activeTab, setActiveTab] = useState<ActiveTab>("saldos")
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  if (loadingSession) {
    return (
      <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <LoadingSpinner text="Cargando Caja de Ahorro SNTSS..." />
      </div>
    )
  }

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto", paddingBottom: "3rem", boxSizing: "border-box", minWidth: 0 }}>
      <CajaHeader session={session} onLogout={logout} />

      {!session?.authenticated ? (
        <CajaLoginCard onLogin={login} initialMatricula={session?.matricula} userId={user?.id} />
      ) : (
        <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Navegación por pestañas */}
          <div
            style={{
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              gap: "0.25rem",
              borderBottom: "1px solid var(--border)",
              marginBottom: "1.25rem",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              minWidth: 0,
              paddingBottom: "2px",
            }}
          >
            <button
              onClick={() => setActiveTab("saldos")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 0.75rem",
                border: "none",
                background: "none",
                borderBottom: activeTab === "saldos" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "saldos" ? "var(--primary)" : "var(--muted)",
                fontWeight: activeTab === "saldos" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <PiggyBank size={18} weight={activeTab === "saldos" ? "fill" : "regular"} />
              <span>Saldos y Ahorro</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("retiros")
                setShowWithdrawModal(true)
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 0.75rem",
                border: "none",
                background: "none",
                borderBottom: activeTab === "retiros" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "retiros" ? "var(--primary)" : "var(--muted)",
                fontWeight: activeTab === "retiros" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <HandCoins size={18} weight={activeTab === "retiros" ? "fill" : "regular"} />
              <span>Retiros</span>
            </button>

            <button
              onClick={() => setActiveTab("prestamos")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 0.75rem",
                border: "none",
                background: "none",
                borderBottom: activeTab === "prestamos" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "prestamos" ? "var(--primary)" : "var(--muted)",
                fontWeight: activeTab === "prestamos" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <CurrencyDollar size={18} weight={activeTab === "prestamos" ? "fill" : "regular"} />
              <span>Préstamos</span>
            </button>

            <button
              onClick={() => setActiveTab("citas")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 0.75rem",
                border: "none",
                background: "none",
                borderBottom: activeTab === "citas" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "citas" ? "var(--primary)" : "var(--muted)",
                fontWeight: activeTab === "citas" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <CalendarDots size={18} weight={activeTab === "citas" ? "fill" : "regular"} />
              <span>Citas ({dates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("cuenta")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 0.75rem",
                border: "none",
                background: "none",
                borderBottom: activeTab === "cuenta" ? "2px solid var(--primary)" : "2px solid transparent",
                color: activeTab === "cuenta" ? "var(--primary)" : "var(--muted)",
                fontWeight: activeTab === "cuenta" ? 700 : 500,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <User size={18} weight={activeTab === "cuenta" ? "fill" : "regular"} />
              <span>Mi Cuenta</span>
            </button>
          </div>

          {/* Contenido de la pestaña activa */}
          {activeTab === "saldos" && (
            <CajaBalanceCard
              balance={balance}
              loading={loadingData}
              onRefresh={refreshData}
              onOpenWithdraw={() => setShowWithdrawModal(true)}
            />
          )}

          {activeTab === "retiros" && (
            <div>
              <CajaBalanceCard
                balance={balance}
                loading={loadingData}
                onRefresh={refreshData}
                onOpenWithdraw={() => setShowWithdrawModal(true)}
              />
            </div>
          )}

          {activeTab === "prestamos" && (
            <CajaLoanCard
              balance={balance}
              account={account}
              onRefresh={refreshData}
            />
          )}

          {activeTab === "citas" && (
            <CajaDatesCard
              dates={dates}
              loading={loadingData}
              onRefresh={refreshData}
            />
          )}

          {activeTab === "cuenta" && (
            <CajaInfoCard
              account={account}
              matricula={session?.matricula}
            />
          )}

          {/* Modal de retiro */}
          {showWithdrawModal && (
            <CajaWithdrawModal
              balance={balance}
              onClose={() => setShowWithdrawModal(false)}
              onSuccess={() => {
                refreshData()
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
