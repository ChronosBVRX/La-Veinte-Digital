import { describe, it, expect } from "vitest"
import {
  isWorkerContextQuery,
  isConversationalGreeting,
  buildTarjetonSource,
  findTarjetonGuideSource,
} from "../lib/tarjeton-knowledge"
import type { SanitizedWorkerProfile } from "../lib/worker-context-adapter"

describe("tarjeton-knowledge", () => {
  describe("isWorkerContextQuery", () => {
    it("detecta preguntas sobre el tarjetón del trabajador", () => {
      expect(isWorkerContextQuery("¿Cuánto cobré en mi último tarjetón?")).toBe(true)
      expect(isWorkerContextQuery("cuáles son mis deducciones")).toBe(true)
      expect(isWorkerContextQuery("mis percepciones en mi nómina")).toBe(true)
      expect(isWorkerContextQuery("cuánto me llegó en mi quincena")).toBe(true)
      expect(isWorkerContextQuery("por qué me descontaron el concepto 052")).toBe(true)
      expect(isWorkerContextQuery("cuántas faltas o retardos tengo")).toBe(true)
      expect(isWorkerContextQuery("cuántas marcas sin retardo tengo")).toBe(true)
      expect(isWorkerContextQuery("qué significa mi marca de continuidad")).toBe(true)
      expect(isWorkerContextQuery("Soy 08 y no tengo todo el año trabajado, ¿cuánto me van a pagar de aguinaldo?")).toBe(true)
      expect(isWorkerContextQuery("Soy 08, ¿cuánto me toca de la segunda de julio?")).toBe(true)
      expect(isWorkerContextQuery("¿Cómo se calcula el fondo de ahorro para un sustituto?")).toBe(true)
    })

    it("detecta preguntas de identidad, expediente, puesto, agenda, bitácora y acompañamiento", () => {
      expect(isWorkerContextQuery("¿Quién soy y qué puesto tengo?")).toBe(true)
      expect(isWorkerContextQuery("¿Qué sabes de mí?")).toBe(true)
      expect(isWorkerContextQuery("¿Cómo me llamo?")).toBe(true)
      expect(isWorkerContextQuery("cuál es mi nombre")).toBe(true)
      expect(isWorkerContextQuery("cuál es mi adscripción")).toBe(true)
      expect(isWorkerContextQuery("qué tengo en mi bitácora")).toBe(true)
      expect(isWorkerContextQuery("cuáles son mis notas en mi agenda")).toBe(true)
      expect(isWorkerContextQuery("qué compromisos o guardias tengo")).toBe(true)
      expect(isWorkerContextQuery("cómo ves mi situación laboral")).toBe(true)
      expect(isWorkerContextQuery("amigo, acompáñame a revisar mis pendientes")).toBe(true)
    })

    it("no confunde preguntas genéricas sobre leyes o reglamentos", () => {
      expect(isWorkerContextQuery("¿Qué dice la LFT sobre el despido?")).toBe(false)
      expect(isWorkerContextQuery("Explícame el artículo 123 constitucional")).toBe(false)
      expect(isWorkerContextQuery("¿Cuáles son los requisitos de jubilación IMSS?")).toBe(false)
    })
  })

  describe("isConversationalGreeting", () => {
    it("detecta saludos amigables directos", () => {
      expect(isConversationalGreeting("hola")).toBe(true)
      expect(isConversationalGreeting("Hola amigo")).toBe(true)
      expect(isConversationalGreeting("¡Buenas tardes compañero!")).toBe(true)
      expect(isConversationalGreeting("¿Cómo estás?")).toBe(true)
      expect(isConversationalGreeting("Qué tal hermano")).toBe(true)
    })

    it("no clasifica preguntas de contenido normativo como saludos puros", () => {
      expect(isConversationalGreeting("Hola, ¿cuántos días de aguinaldo me tocan?")).toBe(false)
      expect(isConversationalGreeting("Buenas tardes, explícame la cláusula 63 Bis")).toBe(false)
    })
  })

  describe("buildTarjetonSource", () => {
    it("crea una fuente de evidencia con score 999 para el tarjetón del usuario", () => {
      const profile: SanitizedWorkerProfile = {
        hasProfile: true,
        hasTarjeton: true,
        nombre: "María Elena García",
        categoria: "ENFERMERA JEFE DE PISO",
        categoriaCodigo: "20570090",
        jornadaHoras: 8,
        tarjeton: {
          periodo: "1A-SEP-2026",
          percepcionesTotal: 18500.5,
          deduccionesTotal: 3400.2,
          netoPagar: 15100.3,
          salarioIntegradoAproximado: 32000,
          percepciones: [
            { codigo: "002", nombre: "Sueldo Base", importe: 6000, tipo: "percepcion" },
            { codigo: "022", nombre: "Ayuda Renta Cl. 63 Bis", importe: 2100, tipo: "percepcion" },
          ],
          deducciones: [
            { codigo: "151", nombre: "ISR", importe: 1800, tipo: "deduccion" },
            { codigo: "052", nombre: "Cuota Sindical", importe: 220, tipo: "deduccion" },
          ],
        },
        asistencia: {
          sinRetardo: 10,
          diasConcepto033: 2,
          retardos: 0,
          faltas: 0,
        },
        vacacionesDetalle: {
          marcaContinuidad: 0,
          periodoPorDisfrutar: 2,
          diasEnElAno: 20,
        },
      }

      const src = buildTarjetonSource(profile)
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("1A-SEP-2026")
      expect(src?.score).toBe(999)
      expect(src?.origin).toBe("worker_tarjeton")
      expect(src?.fragmento).toContain("María Elena García")
      expect(src?.fragmento).toContain("15100.30")
      expect(src?.fragmento).toContain("Cpto [022]")
      expect(src?.fragmento).toContain("Cpto [052]")
      expect(src?.fragmento).toContain("sin retardo")
    })

    it("devuelve null si no hay datos de tarjetón ni de perfil", () => {
      const empty: SanitizedWorkerProfile = {
        hasProfile: false,
        hasTarjeton: false,
      }
      expect(buildTarjetonSource(empty)).toBeNull()
    })
  })

  describe("findTarjetonGuideSource", () => {
    it("encuentra y desglosa el concepto 022", () => {
      const src = findTarjetonGuideSource("¿Qué es el concepto 022 en mi tarjetón?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Concepto 022")
      expect(src?.score).toBe(850)
      expect(src?.fragmento).toContain("022")
    })

    it("encuentra y desglosa el concepto 052 (cuota sindical)", () => {
      const src = findTarjetonGuideSource("¿Por qué me descuentan el concepto 052?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Concepto 052")
      expect(src?.fragmento).toContain("052")
    })

    it("encuentra la guía de marcas sin retardo / puntualidad", () => {
      const src = findTarjetonGuideSource("¿Qué significa sin retardo en mis marcas?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Asistencia y Puntualidad")
      expect(src?.fragmento).toContain("5 minutos de tolerancia")
      expect(src?.fragmento).toContain("Concepto 033")
    })

    it("encuentra la guía de marca de continuidad vacacional 2", () => {
      const src = findTarjetonGuideSource("¿Qué significa la marca de continuidad 2 en mis vacaciones?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Continuidad Vacacional")
      expect(src?.fragmento).toContain("Marca de Continuidad 2")
    })

    it("encuentra la guía de marcas de ocupación de plaza 00", () => {
      const src = findTarjetonGuideSource("¿Qué es la marca de ocupación 00?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Ocupación de Plaza")
      expect(src?.fragmento).toContain("Marca 00")
    })

    it("encuentra la guía de aguinaldo (Cláusula 107 CCT) y cálculo proporcional para 08", () => {
      const src = findTarjetonGuideSource("Soy 08 y no tengo todo el año trabajado, ¿cuánto me van a pagar de aguinaldo?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Cláusula 107")
      expect(src?.origin).toBe("tarjeton_guide_aguinaldo")
      expect(src?.fragmento).toContain("7.5 días de salario")
      expect(src?.fragmento).toContain("90 días")
      expect(src?.sourceUrl).toBe("/calculadoras/aguinaldo")
    })

    it("encuentra la guía de segunda de julio / fondo de ahorro (Cláusula 144 CCT) y cálculo proporcional", () => {
      const src = findTarjetonGuideSource("Soy 08, ¿cuánto me toca de la segunda de julio?")
      expect(src).not.toBeNull()
      expect(src?.documento).toContain("Cláusula 144")
      expect(src?.origin).toBe("tarjeton_guide_segunda_julio")
      expect(src?.fragmento).toContain("46 días")
      expect(src?.fragmento).toContain("3.83 días")
      expect(src?.sourceUrl).toBe("/calculadoras/segunda-julio-proporcional")
    })

    it("encuentra el aguinaldo buscando por concepto 049", () => {
      const src = findTarjetonGuideSource("¿Qué es el concepto 049 en mi tarjetón?")
      expect(src).not.toBeNull()
      expect(src?.origin).toBe("tarjeton_guide_aguinaldo")
      expect(src?.fragmento).toContain("Concepto 049")
    })

    it("encuentra la segunda de julio buscando por concepto 055", () => {
      const src = findTarjetonGuideSource("Explícame el concepto 055 de mi nómina")
      expect(src).not.toBeNull()
      expect(src?.origin).toBe("tarjeton_guide_segunda_julio")
      expect(src?.fragmento).toContain("Concepto 055")
    })

    it("devuelve null para preguntas no relacionadas con conceptos o marcas del tarjetón", () => {
      expect(findTarjetonGuideSource("¿Cuáles son los requisitos para un cambio de adscripción?")).toBeNull()
      expect(findTarjetonGuideSource("¿Qué dice la LFT sobre el despido injustificado?")).toBeNull()
    })
  })
})
