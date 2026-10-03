import { describe, it, expect } from "vitest"
import { recommendPlatformTools, PLATFORM_TOOLS } from "../lib/platform-tools"

describe("platform-tools", () => {
  it("recomienda la calculadora de tiempo extra en preguntas de horas extra", () => {
    const tools = recommendPlatformTools("¿Cómo me pagan las horas extras y qué cláusula aplica?")
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.TIEMPO_EXTRA.id)).toBe(true)
  })

  it("recomienda la calculadora de aguinaldo en preguntas de fin de año", () => {
    const tools = recommendPlatformTools("¿Cuándo pagan el aguinaldo y cuántos días me corresponden?")
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.AGUINALDO.id)).toBe(true)
  })

  it("recomienda calendario de vacaciones y regreso de vacaciones según la consulta", () => {
    const toolsVac = recommendPlatformTools("¿Cuántos días de vacaciones tengo si llevo 10 años?")
    expect(toolsVac.some((t) => t.id === PLATFORM_TOOLS.VACACIONES.id)).toBe(true)

    const toolsRegreso = recommendPlatformTools("¿Cuándo regreso de vacaciones si mi periodo terminó el viernes?")
    expect(toolsRegreso.some((t) => t.id === PLATFORM_TOOLS.REGRESO_VACACIONES.id)).toBe(true)
  })

  it("recomienda escritos y bitácora en situaciones de conflicto laboral o actas", () => {
    const tools = recommendPlatformTools("Mi jefe me amenazó con levantarme un acta administrativa por no querer quedarme tiempo extra")
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.ESCRITOS.id)).toBe(true)
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.BITACORA.id)).toBe(true)
  })

  it("recomienda el visor de tarjetón y conceptos ante preguntas de códigos", () => {
    const tools = recommendPlatformTools("¿Qué significa el concepto 011 en mi tarjetón?")
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.GUIA_CONCEPTOS.id)).toBe(true)
    expect(tools.some((t) => t.id === PLATFORM_TOOLS.TARJETON.id)).toBe(true)
  })
})
