import { describe, it, expect } from "vitest"
import {
  parseCurrencyInput,
  calculateAguinaldo,
  FACTOR_AGUINALDO,
  calculateSegundaJulio,
  calculateSegundaJulioProporcional,
  validateUnidades,
  calculateClausula97,
  calculateTiempoExtra,
  calculateTiempoExtraLegacy,
  validateHorasExtra,
  validateHorasSemana,
  validateHorasExtraQuincena,
  redondearMinutosClausula33,
  JORNADAS,
  MAX_HORAS_SEMANALES,
  MAX_HORAS_QUINCENALES,
  calcularPrestamos,
  normalizeSearch,
  searchCategorias,
} from "../lib"
import type { TiempoExtraInput, PrestamoCategoriaRecord } from "../lib/types"

describe("parseCurrencyInput", () => {
  it("parses valid inputs", () => {
    expect(parseCurrencyInput("$1,000.50")).toBe(1000.5)
    expect(parseCurrencyInput("1000")).toBe(1000)
    expect(parseCurrencyInput("")).toBeNull()
    expect(parseCurrencyInput("abc")).toBeNull()
    expect(parseCurrencyInput("-100")).toBeNull()
    expect(parseCurrencyInput("Infinity")).toBeNull()
  })
})

describe("Aguinaldo (Cláusula 107 CCT)", () => {
  const r = calculateAguinaldo({ concepto002: 10000, concepto011: 2000 })
  it("calcula base quincenal y mensual correctamente", () => {
    expect(r.base).toBe(12000)
    expect(r.baseMensual).toBe(24000)
  })
  it("calcula total de 3 meses conforme a Cláusula 107", () => {
    expect(r.totalAnual).toBe(72000)
  })
  it("calcula anticipo de enero (047, medio mes)", () => {
    expect(r.anticipoEnero047).toBe(12000)
  })
  it("calcula vale de agosto (043, un mes) cuando se solicita", () => {
    const conAgosto = calculateAguinaldo({ concepto002: 10000, concepto011: 2000, solicitoAgosto043: true })
    expect(conAgosto.valeAgosto043).toBe(24000)
    expect(conAgosto.saldoDiciembre049).toBe(36000)
  })
  it("calcula saldo de diciembre (049) deduciendo anticipos", () => {
    expect(r.saldoDiciembre049).toBe(60000)
  })
  it("entrega evidencia contractual verificada", () => {
    expect(r.formulaEvidence.status).toBe("contract_verified")
    expect(r.formulaEvidence.source).toContain("Contrato Colectivo")
  })
  it("incluye comparación histórica con factor empírico anterior", () => {
    expect(r.historicalComparison).toBeDefined()
    expect(r.historicalComparison?.factor).toBe(FACTOR_AGUINALDO)
    expect(r.historicalComparison?.total).toBeCloseTo(89891.48, 2)
  })
})

