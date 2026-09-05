import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"
import { reconstructLines, type ReconstructedLine } from "./line-reconstruction"
import { normalizePositionedText, type NormalizedPdfTextItem } from "./positioned-text"

export interface ImssLayoutRegions {
  lines: ReconstructedLine[]
  receptorColumns: [ReconstructedLine[], ReconstructedLine[], ReconstructedLine[]]
  receptorLines: ReconstructedLine[]
  earningsLines: ReconstructedLine[]
  deductionLines: ReconstructedLine[]
  observationLines: ReconstructedLine[]
  receptorScoped: boolean
  tablesScoped: boolean
  messagesScoped: boolean
  observationsScoped: boolean
  fiscalScoped: boolean
}

function findAnchor(
  items: NormalizedPdfTextItem[],
  labels: string[],
  afterY = Number.NEGATIVE_INFINITY,
  excludeLabels: string[] = [],
): NormalizedPdfTextItem | undefined {
  return items.find(
    (item) =>
      item.y >= afterY &&
      labels.some((label) => item.norm.includes(label)) &&
      !excludeLabels.some((ex) => item.norm.includes(ex))
  )
}

function centerY(item: NormalizedPdfTextItem): number {
  return item.y + item.height / 2
}

function firstAnchorY(
  items: NormalizedPdfTextItem[],
  labels: string[],
  afterY = Number.NEGATIVE_INFINITY,
): number | undefined {
  return findAnchor(items, labels, afterY)?.y
}

