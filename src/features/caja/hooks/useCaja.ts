"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/shared/hooks/useUser"
import {
  getCajaSessionStatus,
  getCajaBalance,
  getCajaAccount,
  getCajaDates,
  getCajaLoans,
  loginCaja as apiLogin,
  logoutCaja as apiLogout,
  isCajaSessionExpired,
  type CajaSessionStatus,
} from "../services/caja-service"
import { loadCajaCredentials } from "../services/caja-credentials-storage"
import type { SaldoPayload, AccountProfile, DateItem } from "@/lib/caja/models"
import type { CajaLoanInfo } from "@/informative"

export function useCaja(userIdParam?: string) {
  const { user } = useUser()
  const effectiveUserId = userIdParam || user?.id

  const [session, setSession] = useState<CajaSessionStatus | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [balance, setBalance] = useState<SaldoPayload | null>(null)
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [loan, setLoan] = useState<CajaLoanInfo | null>(null)
  const [dates, setDates] = useState<DateItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkSession = useCallback(async () => {
    try {
      setLoadingSession(true)
      const st = await getCajaSessionStatus()
      setSession(st)
      return st
    } catch {
      setSession({ authenticated: false })
      return { authenticated: false }
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const tryAutoRecovery = useCallback(async (): Promise<boolean> => {
    if (!effectiveUserId) return false
    try {
      const saved = await loadCajaCredentials(effectiveUserId)
      if (!saved?.matricula || !saved?.password) return false

      await apiLogin(saved.matricula, saved.password)
      const st = await getCajaSessionStatus()
      setSession(st)
      return Boolean(st?.authenticated)
    } catch {
      return false
    }
  }, [effectiveUserId])

  const loadData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        getCajaBalance(),
        getCajaAccount(),
        getCajaDates(),
        getCajaLoans(),
      ])

      const [bal, acc, dt, ln] = results
      const balExpired = bal.status === "rejected" && isCajaSessionExpired(bal.reason)
      const accExpired = acc.status === "rejected" && isCajaSessionExpired(acc.reason)

      if (balExpired || accExpired) {
        // Intentar auto-recuperar sesión con credenciales locales guardadas
        const recovered = await tryAutoRecovery()
        if (recovered) {
          const retryResults = await Promise.allSettled([
            getCajaBalance(),
            getCajaAccount(),
            getCajaDates(),
            getCajaLoans(),
          ])
          const [rBal, rAcc, rDt, rLn] = retryResults
          if (rBal.status === "fulfilled") setBalance(rBal.value)
          if (rAcc.status === "fulfilled") setAccount(rAcc.value)
          if (rDt.status === "fulfilled") setDates(rDt.value)
          if (rLn.status === "fulfilled" && rLn.value?.estimate) setLoan(rLn.value.estimate)
          return
        }

        // Si no se pudo recuperar, salir de la sesión zombi y volver al login
        setSession((prev) => ({ authenticated: false, matricula: prev?.matricula }))
        setBalance(null)
        setAccount(null)
        setLoan(null)
        setDates([])
        setError("Tu sesión en la Caja de Ahorro ha expirado. Por favor ingresa nuevamente.")
        return
      }

      if (bal.status === "fulfilled") setBalance(bal.value)
      else if (bal.status === "rejected") {
        setError(bal.reason instanceof Error ? bal.reason.message : "Error al obtener saldos")
      }

      if (acc.status === "fulfilled") setAccount(acc.value)
      if (dt.status === "fulfilled") setDates(dt.value)
      if (ln.status === "fulfilled" && ln.value?.estimate) setLoan(ln.value.estimate)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar datos de Caja")
    } finally {
      setLoadingData(false)
    }
  }, [tryAutoRecovery])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const st = await getCajaSessionStatus()
        if (!active) return
        setSession(st)

        if (st.authenticated) {
          setLoadingData(true)
          const results = await Promise.allSettled([
            getCajaBalance(),
            getCajaAccount(),
            getCajaDates(),
            getCajaLoans(),
          ])
          if (!active) return

          const [bal, acc, dt, ln] = results
          const balExpired = bal.status === "rejected" && isCajaSessionExpired(bal.reason)
          const accExpired = acc.status === "rejected" && isCajaSessionExpired(acc.reason)

          if (balExpired || accExpired) {
            const recovered = await tryAutoRecovery()
            if (!active) return

            if (recovered) {
              const retryResults = await Promise.allSettled([
                getCajaBalance(),
                getCajaAccount(),
                getCajaDates(),
                getCajaLoans(),
              ])
              if (!active) return
              const [rBal, rAcc, rDt, rLn] = retryResults
              if (rBal.status === "fulfilled") setBalance(rBal.value)
              if (rAcc.status === "fulfilled") setAccount(rAcc.value)
              if (rDt.status === "fulfilled") setDates(rDt.value)
              if (rLn.status === "fulfilled" && rLn.value?.estimate) setLoan(rLn.value.estimate)
              return
            }

            setSession({ authenticated: false, matricula: st.matricula })
            setBalance(null)
            setAccount(null)
            setLoan(null)
            setDates([])
            setError("Tu sesión en la Caja de Ahorro ha expirado. Por favor ingresa nuevamente.")
            return
          }

          if (bal.status === "fulfilled") setBalance(bal.value)
          else if (bal.status === "rejected") {
            setError(bal.reason instanceof Error ? bal.reason.message : "Error al obtener saldos")
          }

          if (acc.status === "fulfilled") setAccount(acc.value)
          if (dt.status === "fulfilled") setDates(dt.value)
          if (ln.status === "fulfilled" && ln.value?.estimate) setLoan(ln.value.estimate)
        }
      } catch {
        if (active) setSession({ authenticated: false })
      } finally {
        if (active) {
          setLoadingSession(false)
          setLoadingData(false)
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [tryAutoRecovery])

  const login = async (matricula: string, pass: string) => {
    setError(null)
    setLoadingSession(true)
    try {
      await apiLogin(matricula, pass)
      await checkSession()
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión"
      setError(msg)
      throw err
    } finally {
      setLoadingSession(false)
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
      setSession({ authenticated: false })
      setBalance(null)
      setAccount(null)
      setLoan(null)
      setDates([])
      setError(null)
    } catch {
      // Ignorar
    }
  }

  return {
    session,
    loadingSession,
    loadingData,
    balance,
    account,
    loan,
    dates,
    error,
    login,
    logout,
    refreshData: loadData,
    checkSession,
  }
}
