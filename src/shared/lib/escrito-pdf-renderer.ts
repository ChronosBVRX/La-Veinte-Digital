import type { EscritoDraftV2, WorkerProfileContext } from "@/shared/contracts/escrito-draft"

export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/&/g, "_y_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

export function generarNombreArchivoPdf(escrito: EscritoDraftV2): string {
  const tipoRaw = escrito.tipo || "Escrito"
  const tipoCap = tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1)
  const tipo = sanitizeFileName(tipoCap)
  const titulo = sanitizeFileName(escrito.titulo || "Documento")
  const fecha = escrito.fecha ? sanitizeFileName(escrito.fecha) : new Date().toISOString().slice(0, 10)
  const timestamp = Date.now().toString().slice(-6)

  return `${tipo}_${titulo}_${fecha}_${timestamp}.pdf`
}

function formatearFechaLarga(fechaStr: string): string {
  if (!fechaStr) return ""
  try {
    const d = new Date(fechaStr + "T12:00:00")
    if (isNaN(d.getTime())) return fechaStr
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return fechaStr
  }
}

export async function renderEscritoToPdf(
  escrito: EscritoDraftV2,
  profile?: WorkerProfileContext
): Promise<import("jspdf").jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf")
  const doc = new JsPDF({ unit: "pt", format: "letter" })

  const W = doc.internal.pageSize.getWidth() // 612
  const H = doc.internal.pageSize.getHeight() // 792
  const marginX = 54
  const marginY = 54
  const maxWidth = W - marginX * 2 // 504
  const lineHeightBase = 15
  let y = marginY + 10

  const ensureSpace = (needed: number) => {
    if (y + needed > H - marginY) {
      doc.addPage()
      y = marginY + 10
    }
  }

  const writePara = (
    text: string,
    size = 11,
    opts: { bold?: boolean; align?: "left" | "center" | "right"; gapAfter?: number } = {}
  ) => {
    doc.setFontSize(size)
    doc.setFont("times", opts.bold ? "bold" : "normal")
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    for (const line of lines) {
      ensureSpace(lineHeightBase)
      const posX = opts.align === "center" ? W / 2 : opts.align === "right" ? W - marginX : marginX
      doc.text(line, posX, y, { align: opts.align ?? "left" })
      y += lineHeightBase
    }
    if (opts.gapAfter) y += opts.gapAfter
  }

  // 1. Encabezado (Lugar y fecha)
  const fechaLarga = formatearFechaLarga(escrito.fecha)
  const cabeceraLugarFecha = `${escrito.ciudad ? escrito.ciudad + ", a " : ""}${fechaLarga}`.trim()
  if (cabeceraLugarFecha) {
    writePara(cabeceraLugarFecha, 11, { align: "right", gapAfter: 20 })
  }

  // 2. Destinatario
  if (escrito.destino.nombre) {
    writePara(escrito.destino.nombre.toUpperCase(), 11, { bold: true })
  }
  if (escrito.destino.cargo) {
    writePara(escrito.destino.cargo, 11, { bold: true })
  }
  writePara("Presente.", 11, { gapAfter: 12 })

  // 3. Asunto (si existe)
  if (escrito.asunto) {
    writePara(`ASUNTO: ${escrito.asunto.toUpperCase()}`, 11, { bold: true, gapAfter: 10 })
  }

  // 4. Atención (si existe)
  if (escrito.atencion && escrito.atencion.length > 0) {
    for (const atn of escrito.atencion) {
      if (atn.nombre || atn.cargo) {
        writePara(`At’n: ${atn.nombre || ""}${atn.cargo ? ` (${atn.cargo})` : ""}`, 10, { bold: true })
      }
    }
    y += 8
  }

  // 5. Cuerpo
  const parrafos = escrito.cuerpo.split(/\n\n+/)
  for (const parrafo of parrafos) {
    const limpio = parrafo.trim()
    if (limpio) {
      writePara(limpio, 11, { gapAfter: 10 })
    }
  }

  // 6. Cierre y firma (Protegido contra cortes huérfanos)
  const neededFirma = (escrito.firmaUrl ? 75 : 30) + 90
  ensureSpace(neededFirma)

  y += 15
  writePara("A T E N T A M E N T E", 11, { align: "center", bold: true, gapAfter: 8 })

  if (escrito.firmaUrl) {
    try {
      const fmt = escrito.firmaUrl.includes("image/png") ? "PNG" : "JPEG"
      doc.addImage(escrito.firmaUrl, fmt, W / 2 - 60, y, 120, 55)
      y += 60
    } catch {
      y += 20
    }
  } else {
    y += 25
  }

  doc.setDrawColor(0)
  doc.setLineWidth(1)
  doc.line(W / 2 - 120, y, W / 2 + 120, y)
  y += 14

  const nombreFirmante = profile?.nombre || "TRABAJADOR(A)"
  writePara(nombreFirmante, 11, { align: "center", bold: true })

  if (profile?.matricula) {
    writePara(`Matrícula: ${profile.matricula}`, 10, { align: "center" })
  }
  if (profile?.categoria) {
    writePara(profile.categoria, 10, { align: "center" })
  }
  if (profile?.adscripcion) {
    writePara(profile.adscripcion, 10, { align: "center" })
  }

  // 7. Copias (c.c.p.)
  if (escrito.copias && escrito.copias.length > 0) {
    y += 20
    for (const c of escrito.copias) {
      if (c.nombre || c.cargo) {
        writePara(`c.c.p. ${c.nombre || ""} - ${c.cargo || ""}. Para su conocimiento e intervención.`, 8.5, {
          gapAfter: 4,
        })
      }
    }
  }

  // 8. Anexos
  if (escrito.anexos && escrito.anexos.length > 0) {
    doc.addPage()
    y = marginY + 10

    writePara("ANEXOS Y EVIDENCIA DOCUMENTAL", 13, { align: "center", bold: true, gapAfter: 20 })

    for (let i = 0; i < escrito.anexos.length; i++) {
      const anexo = escrito.anexos[i]
      ensureSpace(120)

      writePara(`Anexo ${i + 1}: ${anexo.nombre}`, 11, { bold: true, gapAfter: 4 })
      if (anexo.descripcion) {
        writePara(anexo.descripcion, 10, { gapAfter: 8 })
      }

      if (anexo.dataUrl && anexo.dataUrl.startsWith("data:image")) {
        try {
          const fmt = anexo.dataUrl.includes("image/png") ? "PNG" : "JPEG"
          const imgWidth = Math.min(maxWidth, 420)
          const imgHeight = 220

          ensureSpace(imgHeight + 20)
          doc.addImage(anexo.dataUrl, fmt, W / 2 - imgWidth / 2, y, imgWidth, imgHeight)
          y += imgHeight + 25
        } catch {
          writePara("[Imagen adjunta]", 9, { gapAfter: 15 })
        }
      } else {
        y += 10
      }
    }
  }

  return doc
}

export async function renderEscritoToPdfFile(
  escrito: EscritoDraftV2,
  profile?: WorkerProfileContext
): Promise<File> {
  const doc = await renderEscritoToPdf(escrito, profile)
  const filename = generarNombreArchivoPdf(escrito)
  const bytes = (doc as unknown as { output: (k: string) => ArrayBuffer }).output("arraybuffer")
  return new File([bytes], filename, { type: "application/pdf" })
}

export async function imprimirEscrito(
  escrito: EscritoDraftV2,
  profile?: WorkerProfileContext
): Promise<void> {
  const doc = await renderEscritoToPdf(escrito, profile)
  const blob = doc.output("blob")
  const blobUrl = URL.createObjectURL(blob)

  try {
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    iframe.src = blobUrl

    document.body.appendChild(iframe)
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(blobUrl)
        }, 60000)
      }, 500)
    }
  } catch {
    window.open(blobUrl, "_blank")
  }
}
