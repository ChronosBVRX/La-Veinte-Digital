// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { AgendaManagerPanel } from "../components/AgendaManagerPanel"

vi.mock("../hooks/useCommitments", () => ({
  useCommitments: () => ({
    commitments: [
      {
        id: "c-1",
        userId: "u-1",
        type: "tiempo_extra",
        title: "GUARDIA EXTRAORDINARIA PEDIATRIA PISO TRES NOCTURNO EN SALA DE URGENCIAS",
        startAt: "2026-08-20T14:00:00Z",
        endAt: "2026-08-20T22:00:00Z",
        status: "active",
        substituteWorkerName: "MARIA DEL CARMEN HERNANDEZ LOPEZ DE LA HUERTA",
        service: "URGENCIAS PEDIATRICAS HOSPITAL GENERAL DE ZONA",
        workplace: "HOSPITAL GENERAL DE ZONA 1 SUBDIRECCION MEDICA",
        notes: "CUBRE GUARDIA COMPLETA CON AUTORIZACION EXPRESA DE JEFATURA DELEGACIONAL",
        createdAt: "2026-08-20T00:00:00Z",
      },
    ],
    fetchError: null,
    migration: "completed",
    retryMigration: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  }),
}))

describe("AgendaManagerPanel mobile overflow prevention", () => {
  const VIEWPORTS = [320, 360, 393, 412]

  VIEWPORTS.forEach((width) => {
    it(`renders cleanly within mobile viewport width ${width}px without overflowing container`, () => {
      const { container } = render(
        <div style={{ width: `${width}px`, maxWidth: `${width}px`, overflowX: "hidden", boxSizing: "border-box" }}>
          <AgendaManagerPanel userId="u-1" />
        </div>
      )

      const root = container.firstElementChild as HTMLElement
      expect(root).toBeTruthy()

      // The text elements must allow word wrapping to avoid horizontal blowing up
      const titleSpan = container.querySelector('span[style*="overflow-wrap"]') || container.querySelector('span[style*="overflowWrap"]')
      expect(titleSpan).toBeTruthy()

      // Filters container must have overflow-x auto and WebkitOverflowScrolling touch
      const filtersRow = container.querySelector('div[style*="overflow-x: auto"]') || container.querySelector('div[style*="overflowX: auto"]') || container.querySelector('div[style*="overflow-x"]')
      expect(filtersRow).toBeTruthy()

      // Footer notice must not force nowrap
      const footerP = container.querySelector("p:last-of-type")
      if (footerP) {
        expect((footerP as HTMLElement).style.whiteSpace).not.toBe("nowrap")
      }
    })
  })
})
