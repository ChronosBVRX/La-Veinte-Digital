// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import "fake-indexeddb/auto"
import {
  getEscritosGuardados,
  guardarEscrito,
  eliminarEscrito,
  duplicarEscrito,
  getStorageKey,
  migrarEscritosLegadosSiEsNecesario,
} from "../services/escritos-storage"
import {
  createEmptyEscritoDraftV2,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"
import {
  getBlobResource,
  saveBlobResource,
  deleteBlobResource,
} from "../services/escritos-indexeddb"
import { renderStoredEscritoToPdfFile } from "@/shared/lib/escrito-pdf-renderer"

describe("Aislamiento de Almacenamiento, Migración Transaccional y Ciclo de Vida de Blobs", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("migración transaccional: migra fotos y firmaUrl legados a Blobs en IndexedDB sin pérdida de datos", async () => {
    // 1. Datos legados previos a la migración
    const legacyDoc: LegacyEscritoV1 = {
      id: "leg_001",
      titulo: "Solicitud de pase de salida",
      tipo: "solicitud",
      fecha: "2026-06-01",
      cuerpo: "Hechos y petición del escrito legado.",
      destino: "Jefe de Servicio",
      firmaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      fotos: [
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      ],
    }

    localStorage.setItem("escritos_guardados", JSON.stringify([legacyDoc]))

    // 2. Ejecutar migración para Usuario A
    const migRes = await migrarEscritosLegadosSiEsNecesario("usr_alice")
    expect(migRes.success).toBe(true)
    expect(migRes.migratedCount).toBe(1)

    // La clave global fue eliminada de forma segura
    expect(localStorage.getItem("escritos_guardados")).toBeNull()
    expect(localStorage.getItem("escritos_guardados_migrated_to")).toBe("usr_alice")

    // Verificar en localStorage del usuario (sin base64)
    const docsAlice = getEscritosGuardados("usr_alice")
    expect(docsAlice).toHaveLength(1)
    expect(docsAlice[0].id).toBe("leg_001")
    expect(docsAlice[0].firmaRef).toBeDefined()
    expect(docsAlice[0].anexos).toHaveLength(1)

    const rawAlice = localStorage.getItem(getStorageKey("usr_alice"))
    expect(rawAlice).not.toContain("data:image/")

    // Verificar en IndexedDB
    const firmaBlob = await getBlobResource("usr_alice", docsAlice[0].firmaRef!)
    expect(firmaBlob).not.toBeNull()
    expect(firmaBlob).toBeTruthy()

    const photoBlob = await getBlobResource("usr_alice", docsAlice[0].anexos[0].storageRef)
    expect(photoBlob).not.toBeNull()
    expect(photoBlob).toBeTruthy()
  })

  it("usuario B en el mismo dispositivo no recibe los escritos de usuario A", async () => {
    localStorage.setItem(
      "escritos_guardados",
      JSON.stringify([{ id: "leg_002", titulo: "Oficio Privado A" }])
    )

    await migrarEscritosLegadosSiEsNecesario("usr_alice")

    // Usuario B inicia sesión en el mismo navegador
    await migrarEscritosLegadosSiEsNecesario("usr_bob")
    const docsBob = getEscritosGuardados("usr_bob")

    expect(docsBob).toHaveLength(0)
  })

  it("duplicar crea copias físicas independientes de blobs (eliminar original no rompe el duplicado)", async () => {
    // 1. Crear documento original con firma y anexo en IndexedDB
    const dummyBlob = new Blob(["pixel_data"], { type: "image/png" })
    const sigRef = await saveBlobResource("usr_carol", "esc_orig", "firma", "sig_1", dummyBlob)
    const photoRef = await saveBlobResource("usr_carol", "esc_orig", "anexo", "photo_1", dummyBlob)

    const original = createEmptyEscritoDraftV2("usr_carol", "solicitud", {
      id: "esc_orig",
      titulo: "Oficio Original",
      cuerpo: "Texto original",
      firmaRef: sigRef,
      anexos: [
        {
          id: "anx_1",
          nombre: "Credencial",
          descripcion: "Foto credencial",
          tipo: "image/png",
          size: 10,
          storageRef: photoRef,
        },
      ],
    })

    guardarEscrito(original, "usr_carol")

    // 2. Duplicar escrito
    const duplicado = await duplicarEscrito("esc_orig", "usr_carol")
    expect(duplicado).not.toBeNull()
    expect(duplicado?.id).not.toBe("esc_orig")
    expect(duplicado?.firmaRef).not.toBe(sigRef)
    expect(duplicado?.anexos[0].storageRef).not.toBe(photoRef)

    // 3. Eliminar original
    await eliminarEscrito("esc_orig", "usr_carol")

    // El original ya no tiene blobs
    const sigOrig = await getBlobResource("usr_carol", sigRef)
    expect(sigOrig).toBeNull()

    // 4. El duplicado todavía tiene sus propios blobs en IndexedDB y puede generar PDF
    const sigDup = await getBlobResource("usr_carol", duplicado!.firmaRef!)
    expect(sigDup).not.toBeNull()

    const photoDup = await getBlobResource("usr_carol", duplicado!.anexos[0].storageRef)
    expect(photoDup).not.toBeNull()

    const pdfFile = await renderStoredEscritoToPdfFile(duplicado!, "usr_carol")
    expect(pdfFile).toBeInstanceOf(File)
    expect(pdfFile.size).toBeGreaterThan(500)
  })

  it("cambiar firma elimina la anterior solo después de guardar la nueva", async () => {
    const blob1 = new Blob(["firma_vieja"], { type: "image/png" })
    const ref1 = await saveBlobResource("usr_dan", "esc_1", "firma", "sig_v1", blob1)

    // Guardar nueva firma
    const blob2 = new Blob(["firma_nueva"], { type: "image/png" })
    const ref2 = await saveBlobResource("usr_dan", "esc_1", "firma", "sig_v2", blob2)

    // Eliminar la anterior
    await deleteBlobResource("usr_dan", ref1)

    expect(await getBlobResource("usr_dan", ref1)).toBeNull()
    expect(await getBlobResource("usr_dan", ref2)).not.toBeNull()
  })

  it("quitar anexo elimina su Blob de IndexedDB", async () => {
    const blob = new Blob(["foto_adjunta"], { type: "image/jpeg" })
    const photoRef = await saveBlobResource("usr_elena", "esc_2", "anexo", "p_1", blob)

    expect(await getBlobResource("usr_elena", photoRef)).not.toBeNull()

    await deleteBlobResource("usr_elena", photoRef)
    expect(await getBlobResource("usr_elena", photoRef)).toBeNull()
  })
})
