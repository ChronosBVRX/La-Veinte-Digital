import { describe, it, expect, vi } from "vitest"
import {
  CajaReadOnly,
  isEmptyCurrents,
  semaforo,
  buildSnapshot,
  proyectarAhorro,
  conciliarConTarjeton,
  adeudoActual,
  liquidoARecibir,
  esElegibleRenovacion,
  coberturaColateralEstimada,
  elegibilidadRenovacionEstimada,
  desgloseDescuentoEstimado,
  formatQuincena,
  sumarQuincenas,
  getQuincenaFromDate,
  esQuincenaRetencionExtraordinaria,
  diagnosticoRenovacion,
  proyectarRenovacionParaQuincena,
} from "../informative"

describe("src/informative.ts - Utilidades informativas", () => {
  describe("isEmptyCurrents", () => {
    it("detecta 404 y código 1401 como estado vacío", () => {
      expect(isEmptyCurrents({ httpStatus: 404 })).toBe(true)
      expect(isEmptyCurrents({ code: "1401" })).toBe(true)
      expect(isEmptyCurrents({ code: "404" })).toBe(true)
      expect(isEmptyCurrents({ message: "No se encontraron registros para el periodo" })).toBe(true)
    })

    it("retorna false ante errores reales del servidor", () => {
      expect(isEmptyCurrents({ httpStatus: 500, message: "Internal server error" })).toBe(false)
      expect(isEmptyCurrents({ httpStatus: 403, code: "1040", message: "Sesión activa" })).toBe(false)
      expect(isEmptyCurrents(null)).toBe(false)
      expect(isEmptyCurrents(undefined)).toBe(false)
    })
  })

  describe("semaforo", () => {
    it("clasifica como verde si préstamo / ahorro < 0.3", () => {
      const res = semaforo(2000, 10000) // 20%
      expect(res.nivel).toBe("verde")
      expect(res.porcentaje).toBe(20)
      expect(res.label).toBe("Saludable")
    })

    it("clasifica como amarillo si 0.3 <= préstamo / ahorro < 0.6", () => {
      const res = semaforo(4500, 10000) // 45%
      expect(res.nivel).toBe("amarillo")
      expect(res.porcentaje).toBe(45)
      expect(res.label).toBe("Moderado")
    })

    it("clasifica como rojo si préstamo / ahorro >= 0.6", () => {
      const res = semaforo(7500, 10000) // 75%
      expect(res.nivel).toBe("rojo")
      expect(res.porcentaje).toBe(75)
      expect(res.label).toBe("Atención")
    })

    it("maneja caso de saldo de ahorro en cero con préstamo", () => {
      const res = semaforo(5000, 0)
      expect(res.nivel).toBe("rojo")
      expect(res.porcentaje).toBe(100)
    })

    it("maneja caso de préstamo cero y ahorro cero", () => {
      const res = semaforo(0, 0)
      expect(res.nivel).toBe("verde")
      expect(res.porcentaje).toBe(0)
    })
  })

  describe("buildSnapshot", () => {
    it("construye un snapshot coherente con balance y préstamo", () => {
      const balance = {
        quincena: "2026/19",
        fechaConsultaSaldo: "2026-10-13",
        saldoTotal: 25000,
        saldoAhorro: 20000,
        saldoPrestamo: 5000,
        prestamoOtorgado: 10000,
      }
      const loan = {
        abono_ahorro: 750,
        abono_prestamo: 1200,
        saldo_por_pagar: 5000,
      }

      const snap = buildSnapshot(balance, loan)
      expect(snap.quincena).toBe("2026/19")
      expect(snap.fechaConsulta).toBe("2026-10-13")
      expect(snap.saldoTotal).toBe(25000)
      expect(snap.saldoAhorro).toBe(20000)
      expect(snap.saldoPrestamo).toBe(5000)
      expect(snap.abonoAhorro).toBe(750)
      expect(snap.abonoPrestamo).toBe(1200)
      expect(snap.saldoPorPagar).toBe(5000)
      expect(snap.timestamp).toBeGreaterThan(0)
    })
  })

  describe("proyectarAhorro", () => {
    it("calcula la proyección con aportaciones y rendimiento", () => {
      const proj = proyectarAhorro({
        saldoActual: 10000,
        abonoQuincenal: 500,
        quincenas: 6,
        tasaAnualEstimada: 8.0,
      })

      expect(proj.saldoActual).toBe(10000)
      expect(proj.totalAportado).toBe(3000) // 6 * 500
      expect(proj.saldoEstimadoFinal).toBeGreaterThan(13000)
      expect(proj.rendimientoEstimado).toBeGreaterThan(0)
    })
  })

  describe("conciliarConTarjeton", () => {
    const snap = buildSnapshot({ saldoAhorro: 15000 }, { abono_ahorro: 800 })

    it("detecta coincidencia si el concepto en tarjetón es igual", () => {
      const resultado = conciliarConTarjeton(snap, [
        { clave: "011", concepto: "FONDO DE AHORRO", importe: 800 },
      ])
      expect(resultado.coincide).toBe(true)
      expect(resultado.diferencia).toBe(0)
      expect(resultado.abonoCaja).toBe(800)
    })

    it("detecta discrepancia si el importe difiere", () => {
      const resultado = conciliarConTarjeton(snap, [
        { clave: "011", concepto: "FONDO DE AHORRO", importe: 650 },
      ])
      expect(resultado.coincide).toBe(false)
      expect(resultado.diferencia).toBe(150)
      expect(resultado.detalle).toContain("Discrepancia detectada")
    })

    it("alerta si no existe concepto en el tarjetón", () => {
      const resultado = conciliarConTarjeton(snap, [
        { clave: "001", concepto: "SUELDO", importe: 5000 },
      ])
      expect(resultado.coincide).toBe(false)
      expect(resultado.detalle).toContain("No se localizó concepto")
    })
  })

  describe("CajaReadOnly", () => {
    it("getBalance envía Bearer token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", payload: { saldoTotal: 12000 } }),
      })

      const client = new CajaReadOnly({
        fetchImpl: mockFetch,
        getToken: () => "mock-jwt-token",
      })

      const res = await client.getBalance("987654")
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain("accounts/987654/balance")
      expect(opts.headers.authorization).toBe("Bearer mock-jwt-token")
      expect(res.payload?.saldoTotal).toBe(12000)
    })

    it("getCurrentInvoices retorna null en 404 o 1401", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: "1401", message: "Sin registros" }),
      })

      const client = new CajaReadOnly({
        fetchImpl: mockFetch,
        getToken: () => "mock-jwt-token",
      })

      const res = await client.getCurrentInvoices("987654")
      expect(res).toBeNull()
    })

    it("logoutServer envía GET logout/{mat} con Bearer", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      })

      const client = new CajaReadOnly({
        fetchImpl: mockFetch,
        getToken: () => "mock-jwt-token",
      })

      await client.logoutServer("987654")
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain("logout/987654")
      expect(opts.method).toBe("GET")
      expect(opts.headers.authorization).toBe("Bearer mock-jwt-token")
    })
  })

  describe("Fórmulas réplica verificadas", () => {
    it("adeudoActual replica exactamente la fórmula con saldo mínimo de 600", () => {
      // 185,034.33 − (52,108.23 − 600) = 133,526.10 exacto
      const adeudo = adeudoActual(185034.33, 52108.23)
      expect(adeudo).toBe(133526.1)
    })

    it("liquidoARecibir replica exactamente la fórmula de importe_maximo - adeudo", () => {
      // 186,000 − 133,526.10 = 52,473.90 exacto
      const liquido = liquidoARecibir(186000, 133526.1)
      expect(liquido).toBe(52473.9)
    })

    it("coberturaColateralEstimada calcula floor((saldoAhorro - 600) / prestamo * 100)", () => {
      // floor((52108.23 - 600) / 186000 * 100) = 27 exacto
      expect(coberturaColateralEstimada(52108.23, 186000)).toBe(27)
      expect(coberturaColateralEstimada(500, 186000)).toBe(0)
      expect(coberturaColateralEstimada(52108.23, 0)).toBe(0)
    })

    it("elegibilidadRenovacionEstimada evalúa umbral hipótesis >= 20% con verificado false", () => {
      const e27 = elegibilidadRenovacionEstimada(27)
      expect(e27.elegible).toBe(true)
      expect(e27.verificado).toBe(false)
      expect(e27.motivo).toContain("Estimación referencial")

      const e20 = elegibilidadRenovacionEstimada(20)
      expect(e20.elegible).toBe(true)

      const e15 = elegibilidadRenovacionEstimada(15)
      expect(e15.elegible).toBe(false)
      expect(e15.motivo).toContain("aún no alcanzaría el umbral")

      const conMensaje = elegibilidadRenovacionEstimada(15, "Elegible para renovar")
      expect(conMensaje.elegible).toBe(true)
    })

    it("esElegibleRenovacion preserva compatibilidad con interfaz previa", () => {
      const e27 = esElegibleRenovacion(27)
      expect(e27.elegible).toBe(true)
      expect(e27.motivo).toContain("Estimación referencial")

      const e15 = esElegibleRenovacion(15)
      expect(e15.elegible).toBe(false)
    })

    it("desgloseDescuentoEstimado separa capital e intereses solo si capital es provisto", () => {
      const sinCapital = desgloseDescuentoEstimado(1430.19)
      expect(sinCapital.total).toBe(1430.19)
      expect(sinCapital.capital).toBeNull()
      expect(sinCapital.interes).toBeNull()

      const conCapital = desgloseDescuentoEstimado(1430.19, 965.67)
      expect(conCapital.total).toBe(1430.19)
      expect(conCapital.capital).toBe(965.67)
      expect(conCapital.interes).toBe(464.52)
    })

    it("formatQuincena convierte formato AAAA/QQ a texto legible", () => {
      expect(formatQuincena("2026/09")).toBe("1ª de Mayo 2026")
      expect(formatQuincena("2026/10")).toBe("2ª de Mayo 2026")
      expect(formatQuincena("2026/01")).toBe("1ª de Enero 2026")
      expect(formatQuincena("2026/24")).toBe("2ª de Diciembre 2026")
      expect(formatQuincena(null)).toBe("Quincena actual")
    })

    it("sumarQuincenas calcula correctamente el avance en el calendario", () => {
      expect(sumarQuincenas("2026/09", 0)).toBe("2026/09")
      expect(sumarQuincenas("2026/09", 1)).toBe("2026/10")
      expect(sumarQuincenas("2026/09", 2)).toBe("2026/11")
      expect(sumarQuincenas("2026/23", 2)).toBe("2027/01")
    })

    it("diagnosticoRenovacion calcula elegibilidad, quincena y líquido exactos con datos reales", () => {
      const diag = diagnosticoRenovacion({
        saldoPrestamo: 185034.33,
        saldoAhorro: 52108.23,
        prestamoOtorgado: 186000,
        porcentajeActual: 27,
        abonoAhorro: 3720,
        abonoPrestamo: 1430.19,
        importeMaximo: 186000,
        quincenaActual: "2026/09",
      })

      expect(diag.elegibleHoy).toBe(true)
      expect(diag.porcentajeActual).toBe(27)
      expect(diag.quincenaActual).toBe("2026/09")
      expect(diag.quincenaActualTexto).toBe("1ª de Mayo 2026")
      expect(diag.quincenasParaElegibilidad).toBe(0)
      expect(diag.adeudoHoy).toBe(133526.1)
      expect(diag.liquidoHoy).toBe(52473.9)
      expect(diag.proyecciones.length).toBeGreaterThan(0)

      // Primera proyección debe coincidir con hoy
      expect(diag.proyecciones[0].quincenaOffset).toBe(0)
      expect(diag.proyecciones[0].liquidoEstimado).toBe(52473.9)

      // Proyección futura debe mostrar mayor líquido conforme se ahorra
      const p2 = diag.proyecciones.find((p) => p.quincenaOffset === 2)
      expect(p2?.liquidoEstimado).toBeGreaterThan(52473.9)
    })

    it("diagnosticoRenovacion proyecta quincenas faltantes cuando aún no califica", () => {
      const diag = diagnosticoRenovacion({
        saldoPrestamo: 180000,
        saldoAhorro: 20000,
        prestamoOtorgado: 180000,
        porcentajeActual: 10,
        abonoAhorro: 3600, // 2% por quincena
        quincenaActual: "2026/09",
      })

      expect(diag.elegibleHoy).toBe(false)
      // Para ir de 10% a 20% a 2% por quincena faltan 5 quincenas
      expect(diag.quincenasParaElegibilidad).toBe(5)
      expect(diag.quincenaEstimadaElegibilidad).toBe("2026/14")
      expect(diag.quincenaEstimadaTexto).toBe("2ª de Julio 2026")
    })

    it("getQuincenaFromDate determina la quincena correcta en calendario laboral IMSS", () => {
      // 13 de Octubre (<=15) -> Quincena 19 (1ª de Octubre)
      expect(getQuincenaFromDate("13/10/2026")).toBe("2026/19")
      expect(getQuincenaFromDate("2026-10-13")).toBe("2026/19")
      expect(getQuincenaFromDate(new Date(2026, 9, 13))).toBe("2026/19")

      // 16 de Octubre (>15) -> Quincena 20 (2ª de Octubre)
      expect(getQuincenaFromDate("16/10/2026")).toBe("2026/20")
      expect(getQuincenaFromDate("2026-10-16")).toBe("2026/20")
      expect(getQuincenaFromDate(new Date(2026, 9, 16))).toBe("2026/20")

      // 1 de Mayo -> Quincena 09 (1ª de Mayo)
      expect(getQuincenaFromDate("01/05/2026")).toBe("2026/09")

      // 31 de Diciembre -> Quincena 24 (2ª de Diciembre)
      expect(getQuincenaFromDate("31/12/2026")).toBe("2026/24")
    })

    it("diagnosticoRenovacion diferencia entre quincena de solicitud y quincena actual de consulta", () => {
      // Caso real del usuario:
      // Préstamo solicitado en 2026/09 (Mayo 2026)
      // Consulta realizada el 13/10/2026 (Quincena 2026/19 - 1ª de Octubre 2026)
      const diag = diagnosticoRenovacion({
        saldoPrestamo: 185034.33,
        saldoAhorro: 52108.23,
        prestamoOtorgado: 186000,
        porcentajeActual: 27,
        abonoAhorro: 3720,
        abonoPrestamo: 1430.19,
        importeMaximo: 186000,
        quincenaOtorgamiento: "2026/09",
        fechaConsulta: "13/10/2026",
      })

      expect(diag.elegibleHoy).toBe(true)
      // Quincena actual calculada de la fecha de consulta (Octubre 2026), NO de la solicitud (Mayo)
      expect(diag.quincenaActual).toBe("2026/19")
      expect(diag.quincenaActualTexto).toBe("1ª de Octubre 2026")
      expect(diag.quincenaOtorgamiento).toBe("2026/09")
      expect(diag.quincenaOtorgamientoTexto).toBe("1ª de Mayo 2026")

      // La primera proyección debe iniciar en la quincena actual (1ª de Octubre 2026)
      expect(diag.proyecciones[0].quincenaCodigo).toBe("2026/19")
      expect(diag.proyecciones[0].quincenaTexto).toBe("1ª de Octubre 2026")

      // La siguiente quincena (+1) debe ser la 2ª de Octubre 2026
      expect(diag.proyecciones[1].quincenaCodigo).toBe("2026/20")
      expect(diag.proyecciones[1].quincenaTexto).toBe("2ª de Octubre 2026")

      // La siguiente (+2) debe ser la 1ª de Noviembre 2026
      expect(diag.proyecciones[2].quincenaCodigo).toBe("2026/21")
      expect(diag.proyecciones[2].quincenaTexto).toBe("1ª de Noviembre 2026")
    })

    it("esQuincenaRetencionExtraordinaria identifica 2ª de Julio y Aguinaldo", () => {
      expect(esQuincenaRetencionExtraordinaria("2026/14")).toEqual({
        aplica: true,
        tipo: "julio",
        etiqueta: "2ª de Julio",
      })
      expect(esQuincenaRetencionExtraordinaria("2026/23")).toEqual({
        aplica: true,
        tipo: "aguinaldo",
        etiqueta: "Aguinaldo",
      })
      expect(esQuincenaRetencionExtraordinaria("2026/19")).toEqual({ aplica: false })
      expect(esQuincenaRetencionExtraordinaria("2026/10")).toEqual({ aplica: false })
    })

    it("diagnosticoRenovacion suma retenciones extraordinarias semestrales (Julio y Aguinaldo)", () => {
      const diag = diagnosticoRenovacion({
        saldoPrestamo: 185034.33,
        saldoAhorro: 52108.23,
        prestamoOtorgado: 186000,
        porcentajeActual: 27,
        abonoAhorro: 3720,
        abonoPrestamo: 1430.19,
        importeMaximo: 186000,
        retencionExtraordinaria: 11000,
        quincenaActual: "2026/19", // 1ª de Octubre 2026
      })

      // Hoy (2026/19) no es extraordinaria
      expect(diag.proyecciones[0].esExtraordinaria).toBe(false)
      expect(diag.proyecciones[0].liquidoEstimado).toBe(52473.9)

      // Aguinaldo ocurre en la quincena 2026/23 (offset 4)
      const proyAguinaldo = diag.proyecciones.find((p) => p.quincenaCodigo === "2026/23")
      expect(proyAguinaldo).toBeDefined()
      expect(proyAguinaldo?.esExtraordinaria).toBe(true)
      expect(proyAguinaldo?.motivoExtraordinario).toContain("Aguinaldo")
      expect(proyAguinaldo?.motivoExtraordinario).toContain("11,000")
      // El líquido en Aguinaldo debe ser significativamente mayor (incluye los $11,000 extraordinarios)
      expect(proyAguinaldo?.liquidoEstimado).toBeGreaterThan(80000)

      // 2ª de Julio ocurre en 2027/14 (offset 19)
      const proyJulio = diag.proyecciones.find((p) => p.quincenaCodigo === "2027/14")
      expect(proyJulio).toBeDefined()
      expect(proyJulio?.esExtraordinaria).toBe(true)
      expect(proyJulio?.motivoExtraordinario).toContain("2ª de Julio")
      expect(proyJulio?.motivoExtraordinario).toContain("11,000")
    })

    it("proyectarRenovacionParaQuincena estima con precisión para cualquier quincena seleccionada", () => {
      const proy = proyectarRenovacionParaQuincena(
        {
          saldoPrestamo: 185034.33,
          saldoAhorro: 52108.23,
          prestamoOtorgado: 186000,
          porcentajeActual: 27,
          abonoAhorro: 3720,
          abonoPrestamo: 1430.19,
          importeMaximo: 186000,
          retencionExtraordinaria: 11000,
          quincenaActual: "2026/19",
        },
        4, // Quincena 2026/23 (Aguinaldo)
      )

      expect(proy.quincenaOffset).toBe(4)
      expect(proy.quincenaCodigo).toBe("2026/23")
      expect(proy.quincenaTexto).toBe("1ª de Diciembre 2026")
      expect(proy.esExtraordinaria).toBe(true)
      expect(proy.liquidoEstimado).toBeGreaterThan(80000)
    })
  })
})

