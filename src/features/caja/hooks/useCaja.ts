"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getCajaSessionStatus,
  getCajaBalance,
  getCajaAccount,
  getCajaDates,
  loginCaja as apiLogin,
  logoutCaja as apiLogout,
  type CajaSessionStatus,
} from "../services/caja-service"
import type { SaldoPayload, AccountProfile, DateItem } from "@/lib/caja/models"

export function useCaja() {
  const [session, setSession] = useState<CajaSessionStatus | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [balance, setBalance] = useState<SaldoPayload | null>(null)
  const [account, setAccount] = useState<AccountProfile | null>(null)
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

  const loadData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const [bal, acc, dt] = await Promise.allSettled([
        getCajaBalance(),
        getCajaAccount(),
        getCajaDates(),
      ])

      if (bal.status === "fulfilled") setBalance(bal.value)
      if (acc.status === "fulfilled") setAccount(acc.value)
      if (dt.status === "fulfilled") setDates(dt.value)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar datos de Caja")
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const st = await getCajaSessionStatus()
        if (!active) return
        setSession(st)
        if (st.authenticated) {
          setLoadingData(true)
          const [bal, acc, dt] = await Promise.allSettled([
            getCajaBalance(),
            getCajaAccount(),
            getCajaDates(),
          ])
          if (!active) return
          if (bal.status === "fulfilled") setBalance(bal.value)
          if (acc.status === "fulfilled") setAccount(acc.value)
          if (dt.status === "fulfilled") setDates(dt.value)
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
  }, [])

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
      setDates([])
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
    dates,
    error,
    login,
    logout,
    refreshData: loadData,
    checkSession,
  }
}
