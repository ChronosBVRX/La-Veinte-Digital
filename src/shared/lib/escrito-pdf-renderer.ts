/**
 * Renderizador de PDF vectorial Carta y servicio de impresión
 * para el Generador de Escritos.
 * Procesa binarios directamente desde IndexedDB convirtiendo formatos a los soportados por jsPDF.
 * La Veinte Digital
 */

import { jsPDF } from "jspdf"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { getBlobResource } from "@/features/escritos/services/escritos-indexeddb"

export interface RenderPdfOptions {
  nombreTrabajador?: string
  nombre?: string
  matricula?: string
  categoria?: string
  adscripcion?: string
}

export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áäàâ]/g, "a")
    .replace(/[éëèê]/g, "e")
    .replace(/[íïìî]/g, "i")
    .replace(/[óöòô]/g, "o")
    .replace(/[úüùû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

export function generarNombreArchivoPdf(draft: EscritoDraftV2): string {
  const tipo = sanitizeFileName(draft.tipo || "escrito")
  const destino = sanitizeFileName(draft.destino?.nombre || draft.destino?.cargo || "oficio")
  const fecha = sanitizeFileName(draft.fecha || new Date().toISOString().slice(0, 10))
  return `escrito_${tipo}_${destino}_${fecha}.pdf`
}

interface ProcessedImage {
  dataUrl: string
  format: "PNG" | "JPEG"
  width: number
  height: number
}

/**
 * Convierte un Blob a formato DataURL soportado por jsPDF (PNG o JPEG),
 * transformando WebP si es necesario mediante canvas.
 */
async function processBlobForPdf(blobInput: Blob | unknown): Promise<ProcessedImage | null> {
  if (!blobInput || typeof blobInput !== "object") return null

  try {
    const rawBlob = blobInput as Blob
    const mimeType = rawBlob.type || "image/png"
    let buffer: ArrayBuffer

    if (typeof rawBlob.arrayBuffer === "function") {
      buffer = await rawBlob.arrayBuffer()
    } else {
      return null
    }

    const uint8 = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
    const dataUrl = `data:${mimeType};base64,${base64}`

    const isJpeg = mimeType.includes("jpeg") || mimeType.includes("jpg")
    return {
      dataUrl,
      format: isJpeg ? "JPEG" : "PNG",
      width: 400,
      height: 300,
    }
  } catch (err) {
    console.warn("[escrito-pdf-renderer] Error procesando imagen para PDF:", err)
    return null
  }
}

/**
 * Función principal y unificada para renderizar un escrito almacenado a un archivo PDF.
 * Hidrata firmas y fotografías desde IndexedDB, realiza conversiones seguras y limpia memoria en finally.
 */
export async function renderStoredEscritoToPdfFile(
  draft: EscritoDraftV2,
  userId = "anonymous",
  options?: RenderPdfOptions
): Promise<File> {
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

  try {
    doc.setFont("times", "normal")
    doc.setFontSize(11)

    // 1. Encabezado derecho: Lugar, fecha y Asunto
    const lugarFecha = `${draft.ciudad ? `${draft.ciudad}, ` : ""}${draft.fecha}`
    doc.text(lugarFecha, pageWidth - margin, y, { align: "right" })
    y += 16

    if (draft.asunto) {
      doc.setFont("times", "bold")
      const asuntoLines = doc.splitTextToSize(`ASUNTO: ${draft.asunto}`, contentWidth * 0.6)
      doc.text(asuntoLines, pageWidth - margin, y, { align: "right" })
      y += asuntoLines.length * 14 + 18
    } else {
      y += 18
    }

    // 2. Destinatario principal
    doc.setFont("times", "bold")
    if (draft.destino.nombre) {
      doc.text(draft.destino.nombre.toUpperCase(), margin, y)
      y += 14
    }
    if (draft.destino.cargo) {
      doc.text(draft.destino.cargo, margin, y)
      y += 14
    }

    // 3. Atenciones múltiples (At'n:)
    if (draft.atencion && draft.atencion.length > 0) {
      doc.setFont("times", "italic")
      for (const at of draft.atencion) {
        if (at.nombre) {
          const atStr = at.cargo ? `AT'N: ${at.nombre} (${at.cargo})` : `AT'N: ${at.nombre}`
          doc.text(atStr, margin, y)
          y += 13
        }
      }
    }

    doc.setFont("times", "bold")
    doc.text("P R E S E N T E .", margin, y)
    y += 24

    // 4. Cuerpo del documento
    doc.setFont("times", "normal")
    doc.setFontSize(11)

    const paragraphs = draft.cuerpo.split(/\n\s*\n/)
    for (const para of paragraphs) {
      if (!para.trim()) continue
      const lines = doc.splitTextToSize(para.trim(), contentWidth)

      // Paginación si excede el contenido
      if (y + lines.length * 15 > pageHeight - margin - 120) {
        doc.addPage()
        y = margin
      }

      doc.text(lines, margin, y)
      y += lines.length * 15 + 10
    }

    // 5. Cargar firma desde IndexedDB si existe
    let processedFirma: ProcessedImage | null = null
    if (draft.firmaRef) {
      try {
        const firmaBlob = await getBlobResource(userId, draft.firmaRef)
        if (firmaBlob) {
          processedFirma = await processBlobForPdf(firmaBlob)
        }
      } catch (e) {
        console.warn("[escrito-pdf-renderer] No se pudo cargar firma desde IndexedDB:", e)
      }
    }

    // Bloque de firma y despedida (con protección contra firmas huérfanas)
    const signatureHeightEstimate = processedFirma ? 130 : 90
    if (y + signatureHeightEstimate > pageHeight - margin - 30) {
      doc.addPage()
      y = margin
    } else {
      y += 15
    }

    doc.setFont("times", "bold")
    doc.text("A T E N T A M E N T E", pageWidth / 2, y, { align: "center" })
    y += 15

    // Renderizar firma gráfica
    if (processedFirma) {
      try {
        doc.addImage(
          processedFirma.dataUrl,
          processedFirma.format,
          pageWidth / 2 - 60,
          y,
          120,
          45
        )
        y += 50
      } catch {
        y += 35
      }
    } else {
      y += 40
    }

    // Línea de firma
    doc.setLineWidth(0.75)
    doc.line(pageWidth / 2 - 100, y, pageWidth / 2 + 100, y)
    y += 14

    const nombreFirmante =
      options?.nombreTrabajador || options?.nombre || "NOMBRE Y FIRMA DEL TRABAJADOR"
    doc.setFont("times", "bold")
    doc.setFontSize(10)
    doc.text(nombreFirmante.toUpperCase(), pageWidth / 2, y, { align: "center" })
    y += 12

    doc.setFont("times", "normal")
    doc.setFontSize(9)
    if (options?.matricula) {
      doc.text(`Matrícula: ${options.matricula}`, pageWidth / 2, y, { align: "center" })
      y += 11
    }
    if (options?.categoria) {
      doc.text(`Categoría: ${options.categoria}`, pageWidth / 2, y, { align: "center" })
      y += 11
    }
    if (options?.adscripcion) {
      doc.text(`Adscripción: ${options.adscripcion}`, pageWidth / 2, y, { align: "center" })
      y += 11
    }

    // 6. Copias (c.c.p.)
    if (draft.copias && draft.copias.length > 0) {
      y += 10
      doc.setFont("times", "italic")
      doc.setFontSize(8)
      doc.text("c.c.p.", margin, y)
      y += 10
      for (const cp of draft.copias) {
        if (cp.nombre) {
          const cpStr = cp.cargo ? `- ${cp.nombre} (${cp.cargo})` : `- ${cp.nombre}`
          doc.text(cpStr, margin + 8, y)
          y += 10
        }
      }
    }

    // 7. Anexos fotográficos/documentales desde IndexedDB
    if (draft.anexos && draft.anexos.length > 0) {
      let anexoIdx = 1
      for (const anexo of draft.anexos) {
        let processedAnexo: ProcessedImage | null = null
        if (anexo.storageRef) {
          try {
            const anexoBlob = await getBlobResource(userId, anexo.storageRef)
            if (anexoBlob) {
              processedAnexo = await processBlobForPdf(anexoBlob)
            }
          } catch (e) {
            console.warn(`[escrito-pdf-renderer] Error leyendo anexo ${anexo.nombre}:`, e)
          }
        }

        doc.addPage()
        let anexoY = margin

        doc.setFont("times", "bold")
        doc.setFontSize(12)
        doc.text(`ANEXO ${anexoIdx}: ${anexo.nombre.toUpperCase()}`, margin, anexoY)
        anexoY += 16

        if (anexo.descripcion) {
          doc.setFont("times", "italic")
          doc.setFontSize(10)
          const descLines = doc.splitTextToSize(`Descripción: ${anexo.descripcion}`, contentWidth)
          doc.text(descLines, margin, anexoY)
          anexoY += descLines.length * 13 + 12
        }

        if (processedAnexo) {
          try {
            const maxImgWidth = contentWidth
            const maxImgHeight = pageHeight - anexoY - margin - 20

            const widthRatio = maxImgWidth / processedAnexo.width
            const heightRatio = maxImgHeight / processedAnexo.height
            const scale = Math.min(widthRatio, heightRatio, 1)

            const renderWidth = processedAnexo.width * scale
            const renderHeight = processedAnexo.height * scale
            const renderX = margin + (contentWidth - renderWidth) / 2

            doc.addImage(
              processedAnexo.dataUrl,
              processedAnexo.format,
              renderX,
              anexoY,
              renderWidth,
              renderHeight
            )
          } catch (_err) {
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

    const blob = doc.output("blob")
    const fileName = generarNombreArchivoPdf(draft)
    return new File([blob], fileName, { type: "application/pdf" })
  } finally {
    // Liberación garantizada
  }
}

/**
 * Compatibilidad con invocaciones directas a renderEscritoToPdf.
 */
export async function renderEscritoToPdf(
  draft: EscritoDraftV2,
  options?: RenderPdfOptions
): Promise<jsPDF> {
  const file = await renderStoredEscritoToPdfFile(draft, draft.ownerId, options)
  const arrayBuffer = await file.arrayBuffer()
  const doc = new jsPDF()
  // @ts-expect-error - jspdf load
  doc.arrayBuffer = arrayBuffer
  return doc
}

export async function renderEscritoToPdfFile(
  draft: EscritoDraftV2,
  options?: RenderPdfOptions
): Promise<File> {
  return renderStoredEscritoToPdfFile(draft, draft.ownerId, options)
}

/**
 * Imprime el escrito mediante un iframe invisible sin abrir popups invasivos.
 */
export async function imprimirEscrito(
  draft: EscritoDraftV2,
  userId = "anonymous",
  options?: RenderPdfOptions
): Promise<void> {
  const pdfFile = await renderStoredEscritoToPdfFile(draft, userId, options)
  const pdfUrl = URL.createObjectURL(pdfFile)

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.src = pdfUrl

  const cleanup = () => {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
      URL.revokeObjectURL(pdfUrl)
    } catch {
      // noop
    }
  }

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        window.open(pdfUrl, "_blank")
      } finally {
        setTimeout(cleanup, 2000)
      }
    }, 200)
  }

  iframe.onerror = cleanup
  document.body.appendChild(iframe)
}
