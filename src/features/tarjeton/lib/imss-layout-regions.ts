import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"
import { reconstructLines, type ReconstructedLine } from "./line-reconstruction"
import { normalizePositionedText, type NormalizedPdfTextItem } from "./positioned-text"

export interface ImssLayoutRegions {
  lines: ReconstructedLine[]
  receptorColumns: [ReconstructedLine[], ReconstructedLine[], ReconstructedLine[]]
  receptorLines: ReconstructedLine[]
  earningsLines: ReconstructedLine[]
  deductionLines: ReconstructedLine[]
  receptorScoped: boolean
  tablesScoped: boolean
}

function findAnchor(
  items: NormalizedPdfTextItem[],
  labels: string[],
  afterY = Number.NEGATIVE_INFINITY,
): NormalizedPdfTextItem | undefined {
  return items.find((item) => item.y >= afterY && labels.some((label) => item.norm.includes(label)))
}

function centerY(item: NormalizedPdfTextItem): number {
  return item.y + item.height / 2
}

export function buildImssLayoutRegions(items: PositionedPdfText[]): ImssLayoutRegions {
  const lines = reconstructLines(items)
  const pageOneItems = items.filter((item) => item.page === 1)
  const normalized = normalizePositionedText(pageOneItems).sort((a, b) => a.y - b.y || a.x - b.x)
  const pageWidth = Math.max(0, ...normalized.map((item) => item.x + item.width))

  const receptorAnchor = findAnchor(normalized, ["RECEPTOR"])
  const earningsAnchor = findAnchor(normalized, ["PERCEPCIONES"], receptorAnchor?.y)
  const deductionsAnchor = findAnchor(normalized, ["DEDUCCIONES"], earningsAnchor?.y)
  const receptorScoped = Boolean(
    receptorAnchor &&
    earningsAnchor &&
    receptorAnchor !== earningsAnchor &&
    centerY(receptorAnchor) < centerY(earningsAnchor),
  )

  let receptorColumns: ImssLayoutRegions["receptorColumns"] = [lines, [], []]
  if (receptorScoped && receptorAnchor && earningsAnchor && pageWidth > 0) {
    const receptorTop = centerY(receptorAnchor) + 0.01
    const conceptsTop = centerY(earningsAnchor)
    const receptorItems = pageOneItems.filter((item) => {
      const itemCenterY = item.y + item.height / 2
      return itemCenterY >= receptorTop && itemCenterY < conceptsTop
    })
    const delaysAnchor = findAnchor(normalizePositionedText(receptorItems), ["RETARDOS"])
    const periodAnchor = findAnchor(normalizePositionedText(receptorItems), ["PERIODO DE PAGO"])
    const firstDivider = delaysAnchor?.x ?? pageWidth * 0.39
    const secondDivider = periodAnchor?.x ?? pageWidth * 0.66

    receptorColumns = [
      reconstructLines(receptorItems, { xMin: 0, xMax: firstDivider }),
      reconstructLines(receptorItems, { xMin: firstDivider, xMax: secondDivider }),
      reconstructLines(receptorItems, { xMin: secondDivider, xMax: pageWidth + 1 }),
    ]
  }

  const parallelTables = Boolean(
    earningsAnchor &&
    deductionsAnchor &&
    Math.abs(centerY(earningsAnchor) - centerY(deductionsAnchor)) <= 3 &&
    deductionsAnchor.x > earningsAnchor.x,
  )
  let earningsLines = lines
  let deductionLines = lines
  if (earningsAnchor && parallelTables && pageWidth > 0) {
    const tableTop = centerY(earningsAnchor)
    const endAnchor = findAnchor(normalized, ["MENSAJES", "OBSERVACIONES", "CERTIFICACION"], earningsAnchor.y + 0.01)
    const tableBottom = endAnchor ? centerY(endAnchor) : Number.POSITIVE_INFINITY
    const divider = deductionsAnchor?.x ?? pageWidth / 2

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
    const continuationItems = items.filter((item) => item.page > 1)
    earningsLines = [...firstPageEarnings, ...reconstructLines(continuationItems, { xMin: 0, xMax: divider })]
      .map((line, index) => ({ ...line, index }))
    deductionLines = [...firstPageDeductions, ...reconstructLines(continuationItems, { xMin: divider })]
      .map((line, index) => ({ ...line, index }))
  }

  return {
    lines,
    receptorColumns,
    receptorLines: receptorColumns.flat(),
    earningsLines,
    deductionLines,
    receptorScoped,
    tablesScoped: parallelTables,
  }
}
