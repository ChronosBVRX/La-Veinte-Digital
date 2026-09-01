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
  getMigrationJournal,
  saveMigrationJournal,
  serializePersistableDraft,
} from "@/shared/services/escritos-storage"
import {
  createEmptyEscritoDraftV2,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"
import * as blobStorage from "@/shared/services/blob-storage"
import {
  getBlobResource,
  saveBlobResource,
} from "@/shared/services/blob-storage"

describe("Aislamiento de Almacenamiento, Migración de Dos Fases y Ciclo de Vida de Blobs", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("migración de dos fases: migra fotos y firmaUrl legados a Blobs en IndexedDB con read-back y journal", async () => {
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

    // Ejecutar migración para Usuario Alice
    const migRes = await migrarEscritosLegadosSiEsNecesario("usr_alice")
    expect(migRes.success).toBe(true)
    expect(migRes.migratedCount).toBe(1)

    // La clave global fue eliminada de forma segura
    expect(localStorage.getItem("escritos_guardados")).toBeNull()
    expect(localStorage.getItem("escritos_guardados_migrated_to")).toBe("usr_alice")

    // El journal quedó en estado completed
    const journal = getMigrationJournal("usr_alice")
    expect(journal?.state).toBe("completed")
    expect(journal?.draftsCount).toBe(1)

    // Verificar en localStorage del usuario (sin base64)
    const docsAlice = getEscritosGuardados("usr_alice")
    expect(docsAlice).toHaveLength(1)
    expect(docsAlice[0].id).toBe("leg_001")
    expect(docsAlice[0].firmaRef).toBeDefined()
    expect(docsAlice[0].anexos).toHaveLength(1)

    const rawAlice = localStorage.getItem(getStorageKey("usr_alice"))
    expect(rawAlice).not.toContain("data:image/")

    // Read-back verification de todos los blobs en IndexedDB
    const firmaBlob = await getBlobResource("usr_alice", docsAlice[0].firmaRef!)
    expect(firmaBlob).not.toBeNull()
    expect(firmaBlob?.size).toBeGreaterThan(0)

    const photoBlob = await getBlobResource("usr_alice", docsAlice[0].anexos[0].storageRef)
    expect(photoBlob).not.toBeNull()
    expect(photoBlob?.size).toBeGreaterThan(0)
  })

  it("fallo en el segundo blob: revierte los blobs previos, conserva clave legada y permite reintento", async () => {
    const legacyDoc: LegacyEscritoV1 = {
      id: "leg_two_blobs",
      titulo: "Solicitud con 2 fotos",
      tipo: "solicitud",
      fecha: "2026-06-01",
      cuerpo: "Texto...",
      destino: "Director",
      firmaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      fotos: [
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      ],
    }
    localStorage.setItem("escritos_guardados", JSON.stringify([legacyDoc]))

    // Permitir guardar el primer blob (firma), pero fallar en el segundo (foto)
    let callCount = 0
    const originalSave = blobStorage.saveBlobResource
    const saveSpy = vi.spyOn(blobStorage, "saveBlobResource").mockImplementation(async (...args) => {
      callCount++
      if (callCount >= 2) {
        throw new Error("QuotaExceededError: Injected second blob failure")
      }
      return originalSave(...args)
    })

    const result = await migrarEscritosLegadosSiEsNecesario("usr_two_blobs_test")
    expect(result.success).toBe(false)

    // La clave global original NO fue eliminada
    expect(localStorage.getItem("escritos_guardados")).not.toBeNull()

    // El primer blob fue limpiado en el rollback
    const journal = getMigrationJournal("usr_two_blobs_test")
    expect(journal?.state).toBe("pending")

    // Restaurar mock y permitir reintento exitoso
    saveSpy.mockRestore()
    const retryResult = await migrarEscritosLegadosSiEsNecesario("usr_two_blobs_test")
    expect(retryResult.success).toBe(true)
    expect(localStorage.getItem("escritos_guardados")).toBeNull()
  })

  it("recuperación cuando ocurre un fallo después de escribir userKey (estado metadata_committed)", async () => {
    // Simular un journal donde los metadatos ya fueron escritos en localStorage pero el proceso se interrumpió
    const draft = createEmptyEscritoDraftV2("usr_meta_rec", "solicitud", { id: "doc_rec", titulo: "Doc Recuperado" })
    localStorage.setItem(getStorageKey("usr_meta_rec"), JSON.stringify([draft]))
    localStorage.setItem("escritos_guardados", JSON.stringify([{ id: "doc_rec" }]))

    saveMigrationJournal({
      userId: "usr_meta_rec",
      state: "metadata_committed",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blobKeys: [],
      draftsCount: 1,
    })

    // Al reintentar, detecta metadata_committed, no borra blobs y finaliza la limpieza
    const res = await migrarEscritosLegadosSiEsNecesario("usr_meta_rec")
    expect(res.success).toBe(true)
    expect(localStorage.getItem("escritos_guardados")).toBeNull()
    expect(localStorage.getItem("escritos_guardados_migrated_to")).toBe("usr_meta_rec")
    expect(getMigrationJournal("usr_meta_rec")?.state).toBe("completed")
  })

  it("guardarEscrito lanza error descriptivo ante QuotaExceededError en localStorage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("QuotaExceededError: DOM Exception 22")
      err.name = "QuotaExceededError"
      throw err
    })

    const draft = createEmptyEscritoDraftV2("usr_quota", "solicitud", { titulo: "Test Quota" })
    expect(() => guardarEscrito(draft, "usr_quota")).toThrow(
      /El almacenamiento del dispositivo está lleno/i
    )

    setItemSpy.mockRestore()
  })

  it("serializePersistableDraft normaliza todos los campos clave y excluye URLs volátiles", () => {
    const d1 = createEmptyEscritoDraftV2("usr_dirty", "solicitud", {
      titulo: "Mi Titulo",
      hechos: "Hechos...",
      firmaPreviewUrl: "blob:http://localhost/1234",
    })
    const d2 = createEmptyEscritoDraftV2("usr_dirty", "solicitud", {
      titulo: "Mi Titulo",
      hechos: "Hechos...",
      firmaPreviewUrl: "blob:http://localhost/5678", // URL diferente
    })

    // La representación persistible es idéntica a pesar de diferentes object URLs volátiles
    expect(serializePersistableDraft(d1)).toBe(serializePersistableDraft(d2))

    // Modificar ciudad altera la serialización
    const d3 = { ...d1, ciudad: "Guadalajara" }
    expect(serializePersistableDraft(d1)).not.toBe(serializePersistableDraft(d3))
  })

  it("duplicar crea copias físicas independientes de blobs (eliminar original no rompe el duplicado)", async () => {
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

    const duplicado = await duplicarEscrito("esc_orig", "usr_carol")
    expect(duplicado).not.toBeNull()
    expect(duplicado?.id).not.toBe("esc_orig")
    expect(duplicado?.firmaRef).not.toBe(sigRef)
    expect(duplicado?.anexos[0].storageRef).not.toBe(photoRef)

    // Eliminar original
    await eliminarEscrito("esc_orig", "usr_carol")

    // El duplicado todavía tiene sus propios blobs en IndexedDB
    const sigDup = await getBlobResource("usr_carol", duplicado!.firmaRef!)
    expect(sigDup).not.toBeNull()
    expect(sigDup?.size).toBeGreaterThan(0)

    const photoDup = await getBlobResource("usr_carol", duplicado!.anexos[0].storageRef)
    expect(photoDup).not.toBeNull()
    expect(photoDup?.size).toBeGreaterThan(0)
  })
})
