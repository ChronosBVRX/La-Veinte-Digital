// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getEscritosGuardados,
  guardarEscrito,
  eliminarEscrito,
  duplicarEscrito,
  getStorageKey,
  migrarEscritosLegadosSiEsNecesario,
} from "../services/escritos-storage"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { buildBlobKey, getBlobResource } from "../services/escritos-indexeddb"

describe("Aislamiento de Almacenamiento y Migración Multiusuario", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("Usuario A migra escritos legados; usuario B en el mismo navegador no los recibe", () => {
    // 1. Existen escritos legados previos a la autenticación
    const legacyDocs = [
      {
        id: "leg_001",
        titulo: "Solicitud de pase de salida",
        tipo: "solicitud",
        fecha: "2026-06-01",
        cuerpo: "Hechos y peticion previa...",
        destino: "Jefe de Servicio",
      },
    ]
    localStorage.setItem("escritos_guardados", JSON.stringify(legacyDocs))

    // 2. Usuario A inicia sesión
    migrarEscritosLegadosSiEsNecesario("usr_alice")
    const docsAlice = getEscritosGuardados("usr_alice")

    expect(docsAlice).toHaveLength(1)
    expect(docsAlice[0].id).toBe("leg_001")
    expect(docsAlice[0].ownerId).toBe("usr_alice")

    // La clave global fue eliminada y marcada como migrada
    expect(localStorage.getItem("escritos_guardados")).toBeNull()
    expect(localStorage.getItem("escritos_guardados_migrated_to")).toBe("usr_alice")

    // 3. Usuario B inicia sesión en el mismo dispositivo
    migrarEscritosLegadosSiEsNecesario("usr_bob")
    const docsBob = getEscritosGuardados("usr_bob")

    // Usuario B NO recibe los escritos de Alice
    expect(docsBob).toHaveLength(0)
  })

  it("Ningún dataUrl ni blob: de firma o fotografía queda guardado en localStorage", () => {
    const draft = createEmptyEscritoDraftV2("usr_charlie", "solicitud", {
      titulo: "Oficio con firma y fotos",
      cuerpo: "Cuerpo del oficio...",
      firmaRef: "user_usr_charlie:esc_123:firma:sig_1",
      firmaPreviewUrl: "blob:http://localhost:3000/123-abc-firma",
      anexos: [
        {
          id: "anx_1",
          nombre: "Credencial",
          descripcion: "Foto credencial",
          tipo: "image/jpeg",
          size: 1024,
          storageRef: "user_usr_charlie:esc_123:anexo:anx_1",
          previewUrl: "blob:http://localhost:3000/456-def-foto",
        },
      ],
    })

    guardarEscrito(draft, "usr_charlie")

    const rawStorage = localStorage.getItem(getStorageKey("usr_charlie"))
    expect(rawStorage).toBeDefined()
    expect(rawStorage).not.toBeNull()

    // No debe contener URLs de sesión en memoria
    expect(rawStorage).not.toContain("blob:")
    expect(rawStorage).not.toContain("data:image/")

    // Pero sí debe conservar las referencias de almacenamiento para IndexedDB
    expect(rawStorage).toContain("user_usr_charlie:esc_123:firma:sig_1")
    expect(rawStorage).toContain("user_usr_charlie:esc_123:anexo:anx_1")
  })

  it("Editar un escrito conserva id, ownerId, createdAt y título de forma inmutable", () => {
    const original = createEmptyEscritoDraftV2("usr_david", "queja", {
      titulo: "Queja por sobrecarga laboral",
      cuerpo: "Párrafo inicial.",
      createdAt: "2026-07-01T10:00:00.000Z",
    })

    guardarEscrito(original, "usr_david")

    // Modificamos el cuerpo
    const modificado = {
      ...original,
      cuerpo: "Párrafo inicial modificado con nuevos hechos.",
    }

    guardarEscrito(modificado, "usr_david")

    const lista = getEscritosGuardados("usr_david")
    expect(lista).toHaveLength(1)
    expect(lista[0].id).toBe(original.id)
    expect(lista[0].ownerId).toBe("usr_david")
    expect(lista[0].createdAt).toBe("2026-07-01T10:00:00.000Z")
    expect(lista[0].titulo).toBe("Queja por sobrecarga laboral")
    expect(lista[0].cuerpo).toBe("Párrafo inicial modificado con nuevos hechos.")
  })

  it("duplicarEscrito crea una copia aislada con nuevo id y estado draft", () => {
    const original = createEmptyEscritoDraftV2("usr_eva", "solicitud", {
      titulo: "Pase de salida médico",
      cuerpo: "Solicito pase para cita médica.",
    })
    guardarEscrito(original, "usr_eva")

    const copia = duplicarEscrito(original.id, "usr_eva")
    expect(copia).not.toBeNull()
    expect(copia?.id).not.toBe(original.id)
    expect(copia?.titulo).toBe("Copia de Pase de salida médico")
    expect(copia?.status).toBe("draft")

    const lista = getEscritosGuardados("usr_eva")
    expect(lista).toHaveLength(2)
  })

  it("IndexedDB construye claves estructuradas por usuario y rechaza acceso cruzado", async () => {
    const keyAlice = buildBlobKey("usr_alice", "esc_100", "firma", "sig_1")
    expect(keyAlice).toBe("user_usr_alice:esc_esc_100:firma:sig_1")

    // Usuario Bob intenta leer la referencia de Alice
    const resultBob = await getBlobResource("usr_bob", keyAlice)
    expect(resultBob).toBeNull()
  })

  it("eliminarEscrito remueve el escrito del usuario y no afecta a otros usuarios", () => {
    const doc1 = createEmptyEscritoDraftV2("usr_felix", "libre", { titulo: "Oficio 1" })
    const doc2 = createEmptyEscritoDraftV2("usr_felix", "libre", { titulo: "Oficio 2" })
    guardarEscrito(doc1, "usr_felix")
    guardarEscrito(doc2, "usr_felix")

    expect(getEscritosGuardados("usr_felix")).toHaveLength(2)

    eliminarEscrito(doc1.id, "usr_felix")

    const listaRestante = getEscritosGuardados("usr_felix")
    expect(listaRestante).toHaveLength(1)
    expect(listaRestante[0].id).toBe(doc2.id)
  })
})
