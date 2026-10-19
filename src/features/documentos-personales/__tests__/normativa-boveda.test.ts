// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import {
  getSavedNormativaDocs,
  saveNormativaToVault,
  removeSavedNormativaDoc,
  isNormativaInVault,
} from "../services/normativa-boveda"

describe("normativa-boveda service", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("retorna lista vacía si no hay documentos guardados", () => {
    const docs = getSavedNormativaDocs("test-user")
    expect(docs).toEqual([])
  })

  it("permite guardar un documento normativo en la bóveda", () => {
    const doc = saveNormativaToVault(
      {
        id: "CCT-IMSS-SNTSS-2025-2027",
        title: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
        key: "CCT 2025-2027",
        category: "cct",
      },
      "test-user"
    )

    expect(doc.id).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(doc.title).toBe("Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027")
    expect(doc.savedAt).toBeTypeOf("number")

    const docs = getSavedNormativaDocs("test-user")
    expect(docs).toHaveLength(1)
    expect(docs[0].id).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(isNormativaInVault("CCT-IMSS-SNTSS-2025-2027", "test-user")).toBe(true)
  })

  it("evita duplicados al guardar el mismo documento", () => {
    saveNormativaToVault(
      {
        id: "CCT-IMSS-SNTSS-2025-2027",
        title: "CCT",
      },
      "test-user"
    )
    saveNormativaToVault(
      {
        id: "cct-imss-sntss-2025-2027",
        title: "CCT Actualizado",
      },
      "test-user"
    )

    const docs = getSavedNormativaDocs("test-user")
    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe("CCT Actualizado")
  })

  it("permite eliminar un documento guardado", () => {
    saveNormativaToVault(
      {
        id: "SNTSS-ESTATUTOS-2022",
        title: "Estatutos Sindicales SNTSS",
      },
      "test-user"
    )
    expect(isNormativaInVault("SNTSS-ESTATUTOS-2022", "test-user")).toBe(true)

    const removed = removeSavedNormativaDoc("SNTSS-ESTATUTOS-2022", "test-user")
    expect(removed).toBe(true)
    expect(isNormativaInVault("SNTSS-ESTATUTOS-2022", "test-user")).toBe(false)
    expect(getSavedNormativaDocs("test-user")).toEqual([])
  })

  it("aisla documentos por userId", () => {
    saveNormativaToVault(
      {
        id: "NOM-035-STPS-2018",
        title: "NOM-035",
      },
      "user-1"
    )

    expect(isNormativaInVault("NOM-035-STPS-2018", "user-1")).toBe(true)
    expect(isNormativaInVault("NOM-035-STPS-2018", "user-2")).toBe(false)
  })
})
