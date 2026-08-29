import type { EscritoGuardado } from "@/features/escritos/services/escritos-storage"

/**
 * Genera un PDF (letter, en pt) a partir de un escrito guardado, para poder
 * enviarlo a imprimir a través del mismo flujo de transferencia que los demás
 * documentos. Solo produce texto plano + firma (sin HTML), para no depender de
 * html2canvas a la hora de "Enviar a imprimir".
 */
export async function escritoToPdfFile(
  escrito: EscritoGuardado,
): Promise<File> {
  const { jsPDF: JsPDF } = await import("jspdf")
  const doc = new JsPDF({ unit: "pt", format: "letter" })

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const marginX = 64
  const maxWidth = W - marginX * 2
  const lineHeightBase = 16
  let y = marginX + 10

  doc.setFont("times", "normal")
  doc.setFontSize(12)

  const ensureSpace = (needed: number) => {
    if (y + needed > H - marginX) {
      doc.addPage()
      y = marginX + 10
    }
  }

  const writePara = (text: string, size = 12, opts: { bold?: boolean; align?: "left" | "center" | "right"; gapAfter?: number } = {}) => {
    doc.setFontSize(size)
    doc.setFont("times", opts.bold ? "bold" : "normal")
    const lines = doc.splitTextToSize(text, maxWidth)
    for (const line of lines as string[]) {
      ensureSpace(lineHeightBase)
      doc.text(line, opts.align === "center" ? W / 2 : marginX, y, { align: opts.align ?? "left" })
      y += lineHeightBase
    }
    if (opts.gapAfter) y += opts.gapAfter
  }

  const [cargo, nombreDestino] = (escrito.destino || "|").split("|")
  const fechaLarga = escrito.fecha
    ? new Date(escrito.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    : ""

  // Cabecera
  if (escrito.ciudad || fechaLarga) {
    writePara(`${escrito.ciudad}${escrito.ciudad && fechaLarga ? ", " : ""}${fechaLarga ? "a " + fechaLarga : ""}`.trim(), 12, { align: "right", gapAfter: 30 })
  }
  if (nombreDestino) {
    writePara(nombreDestino, 12, { bold: true })
  }
  if (cargo) {
    writePara(cargo, 12, { bold: true })
  }
  writePara("Presente.", 12, { gapAfter: 16 })

  if (escrito.atencion) {
    const atn = escrito.atencion.split("|")
    writePara(`At’n: ${atn[1] ?? ""}`, 12, { bold: true })
    if (atn[0]) writePara(atn[0], 11)
    y += 8
  }

  writePara(escrito.cuerpo, 12, { gapAfter: 20 })

  // Firma
  if (escrito.firmaUrl) {
    doc.setFontSize(12)
    try {
      // La firma se guardó como dataURL PNG.
      const fmt = escrito.firmaUrl.includes("image/png") ? "PNG" : "JPEG"
      doc.addImage(escrito.firmaUrl, fmt, W / 2 - 60, y, 120, 60)
      y += 72
    } catch {
      doc.setFontSize(10)
      doc.text("Firma", W / 2, y, { align: "center" })
      y += 20
    }
  }

  y += 24
  writePara("A T E N T A M E N T E", 12, { align: "center", gapAfter: 8 })
  ensureSpace(60)
  doc.setDrawColor(0)
  doc.setLineWidth(1)
  doc.line(W / 2 - 125, y, W / 2 + 125, y)
  y += 16
  writePara(escrito.nombre, 12, { align: "center" })
  if (escrito.matricula) writePara(`Matrícula: ${escrito.matricula}`, 12, { align: "center" })
  if (escrito.categoria) writePara(escrito.categoria, 12, { align: "center" })
  if (escrito.adscripcion) writePara(escrito.adscripcion, 12, { align: "center" })

  if (escrito.copia) {
    y += 24
    const ccp = escrito.copia.split("|")
    writePara(`c.c.p. ${ccp[1] ?? ""} - ${ccp[0] ?? ""}. Para su conocimiento e intervención.`, 9, { gapAfter: 8 })
  }

  const nombre = `${escrito.titulo || "escrito"}.pdf`
  const bytes: ArrayBuffer = (doc as unknown as { output: (k: string) => ArrayBuffer }).output("arraybuffer")
  return new File([bytes], nombre, { type: "application/pdf" })
}
