"use client"

import { useState, useEffect, useCallback } from "react"
import { getTodayLocalDateString } from "./commitment-calendar"

const DATE_CHANGE_EVENT = "lvd:agenda-date-change"
const COMMITMENTS_UPDATED_EVENT = "lvd:commitments-updated"

let currentSelectedDate: string = ""

function getInitialDate(): string {
  if (currentSelectedDate) return currentSelectedDate

  if (typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const urlDate = urlParams.get("date")
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        currentSelectedDate = urlDate
        return urlDate
      }
    } catch {
      // ignore
    }
  }

  currentSelectedDate = getTodayLocalDateString()
  return currentSelectedDate
}

/**
 * Updates the globally selected agenda date and notifies all listeners.
 */
export function setSelectedAgendaDate(dateStr: string): void {
  if (!dateStr || dateStr === currentSelectedDate) return
  currentSelectedDate = dateStr

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DATE_CHANGE_EVENT, { detail: { date: dateStr } }),
    )
  }
}

/**
 * Returns the currently selected agenda date string (YYYY-MM-DD).
 */
export function getSelectedAgendaDate(): string {
  return currentSelectedDate || getInitialDate()
}

/**
 * Hook to consume and update the selected agenda date.
 */
export function useSelectedAgendaDate(initialFallback?: string): [string, (date: string) => void] {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialFallback || getSelectedAgendaDate()
  })

  useEffect(() => {
    const handleDateChange = (e: Event) => {
      const custom = e as CustomEvent<{ date: string }>
      if (custom.detail?.date) {
        setSelectedDate(custom.detail.date)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener(DATE_CHANGE_EVENT, handleDateChange)
      return () => {
        window.removeEventListener(DATE_CHANGE_EVENT, handleDateChange)
      }
    }
  }, [])

  const update = useCallback((newDate: string) => {
    setSelectedDate(newDate)
    setSelectedAgendaDate(newDate)
  }, [])

  return [selectedDate, update]
}

/**
 * Dispatches a notification that commitments have been added, updated, or removed,
 * so that any observing component (calendar, agenda card, home) can refresh immediately.
 */
export function notifyCommitmentsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMITMENTS_UPDATED_EVENT))
  }
}

/**
 * Subscribes a callback to the commitments updated event.
 */
export function useCommitmentsListener(onUpdated: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined") return
    window.addEventListener(COMMITMENTS_UPDATED_EVENT, onUpdated)
    return () => {
      window.removeEventListener(COMMITMENTS_UPDATED_EVENT, onUpdated)
    }
  }, [onUpdated])
}
