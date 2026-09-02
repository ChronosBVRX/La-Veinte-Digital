// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PdfFileViewer } from "../PdfFileViewer"

vi.mock("@/features/tarjeton/lib/pdfjs-client", () => ({
  loadPdfDocument: vi.fn().mockResolvedValue({
    pdf: {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    },
    loadingTask: { promise: Promise.resolve() },
  }),
}))

describe("PdfFileViewer", () => {
  it("renders page image when PDF is loaded", async () => {
    const getContextMock = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    })
    const toDataUrlMock = vi.fn().mockReturnValue("data:image/png;base64,fakeimg")
    HTMLCanvasElement.prototype.getContext = getContextMock as unknown as typeof HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.toDataURL = toDataUrlMock

    const fakePdfFile = new File(["%PDF-1.4 mock content"], "test.pdf", { type: "application/pdf" })

    render(<PdfFileViewer file={fakePdfFile} />)

    expect(screen.getByText(/Cargando documento PDF…/i)).toBeDefined()

    const pageImg = await screen.findByAltText(/Página 1/i)
    expect(pageImg).toBeDefined()
    expect(pageImg.getAttribute("src")).toBe("data:image/png;base64,fakeimg")
  })
})
