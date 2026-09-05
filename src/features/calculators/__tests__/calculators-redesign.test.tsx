// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AguinaldoCalculator } from "../components/AguinaldoCalculator"
import { SegundaJulioCalculator } from "../components/SegundaJulioCalculator"
import { Clausula97Calculator } from "../components/Clausula97Calculator"
import { TiempoExtraCalculator } from "../components/TiempoExtraCalculator"
import { PrestamosCategoriaCalculator } from "../components/PrestamosCategoriaCalculator"
import {
  calculateAguinaldo,
  calculateSegundaJulio,
  calculateSegundaJulioProporcional,
  calculateClausula97,
  calculateTiempoExtra,
} from "../lib"
import { formatCurrency } from "../lib/money"

// Mock useCalculatorPrefill to provide controllable test data without network calls
vi.mock("../hooks/useCalculatorPrefill", () => ({
  useCalculatorPrefill: () => ({
    data: null,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

describe("Calculadoras Rediseño - UX y Equivalencia Matemática", () => {
  describe("AguinaldoCalculator", () => {
    it("muestra introducción humana, calcula con precisión y expone desglose y detalle técnico", () => {
      render(<AguinaldoCalculator />)

      expect(screen.getByText("Calcula cuánto recibirás de aguinaldo")).toBeTruthy()
      expect(screen.getByText("Cláusula 107 CCT")).toBeTruthy()

      // Inputs humanos
      const sueldoInput = screen.getByLabelText("Tu sueldo quincenal") as HTMLInputElement
      const rentaInput = screen.getByLabelText("Ayuda de renta") as HTMLInputElement

      fireEvent.change(sueldoInput, { target: { value: "10000" } })
      fireEvent.change(rentaInput, { target: { value: "2000" } })

      const calcBtn = screen.getByText("Calcular aguinaldo")
      fireEvent.click(calcBtn)

      // Verificación matemática idéntica
      const expected = calculateAguinaldo({ concepto002: 10000, concepto011: 2000 })
      expect(expected.totalAnual).toBe(72000)
      expect(expected.anticipoEnero047).toBe(12000)
      expect(expected.saldoDiciembre049).toBe(60000)

      // El resultado principal muestra el total grande
      expect(screen.getByText(formatCurrency(72000))).toBeTruthy()
      expect(screen.getByText("Tu aguinaldo total estimado del año")).toBeTruthy()

      // Desglose humano
      expect(screen.getByText("Ya recibiste en enero")).toBeTruthy()
      expect(screen.getByText("Concepto 047")).toBeTruthy()
      expect(screen.getByText("Te faltaría recibir en diciembre")).toBeTruthy()
      expect(screen.getByText("Concepto 049")).toBeTruthy()

      // Detalle técnico colapsado por defecto
      const toggleTech = screen.getByText("Ver cómo se calculó y fundamento legal")
      expect(toggleTech).toBeTruthy()
      expect(screen.queryByText("Base quincenal integrada (002 + 011)")).toBeNull()

      // Al expandir el detalle técnico se revelan las fórmulas y bases normativas
      fireEvent.click(toggleTech)
      expect(screen.getByText("Base quincenal integrada (002 + 011)")).toBeTruthy()
      expect(screen.getByText("Cláusula 107 del Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027 (3 meses de sueldo nominal integrado).")).toBeTruthy()
    })

    it("permite limpiar el formulario y resetear estado", () => {
      render(<AguinaldoCalculator />)
      const sueldoInput = screen.getByLabelText("Tu sueldo quincenal") as HTMLInputElement
      fireEvent.change(sueldoInput, { target: { value: "8500" } })

      const limpiarBtn = screen.getByText("Limpiar")
      fireEvent.click(limpiarBtn)

      expect(sueldoInput.value).toBe("")
    })
  })

  describe("SegundaJulioCalculator unificada", () => {
    it("soporta periodo completo con resultado matemático idéntico", () => {
      render(<SegundaJulioCalculator />)

      expect(screen.getByText("Calcula cuánto recibirás en tu Segunda de Julio")).toBeTruthy()
      expect(screen.getByText("¿Trabajaste todo el periodo del 1 de julio al 30 de junio?")).toBeTruthy()

      const sueldoInput = screen.getByLabelText("Tu sueldo quincenal") as HTMLInputElement
      const rentaInput = screen.getByLabelText("Ayuda de renta") as HTMLInputElement

      fireEvent.change(sueldoInput, { target: { value: "3937.64" } })
      fireEvent.change(rentaInput, { target: { value: "3234.77" } })

      const calcBtn = screen.getByText("Calcular Segunda de Julio")
      fireEvent.click(calcBtn)

      const expectedFull = calculateSegundaJulio({ concepto002: 3937.64, concepto011: 3234.77 })
      expect(screen.getByText(formatCurrency(expectedFull))).toBeTruthy()

      // Detalle técnico
      const toggleTech = screen.getByText("Ver cálculo y fundamento legal")
      fireEvent.click(toggleTech)
      expect(screen.getByText("Cláusula 144 del CCT IMSS-SNTSS (Fondo de Ahorro) y Cláusula 63 Bis inciso b (integración de ayuda de renta).")).toBeTruthy()
    })

    it("soporta periodo parcial/proporcional cambiando la opción de periodo", () => {
      render(<SegundaJulioCalculator />)

      const opcionParcial = screen.getByText("No, trabajé solo una parte")
      fireEvent.click(opcionParcial)

      expect(screen.getByText("Unidades que se tomarán en cuenta")).toBeTruthy()

      const sueldoInput = screen.getByLabelText("Tu sueldo quincenal") as HTMLInputElement
      const rentaInput = screen.getByLabelText("Ayuda de renta") as HTMLInputElement
      const unidadesInput = screen.getByLabelText("Unidades que se tomarán en cuenta") as HTMLInputElement

      fireEvent.change(sueldoInput, { target: { value: "10000" } })
      fireEvent.change(rentaInput, { target: { value: "2000" } })
      fireEvent.change(unidadesInput, { target: { value: "180" } })

      const calcBtn = screen.getByText("Calcular Segunda de Julio")
      fireEvent.click(calcBtn)

      const expectedProp = calculateSegundaJulioProporcional({
        concepto002: 10000,
        concepto011: 2000,
        unidades: 180,
      })
      expect(screen.getAllByText(formatCurrency(expectedProp.resultado)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("SEGUNDA DE JULIO PROPORCIONAL")).toBeTruthy()
    })
  })

  describe("Clausula97Calculator (Anticipo de sueldo)", () => {
    it("calcula anticipos para 1, 2, 3 y 4 meses con selección interactiva", () => {
      render(<Clausula97Calculator />)

      expect(screen.getByText("Anticipo de sueldo")).toBeTruthy()
      expect(screen.getByText("Cláusula 97 CCT")).toBeTruthy()

      const sueldoInput = screen.getByLabelText("Tu sueldo quincenal") as HTMLInputElement
      const rentaInput = screen.getByLabelText("Ayuda de renta") as HTMLInputElement

      fireEvent.change(sueldoInput, { target: { value: "10000" } })
      fireEvent.change(rentaInput, { target: { value: "2000" } })

      const calcBtn = screen.getByText("Calcular opciones de anticipo")
      fireEvent.click(calcBtn)

      const expected = calculateClausula97({ concepto002: 10000, concepto011: 2000 })
      expect(expected.baseMensual).toBe(24000)
      expect(expected.dosMeses).toBe(48000)

      // Selección de 2 meses por defecto
      expect(screen.getByText("ANTICIPO DE 2 MESES")).toBeTruthy()
      expect(screen.getAllByText(formatCurrency(48000)).length).toBeGreaterThanOrEqual(1)

      // Cambio interactivo a 4 meses
      const btn4Meses = screen.getAllByText("4 meses")[0]
      fireEvent.click(btn4Meses)

      expect(screen.getByText("ANTICIPO DE 4 MESES")).toBeTruthy()
      expect(screen.getAllByText(formatCurrency(expected.cuatroMeses)).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("TiempoExtraCalculator", () => {
    it("calcula horas ordinarias y extraordinarias con valor hora preciso", () => {
      render(<TiempoExtraCalculator />)

      expect(screen.getByText("Calcula cuánto te pagarían por tus horas extra")).toBeTruthy()

      const sueldoInput = screen.getByLabelText("Sueldo quincenal") as HTMLInputElement
      const rentaInput = screen.getByLabelText("Ayuda de renta") as HTMLInputElement
      const horasInput = screen.getByLabelText("Horas extra trabajadas en la quincena") as HTMLInputElement

      fireEvent.change(sueldoInput, { target: { value: "10000" } })
      fireEvent.change(rentaInput, { target: { value: "2000" } })
      fireEvent.change(horasInput, { target: { value: "5" } })

      const calcBtn = screen.getByText("Calcular pago de horas extra")
      fireEvent.click(calcBtn)

      const expected = calculateTiempoExtra({
        concepto002: 10000,
        concepto011: 2000,
        concepto020: 0,
        conceptoAdicional1: 0,
        conceptoAdicional2: 0,
        concepto050: 0,
        jornada: 8,
        horasExtra: 5,
        baseNormativa: {
          conceptos: [
            { code: "002", amount: 10000 },
            { code: "011", amount: 2000 },
            { code: "020", amount: 0 },
            { code: "023", amount: 0 },
            { code: "063", amount: 0 },
            { code: "050", amount: 0 },
          ],
          baseAmount: 12000,
        },
      })

      expect(screen.getAllByText(formatCurrency(expected.pago)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("PAGO ESTIMADO")).toBeTruthy()

      // Detalle técnico disponible
      const toggleTech = screen.getByText("Ver cómo se calculó y fundamento legal")
      fireEvent.click(toggleTech)
      expect(screen.getByText("Procedimiento institucional 1A74-003-031, Cláusula 33 del CCT y Artículos 66 a 68 de la Ley Federal del Trabajo.")).toBeTruthy()
    })

    it("muestra TarjetonDataNotice cuando la categoría está precargada y permite alternar edición", () => {
      render(<TiempoExtraCalculator initialCategoria="MEDICO GENERAL 80" />)

      // Debe mostrar el banner de datos encontrados
      expect(screen.getByText("Datos listos para calcular")).toBeTruthy()
      expect(screen.getByText("Revisar o cambiar datos")).toBeTruthy()

      // Alternar edición
      const toggleBtn = screen.getByText("Revisar o cambiar datos")
      fireEvent.click(toggleBtn)

      expect(screen.getByLabelText("Sueldo quincenal")).toBeTruthy()
    })
  })

  describe("PrestamosCategoriaCalculator", () => {
    it("muestra tarjetas de préstamos y detalle técnico de tabulador", () => {
      render(<PrestamosCategoriaCalculator />)

      expect(screen.getByText("Consulta cuánto puedes solicitar según tu categoría")).toBeTruthy()
      expect(screen.getByText("¿Cuál es tu categoría o puesto de trabajo?")).toBeTruthy()

      // Seleccionar una categoría de la lista
      const searchInput = screen.getByPlaceholderText("Escribe tu puesto (ej: médico, enfermera, auxiliar, 08, 02...)")
      fireEvent.change(searchInput, { target: { value: "MEDICO" } })

      const firstMatch = screen.getAllByText("Consultar →")[0]
      fireEvent.click(firstMatch)

      expect(screen.getByText("Préstamos y montos disponibles para tu puesto")).toBeTruthy()
      expect(screen.getByText("Guardar en mi perfil")).toBeTruthy()

      // Detalle técnico
      const toggleTech = screen.getByText("Ver datos de tabulador y fórmulas utilizadas")
      fireEvent.click(toggleTech)
      expect(screen.getByText("Fórmulas contractuales por modalidad")).toBeTruthy()
    })
  })
})
