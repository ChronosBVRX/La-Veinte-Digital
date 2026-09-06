import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  isNormativeAnnouncement,
  requiresNormativaReview,
  isAnnouncementEligibleForBar,
  announcementToMobileValueItem,
  mergeMobileBarItems,
  fetchPublishedBarItems,
} from "../services/mobile-bar-service"
import type { Announcement } from "@/shared/contracts/announcements"
import type { MobileValueItem } from "@/shared/components/app/mobileValueItems"

describe("mobile-bar-service", () => {
  const baseAnnouncement: Announcement = {
    id: "a1111111-1111-1111-1111-111111111111",
    kind: "tip",
    title: "Consejo de aguinaldo",
    push_summary: null,
    body: "Contenido detallado",
    bar_text: "¿Sabías calcular tu aguinaldo?",
    destination_path: "/calculadoras",
    status: "PUBLISHED",
    show_in_inbox: true,
    show_in_bar: true,
    publish_at: null,
    expires_at: null,
    revision: 1,
    source_document: null,
    source_reference: null,
    source_version: null,
    source_page: null,
    reviewed_by: null,
    reviewed_at: null,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  describe("isNormativeAnnouncement", () => {
    it("identifica avisos con documento normativo", () => {
      expect(isNormativeAnnouncement({ source_document: "CCT 2025-2027", source_reference: null })).toBe(true)
      expect(isNormativeAnnouncement({ source_document: null, source_reference: "Cláusula 107" })).toBe(true)
      expect(isNormativeAnnouncement({ source_document: "", source_reference: "   " })).toBe(false)
      expect(isNormativeAnnouncement({ source_document: null, source_reference: null })).toBe(false)
    })
  })

  describe("requiresNormativaReview", () => {
    it("exige revisión editorial si tiene fuente normativa y no ha sido revisado", () => {
      expect(
        requiresNormativaReview({
          source_document: "CCT",
          source_reference: "Cláusula 45",
          reviewed_at: null,
        }),
      ).toBe(true)
    })

    it("no exige revisión si ya fue revisado por un editor", () => {
      expect(
        requiresNormativaReview({
          source_document: "CCT",
          source_reference: "Cláusula 45",
          reviewed_at: "2026-09-06T12:00:00Z",
        }),
      ).toBe(false)
    })

    it("no exige revisión si el tip no cita fuentes normativas", () => {
      expect(
        requiresNormativaReview({
          source_document: null,
          source_reference: null,
          reviewed_at: null,
        }),
      ).toBe(false)
    })
  })

  describe("isAnnouncementEligibleForBar", () => {
    it("acepta un tip publicado y con show_in_bar activo", () => {
      expect(isAnnouncementEligibleForBar(baseAnnouncement)).toBe(true)
    })

    it("rechaza si show_in_bar es false", () => {
      expect(isAnnouncementEligibleForBar({ ...baseAnnouncement, show_in_bar: false })).toBe(false)
    })

    it("rechaza si el estatus no es PUBLISHED", () => {
      expect(isAnnouncementEligibleForBar({ ...baseAnnouncement, status: "DRAFT" })).toBe(false)
      expect(isAnnouncementEligibleForBar({ ...baseAnnouncement, status: "SCHEDULED" })).toBe(false)
      expect(isAnnouncementEligibleForBar({ ...baseAnnouncement, status: "ARCHIVED" })).toBe(false)
    })

    it("rechaza tips normativos no revisados editorialmente", () => {
      const unreviewedNormative: Announcement = {
        ...baseAnnouncement,
        source_document: "CCT",
        source_reference: "Cláusula 12",
        reviewed_at: null,
      }
      expect(isAnnouncementEligibleForBar(unreviewedNormative)).toBe(false)
    })

    it("acepta tips normativos debidamente revisados editorialmente", () => {
      const reviewedNormative: Announcement = {
        ...baseAnnouncement,
        source_document: "CCT",
        source_reference: "Cláusula 12",
        reviewed_at: "2026-09-06T10:00:00Z",
      }
      expect(isAnnouncementEligibleForBar(reviewedNormative)).toBe(true)
    })

    it("respeta fechas futuras de publicación y fechas pasadas de expiración", () => {
      const now = new Date("2026-09-06T12:00:00Z")
      expect(
        isAnnouncementEligibleForBar(
          { ...baseAnnouncement, publish_at: "2026-09-07T00:00:00Z" },
          now,
        ),
      ).toBe(false)
      expect(
        isAnnouncementEligibleForBar(
          { ...baseAnnouncement, expires_at: "2026-09-05T00:00:00Z" },
          now,
        ),
      ).toBe(false)
      expect(
        isAnnouncementEligibleForBar(
          {
            ...baseAnnouncement,
            publish_at: "2026-09-01T00:00:00Z",
            expires_at: "2026-09-10T00:00:00Z",
          },
          now,
        ),
      ).toBe(true)
    })

    it("rechaza si carece de bar_text y title", () => {
      expect(isAnnouncementEligibleForBar({ ...baseAnnouncement, bar_text: null, title: "   " })).toBe(false)
    })
  })

  describe("announcementToMobileValueItem", () => {
    it("convierte un anuncio a MobileValueItem con mapeo correcto", () => {
      const item = announcementToMobileValueItem(baseAnnouncement)
      expect(item.id).toBe(baseAnnouncement.id)
      expect(item.type).toBe("tip")
      expect(item.eyebrow).toBe("Consejo")
      expect(item.text).toBe("¿Sabías calcular tu aguinaldo?")
      expect(item.href).toBe("/calculadoras")
      expect(item.enabled).toBe(true)
    })

    it("usa title si bar_text es null", () => {
      const item = announcementToMobileValueItem({
        ...baseAnnouncement,
        bar_text: null,
        title: "Título como fallback",
      })
      expect(item.text).toBe("Título como fallback")
    })

    it("asigna destino /avisos/:id si destination_path es null", () => {
      const item = announcementToMobileValueItem({
        ...baseAnnouncement,
        destination_path: null,
      })
      expect(item.href).toBe(`/avisos/${baseAnnouncement.id}`)
    })

    it("incluye cita normativa si cuenta con documento y referencia", () => {
      const item = announcementToMobileValueItem({
        ...baseAnnouncement,
        source_document: "CCT 2025-2027",
        source_reference: "Cláusula 93",
      })
      expect(item.source).toEqual({
        document: "CCT 2025-2027",
        reference: "Cláusula 93",
      })
    })
  })

  describe("mergeMobileBarItems", () => {
    const localItems: MobileValueItem[] = [
      { id: "loc-1", type: "tool", text: "Local 1", enabled: true },
      { id: "loc-2", type: "tool", text: "Local 2", enabled: true },
    ]

    it("mantiene items locales si la lista remota está vacía", () => {
      expect(mergeMobileBarItems(localItems, [])).toEqual(localItems)
    })

    it("antepone los items remotos sin duplicar ids", () => {
      const remoteItems: MobileValueItem[] = [
        { id: "rem-1", type: "tip", text: "Remoto 1", enabled: true },
        { id: "loc-1", type: "tip", text: "Remoto pisando local 1", enabled: true },
      ]
      const merged = mergeMobileBarItems(localItems, remoteItems)
      expect(merged).toHaveLength(3)
      expect(merged[0].id).toBe("rem-1")
      expect(merged[1].id).toBe("loc-1")
      expect(merged[1].text).toBe("Remoto pisando local 1")
      expect(merged[2].id).toBe("loc-2")
    })
  })

  describe("fetchPublishedBarItems", () => {
    it("devuelve [] en caso de ausencia de configuración de Supabase", async () => {
      const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const items = await fetchPublishedBarItems()
      expect(items).toEqual([])

      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
    })
  })
})