export function buildImssLayoutRegions(items: PositionedPdfText[]): ImssLayoutRegions {
  const lines = reconstructLines(items)
  const pageOneItems = items.filter((item) => item.page === 1)
  const normalized = normalizePositionedText(pageOneItems).sort((a, b) => a.y - b.y || a.x - b.x)
  const pageWidth = Math.max(0, ...normalized.map((item) => item.x + item.width))

  const receptorAnchor = findAnchor(normalized, ["RECEPTOR"])
  const earningsAnchor = findAnchor(normalized, ["PERCEPCIONES", "PERCEPCION", "PERCEP"], receptorAnchor?.y)
  const deductionsAnchor = findAnchor(
    normalized,
    ["DEDUCCIONES", "DEDUCCION", "DEDUC"],
    (receptorAnchor?.y ?? 0) - 20,
    ["TOTAL"]
  )
  const receptorScoped = Boolean(
    receptorAnchor &&
    earningsAnchor &&
    receptorAnchor !== earningsAnchor &&
    centerY(receptorAnchor) < centerY(earningsAnchor),
  )

  let receptorColumns: ImssLayoutRegions["receptorColumns"] = [[], [], []]
  if (receptorScoped && receptorAnchor && earningsAnchor && pageWidth > 0) {
    const receptorTop = centerY(receptorAnchor) + 0.01
    const conceptsTop = centerY(earningsAnchor)
    const receptorItems = pageOneItems.filter((item) => {
      const itemCenterY = item.y + item.height / 2
      return itemCenterY >= receptorTop && itemCenterY < conceptsTop
    })
    const delaysAnchor = findAnchor(normalizePositionedText(receptorItems), ["RETARDOS"])
    const periodAnchor = findAnchor(normalizePositionedText(receptorItems), ["PERIODO DE PAGO"])
    const contentLeft = Math.min(...normalized.map((item) => item.x))
    const contentWidth = Math.max(1, pageWidth - contentLeft)
    const firstDivider = delaysAnchor?.x ?? contentLeft + contentWidth * 0.39
    const secondDivider = periodAnchor?.x ?? contentLeft + contentWidth * 0.66

    receptorColumns = [
      reconstructLines(receptorItems, { xMin: 0, xMax: firstDivider }),
      reconstructLines(receptorItems, { xMin: firstDivider, xMax: secondDivider }),
      reconstructLines(receptorItems, { xMin: secondDivider, xMax: pageWidth + 1 }),
    ]
  }

  const headerYDiff = earningsAnchor && deductionsAnchor ? Math.abs(centerY(earningsAnchor) - centerY(deductionsAnchor)) : Infinity
  const parallelTables = Boolean(
    earningsAnchor &&
    deductionsAnchor &&
    headerYDiff <= Math.max(35, (earningsAnchor.height || 10) * 3) &&
    deductionsAnchor.x > earningsAnchor.x + 30,
  )

  let earningsLines = lines
  let deductionLines = lines

  const tableTopSearch = earningsAnchor
    ? Math.min(earningsAnchor.y, deductionsAnchor?.y ?? earningsAnchor.y) - 5
    : 250
  const headerRowItems = normalized.filter(
    (item) => item.y >= tableTopSearch && item.y <= tableTopSearch + Math.max(45, (earningsAnchor?.height ?? 14) * 4),
  )
  const conceptHeaders = headerRowItems
    .filter((item) => item.norm.includes("CONCEPTO"))
    .sort((a, b) => a.x - b.x)
  const importeHeaders = headerRowItems
    .filter((item) => item.norm.includes("IMPORTE"))
    .sort((a, b) => a.x - b.x)
  const hasTwoColumns = conceptHeaders.length >= 2 && conceptHeaders[1].x - conceptHeaders[0].x > 50

  const canSplitTables = (parallelTables || hasTwoColumns) && pageWidth > 0

  if (canSplitTables) {
    const tableTop = tableTopSearch
    let divider: number
    if (conceptHeaders.length >= 2 && importeHeaders.length >= 1) {
      const firstImporteRight = importeHeaders[0].x + importeHeaders[0].width
      const secondConceptoLeft = conceptHeaders[1].x
      divider = (firstImporteRight + secondConceptoLeft) / 2
    } else if (conceptHeaders.length >= 2) {
      divider = (conceptHeaders[0].x + conceptHeaders[1].x) / 2
    } else if (deductionsAnchor && deductionsAnchor.x > (earningsAnchor?.x ?? 0) + 30) {
      divider = deductionsAnchor.x - 10
    } else {
      divider = pageWidth * 0.51
    }

    if (deductionsAnchor && deductionsAnchor.x > (earningsAnchor?.x ?? 0) + 30) {
      // El divisor nunca debe invadir la columna de deducciones
      divider = Math.min(divider, deductionsAnchor.x - 4)
    }

    const endAnchor = findAnchor(
      normalized,
      ["MENSAJES", "OBSERVACIONES", "CERTIFICACION", "SELLO DIGITAL", "INFORMACION FISCAL"],
      (earningsAnchor?.y ?? tableTop) + 15
    )
    const tableBottom = endAnchor
      ? (endAnchor.norm.includes("SELLO") || endAnchor.norm.includes("FISCAL") ? endAnchor.y - 5 : centerY(endAnchor))
      : Number.POSITIVE_INFINITY

    const firstPageEarnings = reconstructLines(pageOneItems, {
      xMin: 0,
      xMax: divider,
      yMin: tableTop,
      yMax: tableBottom,
    })
    const firstPageDeductions = reconstructLines(pageOneItems, {
      xMin: divider,
      xMax: pageWidth + 1,
      yMin: tableTop,
      yMax: tableBottom,
    })
    earningsLines = firstPageEarnings.map((line, index) => ({ ...line, index }))
    deductionLines = firstPageDeductions.map((line, index) => ({ ...line, index }))
  }

  const messagesAnchor = findAnchor(normalized, ["MENSAJES"], earningsAnchor?.y)
  const observationsAnchor = findAnchor(normalized, ["OBSERVACIONES"], messagesAnchor?.y ?? earningsAnchor?.y)
  const certificationY = firstAnchorY(normalized, ["CERTIFICACION", "INFORMACION FISCAL"], observationsAnchor?.y)
  const observationsScoped = Boolean(observationsAnchor)
  const observationLines = observationsAnchor
    ? reconstructLines(pageOneItems, {
        yMin: centerY(observationsAnchor),
        yMax: certificationY ?? Number.POSITIVE_INFINITY,
      })
    : []

  const pageTwoItems = normalizePositionedText(items.filter((item) => item.page > 1))
  const fiscalScoped = Boolean(findAnchor(pageTwoItems, ["INFORMACION FISCAL", "FOLIO FISCAL", "CERTIFICACION"]))

  return {
    lines,
    receptorColumns,
    receptorLines: receptorColumns.flat(),
    earningsLines,
    deductionLines,
    observationLines,
    receptorScoped,
    tablesScoped: parallelTables,
    messagesScoped: Boolean(messagesAnchor),
    observationsScoped,
    fiscalScoped,
  }
}
