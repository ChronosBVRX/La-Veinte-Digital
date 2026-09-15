// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  deleteWebScannedDocument,
  getWebScannedDocumentFile,
  isNativeScanPersistenceAvailable,
  listWebScannedDocuments,
  persistScannedDocument,
} from "../services/scan-persistence"
import { SCAN_DOCUMENT_STORAGE } from "@/shared/services/scan-document-storage"
import { SCAN_SOURCE_DOCUMENT, SCAN_SOURCE_INE } from "@/shared/contracts/document-scan"
import { tinyJpegBytes } from "../__tests__/helpers/jpeg"

const USER = "user-persist-uuid"

function pdfFile(name: string): File {
  const bytes = new TextEncoder().encode("%PDF-1.4 contenido de prueba")
  return new File([bytes], name, { type: "application/pdf" })
}

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(SCAN_DOCUMENT_STORAGE.DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
  delete (window as { LaVeinteApp?: unknown }).LaVeinteApp
  delete (window as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
})

afterEach(() => {
  delete (window as { LaVeinteApp?: unknown }).LaVeinteApp
  delete (window as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
})

describe("scan-persistence: detección de almacenamiento nativo", () => {
  it("en web sin bridge no está disponible", () => {
    expect(isNativeScanPersistenceAvailable()).toBe(false)
  })

  it("una APK antigua con pdfBridge pero sin scanner no habilita el guardado nativo", () => {
    window.LaVeinteApp = {
      __isInjected: true,
      appPlatform: () => "android",
      appVersion: () => "1.0.0",
      sdkVersion: () => 34,
      packageName: () => "com.laveintedigital.app",
      isNativeApp: () => true,
      hasBiometrics: () => false,
      isBiometricsEnabled: () => false,
      openExternal: () => {},
      pickPdf: () => {},
      share: () => {},
      haptic: () => {},
      log: () => {},
      onAuthenticated: () => {},
      onLoggedOut: () => {},
      openOfficialPayslips: () => {},
      hasImssCredentials: () => false,
      checkForUpdate: () => {},
      requestCameraPermission: async () => ({ granted: true }),
      requestNotificationsPermission: () => {},
      listNativeDocuments: async () => [],
      readNativeDocument: async () => null,
      deleteNativeDocument: async () => true,
      getFcmToken: async () => ({ token: "" }),
      getPendingPrintDoc: async () => null,
      clearPendingPrintDoc: () => {},
      openAppSettings: () => {},
    }
    window.laVeintePdfBridge = { postMessage: () => {} }
    expect(isNativeScanPersistenceAvailable()).toBe(false)
  })

  it("la APK con scanner y pdfBridge sí habilita el guardado nativo", () => {
    window.LaVeinteApp = {
      __isInjected: true,
      appPlatform: () => "android",
      appVersion: () => "1.1.7",
      sdkVersion: () => 34,
      packageName: () => "com.laveintedigital.app",
      isNativeApp: () => true,
      hasBiometrics: () => false,
      isBiometricsEnabled: () => false,
      openExternal: () => {},
      pickPdf: () => {},
      share: () => {},
      haptic: () => {},
      log: () => {},
      onAuthenticated: () => {},
      onLoggedOut: () => {},
      openOfficialPayslips: () => {},
      hasImssCredentials: () => false,
      checkForUpdate: () => {},
      requestCameraPermission: async () => ({ granted: true }),
      requestNotificationsPermission: () => {},
      listNativeDocuments: async () => [],
      readNativeDocument: async () => null,
      deleteNativeDocument: async () => true,
      getFcmToken: async () => ({ token: "" }),
      getPendingPrintDoc: async () => null,
      clearPendingPrintDoc: () => {},
      openAppSettings: () => {},
      scanDocument: async () => ({ ok: true, pages: [] }),
    }
    window.laVeintePdfBridge = { postMessage: () => {} }
    expect(isNativeScanPersistenceAvailable()).toBe(true)
  })
})

describe("scan-persistence: guardado y ciclo de vida web", () => {
  it("en web guarda en IndexedDB y se puede abrir y borrar", async () => {
    const result = await persistScannedDocument({
      userId: USER,
      kind: "documento",
      name: "Escaneo de prueba.pdf",
      pdfFile: pdfFile("Escaneo de prueba.pdf"),
      pageCount: 2,
    })
    expect(result.ok).toBe(true)
    expect(result.storage).toBe("indexeddb")

    const list = await listWebScannedDocuments(USER)
    expect(list).toHaveLength(1)
    expect(list[0].pageCount).toBe(2)

    const file = await getWebScannedDocumentFile(USER, result.id)
    expect(file).not.toBeNull()
    expect(file!.type).toBe("application/pdf")
    expect(file!.size).toBeGreaterThan(0)

    expect(await deleteWebScannedDocument(USER, result.id)).toBe(true)
    expect(await listWebScannedDocuments(USER)).toHaveLength(0)
  })

  it("INE se guarda con su clase explícita (no por nombre de archivo)", async () => {
    const result = await persistScannedDocument({
      userId: USER,
      kind: "ine",
      name: "Documento 2026.pdf",
      pdfFile: pdfFile("Documento 2026.pdf"),
      pageCount: 1,
    })
    const list = await listWebScannedDocuments(USER)
    expect(list[0].kind).toBe("ine")
    expect(result.id.startsWith("ine_")).toBe(true)
  })

  it("si el guardado nativo falla, conserva el escaneo en IndexedDB", async () => {
    window.LaVeinteApp = {
      __isInjected: true,
      appPlatform: () => "android",
      appVersion: () => "1.1.7",
      sdkVersion: () => 34,
      packageName: () => "com.laveintedigital.app",
      isNativeApp: () => true,
      hasBiometrics: () => false,
      isBiometricsEnabled: () => false,
      openExternal: () => {},
      pickPdf: () => {},
      share: () => {},
      haptic: () => {},
      log: () => {},
      onAuthenticated: () => {},
      onLoggedOut: () => {},
      openOfficialPayslips: () => {},
      hasImssCredentials: () => false,
      checkForUpdate: () => {},
      requestCameraPermission: async () => ({ granted: true }),
      requestNotificationsPermission: () => {},
      listNativeDocuments: async () => [],
      readNativeDocument: async () => null,
      deleteNativeDocument: async () => true,
      getFcmToken: async () => ({ token: "" }),
      getPendingPrintDoc: async () => null,
      clearPendingPrintDoc: () => {},
      openAppSettings: () => {},
      scanDocument: async () => ({ ok: true, pages: [] }),
    }
    window.laVeintePdfBridge = {
      postMessage: () => {
        throw new Error("bridge caído")
      },
    }

    const result = await persistScannedDocument({
      userId: USER,
      kind: "documento",
      name: "Respaldo.pdf",
      pdfFile: pdfFile("Respaldo.pdf"),
      pageCount: 1,
    })
    expect(result.ok).toBe(true)
    expect(result.storage).toBe("indexeddb")
    expect(result.reason).toBe("UNSUPPORTED")

    const list = await listWebScannedDocuments(USER)
    expect(list).toHaveLength(1)
  })

  it("rechaza userId vacío", async () => {
    const result = await persistScannedDocument({
      userId: "",
      kind: "documento",
      name: "x.pdf",
      pdfFile: pdfFile("x.pdf"),
      pageCount: 1,
    })
    expect(result.ok).toBe(false)
  })

  it("si el almacenamiento falla, retorna ok: false con failure clasificado", async () => {
    const emptyFile = new File([], "vacio.pdf", { type: "application/pdf" })
    const result = await persistScannedDocument({
      userId: USER,
      kind: "documento",
      name: "vacio.pdf",
      pdfFile: emptyFile,
      pageCount: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.failure).toBe("write_failed")
  })
})

describe("scan-persistence: contratos de fuente", () => {
  it("los bytes del helper JPEG siguen siendo válidos", () => {
    expect(tinyJpegBytes().length).toBeGreaterThan(50)
    expect(SCAN_SOURCE_DOCUMENT).toBe("DOCUMENT_SCAN")
    expect(SCAN_SOURCE_INE).toBe("INE_SCAN")
  })
})
