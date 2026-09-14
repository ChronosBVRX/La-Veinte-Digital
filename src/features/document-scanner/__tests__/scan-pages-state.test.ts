import { describe, it, expect } from "vitest"
import {
  addPage,
  addPages,
  createPageId,
  movePage,
  releasePages,
  removePage,
  reorderPages,
  replacePage,
  rotatePage,
  setPageFilter,
  updatePage,
} from "../lib/scan-pages-state"
import type { ScanPage } from "../types/scanner-types"

function page(id: string, overrides: Partial<ScanPage> = {}): ScanPage {
  return {
    id,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    previewUrl: `blob:test-${id}`,
    width: 100,
    height: 200,
    filter: "original",
    rotation: 0,
    engine: "web",
    ...overrides,
  }
}

describe("scan-pages-state", () => {
  it("agrega una página al final", () => {
    const pages = addPage([], page("a"))
    expect(pages.map((p) => p.id)).toEqual(["a"])
  })

  it("agrega múltiples páginas en orden", () => {
    const pages = addPages([page("a")], [page("b"), page("c")])
    expect(pages.map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("elimina una página por id sin tocar las demás", () => {
    const pages = removePage([page("a"), page("b"), page("c")], "b")
    expect(pages.map((p) => p.id)).toEqual(["a", "c"])
  })

  it("reordena moviendo una página hacia arriba", () => {
    const pages = movePage([page("a"), page("b"), page("c")], "b", "up")
    expect(pages.map((p) => p.id)).toEqual(["b", "a", "c"])
  })

  it("reordena moviendo una página hacia abajo", () => {
    const pages = movePage([page("a"), page("b"), page("c")], "b", "down")
    expect(pages.map((p) => p.id)).toEqual(["a", "c", "b"])
  })

  it("no modifica si el movimiento sale de los límites", () => {
    const original = [page("a"), page("b")]
    expect(movePage(original, "a", "up")).toBe(original)
    expect(movePage(original, "b", "down")).toBe(original)
  })

  it("reordena por índices", () => {
    const pages = reorderPages([page("a"), page("b"), page("c")], 0, 2)
    expect(pages.map((p) => p.id)).toEqual(["b", "c", "a"])
  })

  it("rota 90° acumulativamente y regresa a 0", () => {
    let pages = [page("a")]
    pages = rotatePage(pages, "a")
    expect(pages[0].rotation).toBe(90)
    pages = rotatePage(pages, "a")
    expect(pages[0].rotation).toBe(180)
    pages = rotatePage(pages, "a")
    expect(pages[0].rotation).toBe(270)
    pages = rotatePage(pages, "a")
    expect(pages[0].rotation).toBe(0)
  })

  it("cambia el filtro de una sola página", () => {
    const pages = setPageFilter([page("a"), page("b")], "b", "bw")
    expect(pages[0].filter).toBe("original")
    expect(pages[1].filter).toBe("bw")
  })

  it("reemplaza una página conservando su posición", () => {
    const replacement = page("a", { filter: "grayscale", width: 300 })
    const pages = replacePage([page("a"), page("b")], "a", replacement)
    expect(pages.map((p) => p.id)).toEqual(["a", "b"])
    expect(pages[0].filter).toBe("grayscale")
    expect(pages[0].width).toBe(300)
  })

  it("actualiza campos puntuales sin mutar la entrada", () => {
    const original = [page("a")]
    const updated = updatePage(original, "a", { filter: "enhanced", rotation: 90 })
    expect(updated[0].filter).toBe("enhanced")
    expect(updated[0].rotation).toBe(90)
    expect(original[0].filter).toBe("original")
    expect(original[0].rotation).toBe(0)
  })

  it("genera ids únicos", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createPageId()))
    expect(ids.size).toBe(50)
  })

  it("releasePages revoca object URLs sin lanzar", () => {
    const pages = [page("a"), page("b")]
    expect(() => releasePages(pages)).not.toThrow()
  })
})
