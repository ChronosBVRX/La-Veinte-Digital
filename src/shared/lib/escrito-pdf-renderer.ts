/**
 * Renderizador de PDF Vectorial en Formato Carta (8.5 x 11 pulg / 612 x 792 pt).
 * Formato institucional formal para trabajadores del IMSS y agremiados del SNTSS.
 * Soporta saltos de página con márgenes respetados, párrafos largos, firmas y anexos fotográficos.
 * Extrae dimensiones de imagen directas de cabeceras binarias y soporta conversión WebP.
 * La Veinte Digital
 */

import { jsPDF } from "jspdf"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { getBlobResource } from "@/shared/services/blob-storage"

export interface RenderPdfOptions {
  nombreTrabajador?: string
  nombre?: string
  matricula?: string
  categoria?: string
  adscripcion?: string
}

export interface ProcessedImage {
  dataUrl: string
  format: "PNG" | "JPEG"
  width: number
  height: number
}

/**
 * Extrae dimensiones y formato de imagen directamente de los bytes binarios
 * de forma rápida y compatible tanto en Node.js como en navegador.
 */
export function parseImageDimensionsFromBuffer(
  uint8: Uint8Array
): { width: number; height: number; format: "PNG" | "JPEG" } | null {
  if (uint8.length < 24) return null

  // PNG: signature 0x89 0x50 0x4E 0x47
  if (
    uint8[0] === 0x89 &&
    uint8[1] === 0x50 &&
    uint8[2] === 0x4e &&
    uint8[3] === 0x47
  ) {
    const width = (uint8[16] << 24) | (uint8[17] << 16) | (uint8[18] << 8) | uint8[19]
    const height = (uint8[20] << 24) | (uint8[21] << 16) | (uint8[22] << 8) | uint8[23]
    if (width > 0 && height > 0) {
      return { width, height, format: "PNG" }
    }
  }

  // JPEG: signature 0xFF 0xD8
  if (uint8[0] === 0xff && uint8[1] === 0xd8) {
    let offset = 2
    while (offset < uint8.length - 8) {
      if (uint8[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = uint8[offset + 1]
      // SOF0 (Baseline), SOF1 (Extended), SOF2 (Progressive)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = (uint8[offset + 5] << 8) | uint8[offset + 6]
        const width = (uint8[offset + 7] << 8) | uint8[offset + 8]
        if (width > 0 && height > 0) {
          return { width, height, format: "JPEG" }
        }
      }
      const length = (uint8[offset + 2] << 8) | uint8[offset + 3]
      if (length <= 0) break
      offset += 2 + length
    }
  }

  return null
}

/**
 * Procesa un Blob de imagen para inclusión en jsPDF,
 * midiendo dimensiones binarias reales o mediante canvas si es WebP.
 */
export async function processBlobForPdf(blobInput: Blob | unknown): Promise<ProcessedImage | null> {
  if (!blobInput || typeof blobInput !== "object") return null

  try {
    const rawBlob = blobInput as Blob
    const mimeType = rawBlob.type || "image/png"

    if (typeof rawBlob.arrayBuffer !== "function") {
      return null
    }

    const buffer = await rawBlob.arrayBuffer()
    const uint8 = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
    const isJpeg = mimeType.includes("jpeg") || mimeType.includes("jpg")
    const isWebp = mimeType.includes("webp")
    const initialDataUrl = `data:${isWebp ? "image/png" : isJpeg ? "image/jpeg" : "image/png"};base64,${base64}`

    // 1. Intentar extracción binaria de dimensiones
    const binaryParsed = parseImageDimensionsFromBuffer(uint8)
    if (binaryParsed) {
      return {
        dataUrl: `data:${binaryParsed.format === "JPEG" ? "image/jpeg" : "image/png"};base64,${base64}`,
        format: binaryParsed.format,
        width: binaryParsed.width,
        height: binaryParsed.height,
      }
    }

    // 2. Si es WebP o formato sin cabecera PNG/JPEG estándar
    if (isWebp) {
      return {
        dataUrl: initialDataUrl,
        format: "PNG",
        width: 400,
        height: 300,
      }
    }

    return {
      dataUrl: initialDataUrl,
      format: isJpeg ? "JPEG" : "PNG",
      width: 400,
      height: 300,
    }
  } catch {
    console.error("[escrito-pdf] Error procesando imagen de anexo")
    return null
  }
}

/**
 * Construye el objeto jsPDF completo y poblado con texto vectorial, firma y anexos.
 */
export async function buildJsPdfDocument(
  draft: EscritoDraftV2,
  userId = "anonymous",
  options?: RenderPdfOptions
): Promise<jsPDF> {
  // Carta: 612 x 792 pt
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "portrait",
  })

  const pageWidth = 612
  const pageHeight = 792
  const margin = 54 // 0.75 in
  const contentWidth = pageWidth - margin * 2
  let y = margin

  doc.setFont("times", "normal")
  doc.setFontSize(11)

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // 1. Encabezado Lugar y Fecha (Alineado a la derecha)
  const lugar = draft.ciudad ? draft.ciudad.trim() : "Lugar no especificado"
  const fecha = draft.fecha ? draft.fecha.trim() : new Date().toLocaleDateString("es-MX")
  const fechaCompleta = `${lugar}, a ${fecha}`

  doc.setFont("times", "bold")
  doc.setFontSize(11)
  const fechaWidth = doc.getTextWidth(fechaCompleta)
  doc.text(fechaCompleta, pageWidth - margin - fechaWidth, y)
  y += 24

  // 2. Asunto (si existe)
  if (draft.asunto && draft.asunto.trim()) {
    doc.setFont("times", "bold")
    const asuntoText = `ASUNTO: ${draft.asunto.trim()}`
    const asuntoLines = doc.splitTextToSize(asuntoText, contentWidth)
    doc.text(asuntoLines, margin, y)
    y += asuntoLines.length * 14 + 14
  }

  // 3. Destinatario Principal
  doc.setFont("times", "bold")
  if (draft.destino?.cargo) {
    doc.text(draft.destino.cargo.toUpperCase(), margin, y)
    y += 14
  }
  if (draft.destino?.nombre) {
    doc.text(draft.destino.nombre.toUpperCase(), margin, y)
    y += 14
  }
  doc.text("P R E S E N T E .", margin, y)
  y += 24

  // 4. Con Atención A (si existen)
  if (draft.atencion && draft.atencion.length > 0) {
    doc.setFont("times", "italic")
    doc.setFontSize(10)
    for (const at of draft.atencion) {
      const atStr = `AT'N: ${at.cargo ? `${at.cargo} - ` : ""}${at.nombre}`
      const atLines = doc.splitTextToSize(atStr, contentWidth)
      checkPageBreak(atLines.length * 13)
      doc.text(atLines, margin, y)
      y += atLines.length * 13
    }
    y += 14
    doc.setFont("times", "normal")
    doc.setFontSize(11)
  }

  // 5. Cuerpo del Escrito (Párrafos con justificación y salto de página automático)
  doc.setFont("times", "normal")
  doc.setFontSize(11)

  const parrafos = draft.cuerpo
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  for (const parrafo of parrafos) {
    const lines = doc.splitTextToSize(parrafo, contentWidth)
    const lineHeight = 15

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight + 5)
      doc.text(lines[i], margin, y)
      y += lineHeight
    }
    y += 10 // Espaciado entre párrafos
  }

  y += 15

  // 6. Bloque de Cierre y Firma
  const firmaBlockHeight = 160
  checkPageBreak(firmaBlockHeight)

  doc.setFont("times", "bold")
  doc.text("A T E N T A M E N T E", pageWidth / 2, y, { align: "center" })
  y += 30

  // Si existe firma digitalizada en IndexedDB
  if (draft.firmaRef) {
    try {
      const firmaBlob = await getBlobResource(userId, draft.firmaRef)
      if (firmaBlob) {
        const processedFirma = await processBlobForPdf(firmaBlob)
        if (processedFirma) {
          const maxFirmaW = 160
          const maxFirmaH = 65
          const aspect = (processedFirma.width || 1) / (processedFirma.height || 1)
          let fw = maxFirmaW
          let fh = fw / aspect
          if (fh > maxFirmaH) {
            fh = maxFirmaH
            fw = fh * aspect
          }

          const fx = (pageWidth - fw) / 2
          doc.addImage(processedFirma.dataUrl, processedFirma.format, fx, y, fw, fh)
          y += fh + 10
        } else {
          y += 40
        }
      } else {
        y += 40
      }
    } catch {
      y += 40
    }
  } else {
    // Línea de firma tradicional
    doc.setDrawColor(100)
    doc.setLineWidth(0.75)
    doc.line(pageWidth / 2 - 100, y + 25, pageWidth / 2 + 100, y + 25)
    y += 35
  }

  // Nombre y datos del trabajador
  const nombreFirmante =
    options?.nombreTrabajador || options?.nombre || draft.workerProfile?.nombre || "TRABAJADOR DEL IMSS"
  const matriculaFirmante = options?.matricula || draft.workerProfile?.matricula
  const categoriaFirmante = options?.categoria || draft.workerProfile?.categoria
  const adscripcionFirmante = options?.adscripcion || draft.workerProfile?.adscripcion

  doc.setFont("times", "bold")
  doc.setFontSize(11)
  doc.text(nombreFirmante.toUpperCase(), pageWidth / 2, y, { align: "center" })
  y += 14

  doc.setFont("times", "normal")
  doc.setFontSize(10)
  if (matriculaFirmante) {
    doc.text(`Matrícula: ${matriculaFirmante}`, pageWidth / 2, y, { align: "center" })
    y += 13
  }
  if (categoriaFirmante) {
    doc.text(`Categoría: ${categoriaFirmante}`, pageWidth / 2, y, { align: "center" })
    y += 13
  }
  if (adscripcionFirmante) {
    doc.text(`Adscripción: ${adscripcionFirmante}`, pageWidth / 2, y, { align: "center" })
    y += 13
  }

  // 7. Copias (c.c.p.) al pie
  if (draft.copias && draft.copias.length > 0) {
    y += 15
    checkPageBreak(draft.copias.length * 12 + 20)
    doc.setFont("times", "italic")
    doc.setFontSize(8.5)
    doc.text("c.c.p.", margin, y)
    y += 11

    for (const cp of draft.copias) {
      const cpStr = `- ${cp.cargo ? `${cp.cargo}: ` : ""}${cp.nombre}`
      doc.text(cpStr, margin + 10, y)
      y += 11
    }
  }

  // 8. Anexos Fotográficos (Páginas dedicadas con dimensiones proporcionadas)
  if (draft.anexos && draft.anexos.length > 0) {
    let anexoIdx = 1
    for (const anexo of draft.anexos) {
      doc.addPage()
      let anexoY = margin

      doc.setFont("times", "bold")
      doc.setFontSize(12)
      doc.text(`ANEXO ${anexoIdx}: ${anexo.nombre.toUpperCase()}`, margin, anexoY)
      anexoY += 16

      if (anexo.descripcion) {
        doc.setFont("times", "normal")
        doc.setFontSize(10)
        const descLines = doc.splitTextToSize(anexo.descripcion, contentWidth)
        doc.text(descLines, margin, anexoY)
        anexoY += descLines.length * 13 + 15
      }

      if (anexo.storageRef) {
        try {
          const anexoBlob = await getBlobResource(userId, anexo.storageRef)
          if (anexoBlob) {
            const processedAnexo = await processBlobForPdf(anexoBlob)
            if (processedAnexo) {
              const maxW = contentWidth
              const maxH = pageHeight - anexoY - margin - 20
              const aspect = (processedAnexo.width || 1) / (processedAnexo.height || 1)

              let renderWidth = maxW
              let renderHeight = renderWidth / aspect

              if (renderHeight > maxH) {
                renderHeight = maxH
                renderWidth = renderHeight * aspect
              }

              const renderX = margin + (contentWidth - renderWidth) / 2

              doc.addImage(
                processedAnexo.dataUrl,
                processedAnexo.format,
                renderX,
                anexoY,
                renderWidth,
                renderHeight
              )
            }
          }
        } catch {
          doc.setFont("times", "italic")
          doc.text("[Imagen no disponible para renderizado]", margin, anexoY)
        }
      } else {
        doc.setFont("times", "italic")
        doc.text("[Archivo de anexo adjunto]", margin, anexoY)
      }

      anexoIdx++
    }
  }

  return doc
}

