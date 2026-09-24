import { describe, it, expect } from "vitest"
import {
  isAnnouncementEligibleForHero,
  fetchPublishedHeroAnnouncements,
} from "../services/home-hero-service"
import type { Announcement } from "@/shared/contracts/announcements"

function makeTestAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "ann-1",
    kind: "announcement",
    title: "Nueva función disponible",
    push_summary: "Resumen breve",
    body: "Contenido completo del anuncio",
    bar_text: "Texto corto",
    destination_path: "/copias",
    status: "PUBLISHED",
    show_in_inbox: true,
    show_in_bar: false,
    show_in_home_hero: true,
    publish_at: null,
    expires_at: null,
    revision: 1,
    source_document: null,
    source_reference: null,
    source_version: null,
    source_page: null,
    reviewed_by: null,
    reviewed_at: null,
    created_by: "admin-1",
    updated_by: "admin-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("home-hero-service — isAnnouncementEligibleForHero", () => {
  it("acepta un aviso publicado con show_in_home_hero=true y vigente", () => {
    const item = makeTestAnnouncement()
    expect(isAnnouncementEligibleForHero(item)).toBe(true)
  })

  it("rechaza si show_in_home_hero es false", () => {
    const item = makeTestAnnouncement({ show_in_home_hero: false })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("rechaza si status no es PUBLISHED", () => {
    const item = makeTestAnnouncement({ status: "DRAFT" })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("rechaza si el título está vacío", () => {
    const item = makeTestAnnouncement({ title: "   " })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("rechaza si la fecha publish_at es futura", () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const item = makeTestAnnouncement({ publish_at: future })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("rechaza si la fecha expires_at ya pasó", () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const item = makeTestAnnouncement({ expires_at: past })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("rechaza avisos normativos sin revisión editorial acreditada", () => {
    const item = makeTestAnnouncement({
      source_document: "CCT 2025-2027",
      source_reference: "Cláusula 63 Bis",
      reviewed_at: null,
    })
    expect(isAnnouncementEligibleForHero(item)).toBe(false)
  })

  it("acepta avisos normativos con revisión editorial acreditada", () => {
    const item = makeTestAnnouncement({
      source_document: "CCT 2025-2027",
      source_reference: "Cláusula 63 Bis",
      reviewed_at: new Date().toISOString(),
    })
    expect(isAnnouncementEligibleForHero(item)).toBe(true)
  })
})

describe("home-hero-service — fetchPublishedHeroAnnouncements", () => {
  it("devuelve arreglo vacío ante excepción de conexión o cliente nulo", async () => {
    const fakeClient = {
      from: () => {
        throw new Error("Conexión rechazada")
      },
    } as unknown as Parameters<typeof fetchPublishedHeroAnnouncements>[0]

    const result = await fetchPublishedHeroAnnouncements(fakeClient)
    expect(result).toEqual([])
  })
})
