/**
 * Renderizador de PDF vectorial Carta y servicio de impresión
 * para el Generador de Escritos.
 * La Veinte Digital
 */

import { jsPDF } from "jspdf"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

export interface RenderPdfOptions {
  nombreTrabajador?: string
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

/**
 * Carga una imagen para obtener sus dimensiones naturales en px.
 */
function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ width: 400, height: 300 })
      return
    }
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 })
    img.onerror = () => resolve({ width: 400, height: 300 })
    img.src = src
  })
}

/**
 * Renderiza un documento EscritoDraftV2 a un documento vectorial jsPDF en tamaño Carta.
 */
export async function renderEscritoToPdf(
  draft: EscritoDraftV2,
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

  // 5. Bloque de firma y despedida (con protección contra firmas huérfanas)
  const signatureHeightEstimate = draft.firmaPreviewUrl ? 130 : 90
  if (y + signatureHeightEstimate > pageHeight - margin - 30) {
    doc.addPage()
    y = margin
  } else {
    y += 15
  }

  doc.setFont("times", "bold")
  doc.text("A T E N T A M E N T E", pageWidth / 2, y, { align: "center" })
  y += 15

  // Si hay firma gráfica
  if (draft.firmaPreviewUrl) {
    try {
      doc.addImage(draft.firmaPreviewUrl, "PNG", pageWidth / 2 - 60, y, 120, 45)
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

  const nombreFirmante = options?.nombreTrabajador || "NOMBRE Y FIRMA DEL TRABAJADOR"
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

  // 7. Anexos fotográficos/documentales (cada uno en su página preservando relación de aspecto)
  if (draft.anexos && draft.anexos.length > 0) {
    let anexoIdx = 1
    for (const anexo of draft.anexos) {
      if (!anexo.previewUrl) continue

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

      try {
        const dims = await getImageDimensions(anexo.previewUrl)
        const maxImgWidth = contentWidth
        const maxImgHeight = pageHeight - anexoY - margin - 20

        const widthRatio = maxImgWidth / dims.width
        const heightRatio = maxImgHeight / dims.height
        const scale = Math.min(widthRatio, heightRatio, 1)

        const renderWidth = dims.width * scale
        const renderHeight = dims.height * scale
        const renderX = margin + (contentWidth - renderWidth) / 2

        doc.addImage(anexo.previewUrl, "JPEG", renderX, anexoY, renderWidth, renderHeight)
      } catch (_err) {
        doc.setFont("times", "italic")
        doc.text("[Imagen no disponible para renderizado]", margin, anexoY)
      }

      anexoIdx++
    }
  }

  return doc
}

/**
 * Renderiza el escrito a un objeto File para descarga o visor web.
 */
export async function renderEscritoToPdfFile(
  draft: EscritoDraftV2,
  options?: RenderPdfOptions
): Promise<File> {
  const doc = await renderEscritoToPdf(draft, options)
  const blob = doc.output("blob")
  const fileName = generarNombreArchivoPdf(draft)
  return new File([blob], fileName, { type: "application/pdf" })
}

/**
 * Imprime el escrito mediante un iframe invisible sin abrir popups invasivos.
 */
export async function imprimirEscrito(
  draft: EscritoDraftV2,
  options?: RenderPdfOptions
): Promise<void> {
  const doc = await renderEscritoToPdf(draft, options)
  const pdfBlob = doc.output("blob")
  const pdfUrl = URL.createObjectURL(pdfBlob)

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
