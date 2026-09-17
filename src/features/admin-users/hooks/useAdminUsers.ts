"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AdminUserListQuery, AdminUserPage } from "@/shared/contracts/admin-users"
import { DEFAULT_ADMIN_USERS_QUERY } from "@/shared/contracts/admin-users"
import { fetchAdminUsers } from "@/features/admin-users/services/admin-users-client"

export interface AdminUsersListState {
  status: "loading" | "ready" | "error"
  data: AdminUserPage | null
  error: string | null
  updating: boolean
}

export function useAdminUsers(initialPage: AdminUserPage | null, initialError: boolean) {
  const [query, setQueryState] = useState<AdminUserListQuery>(DEFAULT_ADMIN_USERS_QUERY)
  const [state, setState] = useState<AdminUsersListState>(() => {
    if (initialPage) return { status: "ready", data: initialPage, error: null, updating: false }
    if (initialError) {
      return {
        status: "error",
        data: null,
        error: "No se pudo cargar el listado de usuarios.",
        updating: false,
      }
    }
    return { status: "loading", data: null, error: null, updating: false }
  })

  // El servidor ya intentó la primera carga (éxito o error): no se reintenta
  // automáticamente en el montaje para no duplicar consultas si el backend
  // está caído; el reintento es explícito desde la interfaz.
  const skipInitialFetch = useRef(Boolean(initialPage || initialError))
  const requestId = useRef(0)

  const load = useCallback(async (nextQuery: AdminUserListQuery) => {
    const currentRequest = ++requestId.current
    setState((previous) => ({
      status: previous.data ? "ready" : "loading",
      data: previous.data,
      error: null,
      updating: true,
    }))

    try {
      const page = await fetchAdminUsers(nextQuery)
      if (currentRequest !== requestId.current) return
      setState({ status: "ready", data: page, error: null, updating: false })
    } catch (error) {
      if (currentRequest !== requestId.current) return
      const message = error instanceof Error ? error.message : "No se pudo cargar el listado."
      setState((previous) => ({
        status: previous.data ? "ready" : "error",
        data: previous.data,
        error: message,
        updating: false,
      }))
    }
  }, [])

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    void load(query)
  }, [load, query])

  const setQuery = useCallback((patch: Partial<AdminUserListQuery>) => {
    setQueryState((previous) => {
      const next = { ...previous, ...patch }
      if (!("page" in patch)) next.page = 1
      return next
    })
  }, [])

  const refresh = useCallback(() => {
    void load(query)
  }, [load, query])

  return { query, setQuery, refresh, ...state }
}
