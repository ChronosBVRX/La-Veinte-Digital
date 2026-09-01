// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import "fake-indexeddb/auto"
import zlib from "node:zlib"
import { jsPDF } from "jspdf"
import {
  buildJsPdfDocument,
  renderStoredEscritoToPdfFile,
  generarNombreArchivoPdf,
  sanitizeFileName,
  processBlobForPdf,
} from "@/shared/lib/escrito-pdf-renderer"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { saveBlobResource } from "@/shared/services/blob-storage"

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[n] = c
}

function calculateCrc32(buf: Uint8Array): number {
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const len = data.length
  const chunk = Buffer.alloc(12 + len)
  chunk.writeUInt32BE(len, 0)
  chunk.write(type, 4, 4, "ascii")
  data.copy(chunk, 8)
  const crc = calculateCrc32(chunk.subarray(4, 8 + len))
  chunk.writeUInt32BE(crc, 8 + len)
  return chunk
}

function createValidPngBlob(width: number, height: number): Blob {
  const rowLen = 1 + width * 3
  const rawBytes = new Uint8Array(height * rowLen)
  const compressed = zlib.deflateSync(rawBytes)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8
  ihdrData[9] = 2
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0

  const ihdrChunk = createPngChunk("IHDR", ihdrData)
  const idatChunk = createPngChunk("IDAT", compressed)
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0))

  const fullBuffer = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
  return new Blob([fullBuffer], { type: "image/png" })
}

function createValidWebpBlob(width: number, height: number): Blob {
  const vp8Payload = Buffer.alloc(16)
  vp8Payload[0] = 0xd0
  vp8Payload[1] = 0x01
  vp8Payload[2] = 0x00
  vp8Payload[3] = 0x9d
  vp8Payload[4] = 0x01
  vp8Payload[5] = 0x2a
  vp8Payload.writeUInt16LE(width & 0x3fff, 6)
  vp8Payload.writeUInt16LE(height & 0x3fff, 8)

  const vp8Header = Buffer.alloc(8)
  vp8Header.write("VP8 ", 0, 4, "ascii")
  vp8Header.writeUInt32LE(vp8Payload.length, 4)

  const riffHeader = Buffer.alloc(12)
  riffHeader.write("RIFF", 0, 4, "ascii")
  riffHeader.writeUInt32LE(4 + vp8Header.length + vp8Payload.length, 4)
  riffHeader.write("WEBP", 8, 4, "ascii")

  const full = Buffer.concat([riffHeader, vp8Header, vp8Payload])
  return new Blob([full], { type: "image/webp" })
}

