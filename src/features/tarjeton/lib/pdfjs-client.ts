/**
 * Re-export para compatibilidad retroactiva dentro del módulo tarjetón.
 * La implementación canónica se encuentra en `@/shared/lib/pdfjs-client`.
 */
export type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist"
export { configurePdfJs, loadPdfDocument } from "@/shared/lib/pdfjs-client"
