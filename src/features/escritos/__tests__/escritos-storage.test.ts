// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getEscritosGuardados,
  guardarEscrito,
  eliminarEscrito,
  duplicarEscrito,
  getEscritoById,
  migrarEscritosLegadosSiEsNecesario,
} from "../services/escritos-storage"
import { createEmptyEscritoDraftV2, type EscritoDraftV2, type LegacyEscritoV1 } from "@/shared/contracts/escrito-draft"

describe("escritos-storage service", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("aísla los escritos por userId", () => {
    const userA = "user-aaa"
    const userB = "user-bbb"

    const escritoA: EscritoDraftV2 = createEmptyEscritoDraftV2(userA, undefined, {
      id: "esc-a1",
      titulo: "Escrito del Usuario A",
      cuerpo: "Cuerpo de A",
    })

    const escritoB: EscritoDraftV2 = createEmptyEscritoDraftV2(userB, undefined, {
      id: "esc-b1",
      titulo: "Escrito del Usuario B",
      cuerpo: "Cuerpo de B",
    })

    guardarEscrito(escritoA, userA)
    guardarEscrito(escritoB, userB)

    const listA = getEscritosGuardados(userA)
    const listB = getEscritosGuardados(userB)

    expect(listA.length).toBe(1)
    expect(listA[0].id).toBe("esc-a1")
    expect(listA[0].titulo).toBe("Escrito del Usuario A")

    expect(listB.length).toBe(1)
    expect(listB[0].id).toBe("esc-b1")
    expect(listB[0].titulo).toBe("Escrito del Usuario B")
  })

  it("migra automáticamente escritos legados de escritos_guardados hacia el usuario activo", () => {
    const legacyList: LegacyEscritoV1[] = [
      {
        id: "leg-101",
        titulo: "Oficio Antiguo 1",
        cuerpo: "Cuerpo legado 1",
        destino: "Secretario General|Dr. Luis",
        ciudad: "Uruapan",
        fecha: "2026-07-01",
        nombre: "Trabajador 1",
        matricula: "998877",
        categoria: "Auxiliar",
        adscripcion: "UMF 80",
        atencion: "",
        copia: "",
        fotos: [],
        firmaUrl: "",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ]

    localStorage.setItem("escritos_guardados", JSON.stringify(legacyList))

    const userX = "user-xxx"
    migrarEscritosLegadosSiEsNecesario(userX)

    const userList = getEscritosGuardados(userX)
    expect(userList.length).toBe(1)
    expect(userList[0].id).toBe("leg-101")
    expect(userList[0].ownerId).toBe(userX)
    expect(userList[0].schemaVersion).toBe(2)
    expect(userList[0].titulo).toBe("Oficio Antiguo 1")

    // La migración es idempotente
    migrarEscritosLegadosSiEsNecesario(userX)
    expect(getEscritosGuardados(userX).length).toBe(1)
  })

  it("al editar un escrito existente preserva id, createdAt, titulo original y actualiza updatedAt", () => {
    const user = "user-123"
    const inicial: EscritoDraftV2 = {
      ...createEmptyEscritoDraftV2(user, undefined, {
        id: "esc-fijo",
        titulo: "Título Fijo Personalizado",
        cuerpo: "Versión 1",
      }),
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
    }

    guardarEscrito(inicial, user)

    const modificado: EscritoDraftV2 = {
      ...inicial,
      cuerpo: "Versión 2 modificada con nuevos párrafos",
      peticion: "Nueva petición",
    }

    const listaActualizada = guardarEscrito(modificado, user)
    expect(listaActualizada.length).toBe(1)

    const recuperado = getEscritoById("esc-fijo", user)
    expect(recuperado).not.toBeNull()
    expect(recuperado?.id).toBe("esc-fijo")
    expect(recuperado?.createdAt).toBe("2026-08-01T08:00:00.000Z")
    expect(recuperado?.titulo).toBe("Título Fijo Personalizado")
    expect(recuperado?.cuerpo).toBe("Versión 2 modificada con nuevos párrafos")
    expect(new Date(recuperado?.updatedAt ?? "").getTime()).toBeGreaterThanOrEqual(
      new Date("2026-08-01T08:00:00.000Z").getTime()
    )
  })

  it("duplica un escrito generando nuevo id, status draft, y título con prefijo Copia", () => {
    const user = "user-123"
    const original: EscritoDraftV2 = createEmptyEscritoDraftV2(user, undefined, {
      id: "esc-orig",
      titulo: "Solicitud original",
      cuerpo: "Contenido base",
    })

    guardarEscrito(original, user)
    const duplicado = duplicarEscrito("esc-orig", user)

    expect(duplicado).not.toBeNull()
    expect(duplicado?.id).not.toBe("esc-orig")
    expect(duplicado?.titulo).toBe("Copia de Solicitud original")
    expect(duplicado?.cuerpo).toBe("Contenido base")
    expect(duplicado?.status).toBe("draft")

    const lista = getEscritosGuardados(user)
    expect(lista.length).toBe(2)
  })

  it("elimina un escrito correctamente y maneja datos corruptos en localStorage sin crashear", () => {
    const user = "user-err"
    localStorage.setItem(`escritos_guardados_${user}`, "invalid json {{{")

    // No debe lanzar error, sino retornar array vacío
    expect(getEscritosGuardados(user)).toEqual([])

    const valido: EscritoDraftV2 = createEmptyEscritoDraftV2(user, undefined, { id: "esc-ok" })
    guardarEscrito(valido, user)
    expect(getEscritosGuardados(user).length).toBe(1)

    eliminarEscrito("esc-ok", user)
    expect(getEscritosGuardados(user).length).toBe(0)
  })

  it("captura QuotaExceededError y devuelve error amigable sin perder estado previo", () => {
    const user = "user-quota"
    const escrito: EscritoDraftV2 = createEmptyEscritoDraftV2(user, undefined, { id: "esc-big" })

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("Quota exceeded")
      err.name = "QuotaExceededError"
      throw err
    })

    expect(() => {
      guardarEscrito(escrito, user)
    }).toThrow(/almacenamiento del dispositivo/i)
  })
})