describe("Segunda de julio (Fondo de Ahorro, Cláusula 144 + Cláusula 63 Bis inc. b)", () => {
  it("Caso de regresión obligatorio: reproduce el tarjetón real con 002 + 011 y deja de devolver 12,075.43", () => {
    const golden = {
      "002": 3937.64,
      "011": 3234.77,
      "055_real": 21934.68,
    }

    // Fórmula anterior errónea (sin 011) devolvía 12,075.43:
    const calculoPrevioSin011 = calculateSegundaJulio({ concepto002: golden["002"] })
    expect(calculoPrevioSin011).toBeCloseTo(12075.43, 2)

    // Con la incorporación obligatoria de 011 conforme a Cl. 63 Bis b:
    const calculoCompleto = calculateSegundaJulio({
      concepto002: golden["002"],
      concepto011: golden["011"],
    })
    expect(calculoCompleto).toBeCloseTo(21995.39, 2)
    expect(calculoCompleto).not.toBeCloseTo(12075.43, 2)

    // Con 359 unidades computables (1 día de incidencia reflejado en 14 días pagados de la quincena):
    const prop359 = calculateSegundaJulioProporcional({
      concepto002: golden["002"],
      concepto011: golden["011"],
      unidades: 359,
    })
    // Reproduce el pago real dentro del margen atribuible al sistema oficial de redondeo (< $0.40)
    expect(prop359.resultado).toBeCloseTo(21934.29, 2)
    expect(Math.abs(prop359.resultado - golden["055_real"])).toBeLessThan(0.40)
  })

  it("Caso A — 360 unidades (año completo con base 002 + 011)", () => {
    const res = calculateSegundaJulio({ concepto002: 3937.64, concepto011: 3234.77 })
    expect(res).toBeCloseTo(21995.39, 2)
  })

  it("Caso B — unidades parciales (180/360 y 359/360)", () => {
    const r180 = calculateSegundaJulioProporcional({
      concepto002: 10000,
      concepto011: 2000,
      unidades: 180,
    })
    expect(r180.base).toBe(12000)
    expect(r180.importeCompleto).toBeCloseTo(36800, 2)
    expect(r180.proporcion).toBe(0.5)
    expect(r180.resultado).toBeCloseTo(18400, 2)
  })

  it("Caso C — ausencia del 011 (o undefined) computa sobre 002", () => {
    expect(calculateSegundaJulio({ concepto002: 10000 })).toBeCloseTo(30666.67, 2)
  })

  it("Caso D — 011 = 0 calcula sin NaN, errores ni desvíos", () => {
    const res = calculateSegundaJulio({ concepto002: 10000, concepto011: 0 })
    expect(res).toBeCloseTo(30666.67, 2)
    expect(Number.isNaN(res)).toBe(false)
  })

  it("Caso E — falta información de unidades asume escenario completo orientativo (360 u)", () => {
    const res = calculateSegundaJulio({ concepto002: 10000, concepto011: 2000 })
    expect(res).toBeCloseTo(36800, 2)
  })

  it("Caso F — valores importados desde perfil producen exactamente lo mismo que manuales", () => {
    const perfilImportado = { c002: 3937.64, c011: 3234.77 }
    const resPerfil = calculateSegundaJulio({
      concepto002: perfilImportado.c002,
      concepto011: perfilImportado.c011,
    })
    const resManual = calculateSegundaJulio({ concepto002: 3937.64, concepto011: 3234.77 })
    expect(resPerfil).toBe(resManual)
  })

  it("calcula correctamente con ceros", () => {
    expect(calculateSegundaJulio({ concepto002: 0, concepto011: 0 })).toBe(0)
  })
})

describe("Segunda de julio proporcional - validaciones", () => {
  it("1 unidad", () => {
    const r = calculateSegundaJulioProporcional({ concepto002: 10000, unidades: 1 })
    expect(r.resultado).toBeGreaterThan(0)
    expect(r.resultado).toBeLessThan(r.importeCompleto)
  })
  it("360 unidades igual al completo", () => {
    const r = calculateSegundaJulioProporcional({ concepto002: 10000, unidades: 360 })
    expect(r.resultado).toBe(r.importeCompleto)
    expect(r.proporcion).toBe(1)
  })
  it("validacion: 0 unidades falla", () => { expect(validateUnidades(0)).not.toBeNull() })
  it("validacion: 361 unidades falla", () => { expect(validateUnidades(361)).not.toBeNull() })
  it("validacion: decimales fallan", () => { expect(validateUnidades(1.5)).not.toBeNull() })
  it("validacion: 1 y 360 unidades pasan", () => {
    expect(validateUnidades(1)).toBeNull()
    expect(validateUnidades(360)).toBeNull()
  })
})