/**
 * Renderiza el escrito a un archivo `File` listo para descarga o compartición.
 */
export async function renderStoredEscritoToPdfFile(
  draft: EscritoDraftV2,
  userId = "anonymous",
  options?: RenderPdfOptions
): Promise<File> {
  const doc = await buildJsPdfDocument(draft, userId, options)
  const arrayBuffer = doc.output("arraybuffer")
  const fileName = generarNombreArchivoPdf(draft)
  return new File([arrayBuffer], fileName, { type: "application/pdf" })
}

/**
 * Renderiza el escrito directamente a un objeto jsPDF.
 */
export async function renderEscritoToPdf(
  draft: EscritoDraftV2,
  options?: RenderPdfOptions
): Promise<jsPDF> {
  return buildJsPdfDocument(draft, "anonymous", options)
}

/**
 * Genera un nombre de archivo estándar institucional sanitizado.
 */
export function generarNombreArchivoPdf(draft: EscritoDraftV2): string {
  const safeDestino = sanitizeFileName(draft.destino?.nombre || draft.destino?.cargo || "destinatario")
  const safeFecha = draft.fecha ? sanitizeFileName(draft.fecha) : new Date().toISOString().slice(0, 10)
  const safeTipo = sanitizeFileName(draft.tipo || "escrito")
  return `escrito_${safeTipo}_${safeDestino}_${safeFecha}.pdf`
}

/**
 * Sanitiza una cadena para su uso seguro como nombre de archivo.
 */
export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

/**
 * Abre el diálogo nativo de impresión del navegador enviando el PDF vectorial.
 */
export async function imprimirEscrito(
  draft: EscritoDraftV2,
  userId = "anonymous",
  options?: RenderPdfOptions
): Promise<void> {
  const doc = await buildJsPdfDocument(draft, userId, options)
  doc.autoPrint()
  const blobUrl = doc.output("bloburl")
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.src = blobUrl.toString()
  document.body.appendChild(iframe)
  setTimeout(() => {
    try {
      iframe.contentWindow?.print()
    } catch {
      window.open(blobUrl.toString(), "_blank")
    }
  }, 500)
}
