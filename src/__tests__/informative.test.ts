import { describe, it, expect, vi } from "vitest"
import {
  CajaReadOnly,
  isEmptyCurrents,
  semaforo,
  buildSnapshot,
  proyectarAhorro,
  conciliarConTarjeton,
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
})
