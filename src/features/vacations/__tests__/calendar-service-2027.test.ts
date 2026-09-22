import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { VACATION_CALENDAR_2027 } from "../data/calendar-2027"
import { createCalendar, getPublishedCalendar } from "../services/calendar-service"

describe("Servicio de calendario 2027 autoritativo", () => {
  it("devuelve la fuente canónica sin consultar Supabase", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("No debe consultar Supabase para 2027")
      }),
    } as unknown as SupabaseClient

    await expect(getPublishedCalendar(supabase, 2027)).resolves.toBe(VACATION_CALENDAR_2027)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("impide crear una versión competidora de 2027", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("No debe escribir en Supabase para 2027")
      }),
    } as unknown as SupabaseClient

    const { id: _id, ...calendar } = VACATION_CALENDAR_2027
    const result = await createCalendar(supabase, calendar)

    expect(result).toEqual({
      error: "El calendario 2027 es autoritativo y no admite versiones alternativas.",
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