describe("Clausula 97", () => {
  const r = calculateClausula97({ concepto002: 10000, concepto011: 2000 })
  it("base quincenal y mensual", () => {
    expect(r.baseQuincenal).toBe(12000)
    expect(r.baseMensual).toBe(24000)
  })
  it("un mes", () => { expect(r.unMes).toBe(24000) })
  it("dos meses", () => { expect(r.dosMeses).toBe(48000) })
  it("tres meses", () => { expect(r.tresMeses).toBe(72000) })
  it("cuatro meses", () => { expect(r.cuatroMeses).toBe(96000) })
  it("opciones de recuperacion", () => {
    expect(r.opciones[0].quincenasRecuperacion).toBe(10)
    expect(r.opciones[0].descuentoQuincenal).toBe(2400)
    expect(r.opciones[1].quincenasRecuperacion).toBe(20)
    expect(r.opciones[2].quincenasRecuperacion).toBe(30)
    expect(r.opciones[3].quincenasRecuperacion).toBe(40)
  })
})

describe("Tiempo extra", () => {
  const input: TiempoExtraInput = {
    concepto002: 10000,
    concepto011: 2000,
    concepto020: 1000,
    conceptoAdicional1: 500,
    conceptoAdicional2: 300,
    concepto050: 200,
    jornada: 8,
    horasExtra: 5,
  }
  it("suma conceptos", () => { expect(input.concepto002 + input.concepto011 + input.concepto020 + input.conceptoAdicional1 + input.conceptoAdicional2 + input.concepto050).toBe(14000) })
  it("calcula valor hora y pago con redondeo monetario", () => {
    const r = calculateTiempoExtra(input)
    expect(r.sumaConceptos).toBe(14000)
    expect(r.horasOrdinariasPeriodo).toBe(120)
    expect(r.valorHora).toBeCloseTo(116.66666666666667, 4)
    expect(r.horasExtra).toBe(5)
    expect(r.pago).toBe(1166.67)
  })
  it("escala dobles hasta 9h y triples excedente", () => {
    const r10 = calculateTiempoExtra({ ...input, horasExtra: 10 })
    // 9h a 2x = 9 * 116.6667 * 2 = 2100.00; 1h a 3x = 116.6667 * 3 = 350.00 -> 2450.00
    expect(r10.pago).toBe(2450)
  })
  it("paga descansos y festivos al triple (factor 3x)", () => {
    const rDescanso = calculateTiempoExtra({ ...input, horasExtra: 0, horasDescansoSemanal: 8 })
    expect(rDescanso.pago).toBe(2800)
  })
  it("paga coincidencia de descanso semanal + festivo al cuádruple (factor 4x)", () => {
    const rCoincidencia = calculateTiempoExtra({ ...input, horasExtra: 0, horasDescansoObligatorioEnSemanal: 8 })
    expect(rCoincidencia.pago).toBe(3733.33)
  })
  it("aplica redondeo de minutos según Cláusula 33", () => {
    expect(redondearMinutosClausula33(25)).toBe(0.5)
    expect(redondearMinutosClausula33(30)).toBe(1.0)
    expect(redondearMinutosClausula33(45)).toBe(1.0)
    expect(redondearMinutosClausula33(60)).toBe(1.0)
    expect(redondearMinutosClausula33(75)).toBe(1.5)
    expect(redondearMinutosClausula33(95)).toBe(2.0)
  })
  it("jornada 12 modifica valor hora", () => {
    expect(calculateTiempoExtra({ ...input, jornada: 12 }).valorHora)
      .toBeLessThan(calculateTiempoExtra({ ...input, jornada: 8 }).valorHora)
  })
  it("jornada de 6 horas esta soportada", () => {
    expect(JORNADAS).toContain(6)
    expect(calculateTiempoExtra({ ...input, jornada: 6 }).horasOrdinariasPeriodo).toBe(90)
  })
  it("cero horas es invalido", () => {
    expect(validateHorasExtra(0)).not.toBeNull()
    expect(validateHorasExtra(-1)).not.toBeNull()
  })
  it("maximo razonable de horas (legacy)", () => {
    expect(validateHorasExtra(24)).toBeNull()
    expect(validateHorasExtra(25)).not.toBeNull()
  })
  it("límite ordinario semanal de 9 horas", () => {
    expect(MAX_HORAS_SEMANALES).toBe(9)
    expect(validateHorasSemana(8)).toEqual({ valid: true })
    expect(validateHorasSemana(10).valid).toBe(false)
  })
  it("límite ordinario quincenal de 20 horas", () => {
    expect(MAX_HORAS_QUINCENALES).toBe(20)
    expect(validateHorasExtraQuincena(20).valid).toBe(true)
    const sinExcepcion = validateHorasExtraQuincena(21)
    expect(sinExcepcion.valid).toBe(false)
    const conExcepcion = validateHorasExtraQuincena(21, true)
    expect(conExcepcion.valid).toBe(true)
  })
  it("usa baseNormativa (motor de repercusiones 037) cuando se provee", () => {
    const baseNormativa = {
      conceptos: [
        { code: "002", amount: 10000 },
        { code: "011", amount: 2000 },
        { code: "020", amount: 700 },
        { code: "023", amount: 250 },
        { code: "063", amount: 150 },
        { code: "050", amount: 300 },
      ],
      baseAmount: 13400,
    }
    const r = calculateTiempoExtra({ ...input, baseNormativa })
    expect(r.baseNormativaUsada).toBe(true)
    expect(r.sumaConceptos).toBe(13400)
    expect(r.conceptosIntegrados).toHaveLength(6)
    expect(r.pago).toBe(1116.67)
  })
  it("legacy difiere de corregida", () => {
    const legacy = calculateTiempoExtraLegacy(input)
    expect(legacy).not.toBe(calculateTiempoExtra(input).pago)
  })
})