describe("Renderizador de PDF Vectorial Carta (escrito-pdf-renderer)", () => {
  it("sanitiza nombres de archivo para descarga segura", () => {
    expect(sanitizeFileName("Solicitud de Vacaciones 2026/08")).toBe("solicitud_de_vacaciones_2026_08")
    expect(sanitizeFileName("Dra. María Elena Ramos (Clínica 80)")).toBe("dra_maria_elena_ramos_clinica_80")
  })

  it("genera un nombre de archivo descriptivo y estandarizado", () => {
    const draft = createEmptyEscritoDraftV2("usr_1", "solicitud", {
      destino: { cargo: "Director", nombre: "Dr. Juan Pérez" },
      fecha: "2026-08-31",
    })
    const name = generarNombreArchivoPdf(draft)
    expect(name).toBe("escrito_solicitud_dr_juan_perez_2026-08-31.pdf")
  })

  it("processBlobForPdf procesa imágenes horizontales (640x160) y preserva relación de aspecto", async () => {
    const horizontalBlob = createValidPngBlob(640, 160)
    const processed = await processBlobForPdf(horizontalBlob)

    expect(processed).not.toBeNull()
    expect(processed?.format).toBe("PNG")
    expect(processed?.width).toBe(640)
    expect(processed?.height).toBe(160)
    const aspectRatio = (processed?.width || 0) / (processed?.height || 1)
    expect(aspectRatio).toBeCloseTo(4.0, 1)
    expect(processed?.dataUrl).toContain("data:image/png;base64,")
  })

  it("processBlobForPdf procesa imágenes verticales (160x640) y preserva relación de aspecto", async () => {
    const verticalBlob = createValidPngBlob(160, 640)
    const processed = await processBlobForPdf(verticalBlob)

    expect(processed).not.toBeNull()
    expect(processed?.format).toBe("PNG")
    expect(processed?.width).toBe(160)
    expect(processed?.height).toBe(640)
    const aspectRatio = (processed?.width || 0) / (processed?.height || 1)
    expect(aspectRatio).toBeCloseTo(0.25, 2)
  })

  it("processBlobForPdf convierte WebP binario válido a PNG real y es compatible con jsPDF", async () => {
    const webpBlob = createValidWebpBlob(320, 240)
    expect(webpBlob.type).toBe("image/webp")

    // Verificar que los bytes de entrada son realmente WebP RIFF
    const buffer = await webpBlob.arrayBuffer()
    const uint8 = new Uint8Array(buffer)
    expect(uint8[0]).toBe(0x52) // R
    expect(uint8[1]).toBe(0x49) // I
    expect(uint8[2]).toBe(0x46) // F
    expect(uint8[3]).toBe(0x46) // F
    expect(uint8[8]).toBe(0x57) // W
    expect(uint8[9]).toBe(0x45) // E
    expect(uint8[10]).toBe(0x42) // B
    expect(uint8[11]).toBe(0x50) // P

    // Configurar canvas mock para jsdom que devuelva PNG válido
    const validPngBlob = createValidPngBlob(320, 240)
    const pngBuffer = await validPngBlob.arrayBuffer()
    const pngBase64 = Buffer.from(pngBuffer).toString("base64")
    const mockDataUrl = `data:image/png;base64,${pngBase64}`

    const origCreateElement = document.createElement.bind(document)
    const origCreateImageBitmap = globalThis.createImageBitmap
    globalThis.createImageBitmap = (async () => ({
      width: 320,
      height: 240,
      close: () => {},
    })) as unknown as typeof globalThis.createImageBitmap

    document.createElement = (tagName: string, options?: ElementCreationOptions) => {
      const el = origCreateElement(tagName, options)
      if (tagName.toLowerCase() === "canvas") {
        const canvas = el as HTMLCanvasElement
        canvas.toDataURL = () => mockDataUrl
        canvas.getContext = (() => ({
          drawImage: () => {},
        })) as unknown as typeof canvas.getContext
      }
      return el
    }

    try {
      const processed = await processBlobForPdf(webpBlob)

      expect(processed).not.toBeNull()
      expect(processed?.format).toBe("PNG")
      expect(processed?.width).toBe(320)
      expect(processed?.height).toBe(240)
      if (processed) {
        expect(processed.width / processed.height).toBeCloseTo(1.33, 2)
      }

      // Verificar que el dataUrl es un PNG binario auténtico (firma 89 50 4E 47 0D 0A 1A 0A)
      const base64Data = processed?.dataUrl.replace(/^data:image\/png;base64,/, "") || ""
      const outputBytes = Buffer.from(base64Data, "base64")
      expect(outputBytes[0]).toBe(0x89)
      expect(outputBytes[1]).toBe(0x50) // P
      expect(outputBytes[2]).toBe(0x4e) // N
      expect(outputBytes[3]).toBe(0x47) // G
      expect(outputBytes[4]).toBe(0x0d)
      expect(outputBytes[5]).toBe(0x0a)
      expect(outputBytes[6]).toBe(0x1a)
      expect(outputBytes[7]).toBe(0x0a)

      // Verificar que jsPDF puede incorporar la imagen sin excepción
      const jsDoc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
      expect(() => {
        jsDoc.addImage(processed!.dataUrl, processed!.format, 40, 40, 200, 150)
      }).not.toThrow()
    } finally {
      document.createElement = origCreateElement
      globalThis.createImageBitmap = origCreateImageBitmap
    }
  })

  it("renderStoredEscritoToPdfFile genera documento con anexos horizontales y verticales en páginas dedicadas", async () => {
    const userId = "usr_pdf_real_dims"
    const sigBlob = createValidPngBlob(300, 100)
    const horizontalBlob = createValidPngBlob(640, 160)
    const verticalBlob = createValidPngBlob(160, 640)

    const sigRef = await saveBlobResource(userId, "doc_real", "firma", "sig", sigBlob)
    const widePhotoRef = await saveBlobResource(userId, "doc_real", "anexo", "wide", horizontalBlob)
    const tallPhotoRef = await saveBlobResource(userId, "doc_real", "anexo", "tall", verticalBlob)

    const draft = createEmptyEscritoDraftV2(userId, "aclaracion", {
      id: "doc_real",
      asunto: "Aclaración con evidencias fotográficas reales",
      destino: { cargo: "Jefe de Personal", nombre: "Lic. Carlos Morales" },
      ciudad: "Morelia, Mich.",
      fecha: "2026-08-31",
      cuerpo:
        "Párrafo 1: Se exponen los hechos comprobados con bitácora.\n\n" +
        "Párrafo 2: Adjunto captura panorámica horizontal del reloj y oficio vertical de confirmación.",
      firmaRef: sigRef,
      anexos: [
        {
          id: "anx_wide",
          nombre: "Captura panorámica checador (640x160)",
          descripcion: "Foto horizontal del reloj checador",
          tipo: "image/png",
          size: horizontalBlob.size,
          storageRef: widePhotoRef,
        },
        {
          id: "anx_tall",
          nombre: "Oficio vertical (160x640)",
          descripcion: "Foto vertical del comprobante",
          tipo: "image/png",
          size: verticalBlob.size,
          storageRef: tallPhotoRef,
        },
      ],
    })

    const jsDoc = await buildJsPdfDocument(draft, userId, {
      nombreTrabajador: "Mario Hernández Silva",
    })

    // 1 página principal + 2 páginas de anexos
    expect(jsDoc.getNumberOfPages()).toBe(3)

    const pdfFile = await renderStoredEscritoToPdfFile(draft, userId, {
      nombreTrabajador: "Mario Hernández Silva",
    })

    expect(pdfFile).toBeInstanceOf(File)
    expect(pdfFile.type).toBe("application/pdf")
    expect(pdfFile.size).toBeGreaterThan(1000)
  })
})
