"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export function useRealtimeSubscription<T extends Record<string, unknown>>(
  table: string,
  filter?: string
) {
  const [records, setRecords] = useState<T[]>([])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`public:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === "INSERT") {
            setRecords((prev) => [...prev, payload.new])
          } else       if (payload.eventType === "DELETE") {
            setRecords((prev) =>
              prev.filter((r) => (r as Record<string, unknown>).id !== (payload.old as Record<string, unknown>).id)
            )
          } else if (payload.eventType === "UPDATE") {
            setRecords((prev) =>
              prev.map((r) =>
                (r as Record<string, unknown>).id === (payload.new as Record<string, unknown>).id ? payload.new : r
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])

  return records
}