describe("Prestamos", () => {
  const record: PrestamoCategoriaRecord = {
    categoria: "A1",
    descripcionTC: "Test",
    sueldoQuincenal: 5000,
    concepto011: 2000,
    smtabMas011: 14000,
    smi: 16800,
  }
  it("calcularPrestamos usa SMTAB+011 mensual como base", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find((x) => x.modalidad.startsWith(name))!
    expect(byName("Cláusula 97 - 1 mes").valor).toBe(14000)
    expect(byName("Cláusula 97 - 2 meses").valor).toBe(28000)
    expect(byName("Cláusula 97 - 3 meses").valor).toBe(42000)
    expect(byName("Concepto 160").valor).toBe(1400)
  })
  it("calcularPrestamos genera todas las modalidades institucionales", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find((x) => x.modalidad.includes(name))!.valor
    expect(byName("Automóvil")).toBe(16800 * 24)
    expect(byName("Hipotecario (Base 75")).toBe(16800 * 75)
    expect(byName("Enganche")).toBe(16800 * 15)
    expect(byName("Mediano Plazo")).toBe(16800 * 35)
    expect(byName("Máximo condicional 90")).toBe(16800 * 90)
  })
  it("calcularPrestamos deriva base mensual si falta SMTAB+011", () => {
    const withoutSmtab: PrestamoCategoriaRecord = {
      categoria: "X",
      sueldoQuincenal: 5000,
      concepto011: 2000,
    }
    const r = calcularPrestamos(withoutSmtab)
    expect(r.find((x) => x.modalidad.startsWith("Cláusula 97 - 1 mes"))!.valor).toBe(14000)
  })
  it("relaciones SMI", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find((x) => x.modalidad.includes(name))!.valor
    expect(byName("Automóvil")).toBe(16800 * 24)
    expect(byName("Enganche")).toBe(16800 * 15)
    expect(byName("Mediano Plazo")).toBe(16800 * 35)
    expect(byName("Hipotecario (Base 75")).toBe(16800 * 75)
  })
  it("normalizeSearch elimina acentos", () => {
    expect(normalizeSearch("Canónigo")).toBe("canonigo")
  })
  it("searchCategorias prioriza exacta", () => {
    const recs: PrestamoCategoriaRecord[] = [
      { categoria: "MEDICO GENERAL 80" },
      { categoria: "MEDICO FAMILIAR 80" },
    ]
    const res = searchCategorias(recs, "MEDICO GENERAL 80")
    expect(res[0].categoria).toBe("MEDICO GENERAL 80")
  })
})
