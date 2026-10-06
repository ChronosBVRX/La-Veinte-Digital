// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  normalizeImageAssetKey,
  sanitizeFacebookPermalink,
  extractPostsFromFacebookHtml,
  extractPostsFromHtmlAndGraphqlChunks,
} from "../lib/relay-post-extractor"
import { FacebookFeeds } from "../components/FacebookFeeds"
import {
  FacebookPostCard,
  splitHeadlineAndBody,
  isDirectVideoUrl,
  isFacebookVideoUrl,
} from "../components/FacebookPostCard"
import type { FacebookPost } from "../types"

describe("relay-post-extractor", () => {
  it("normalizes Facebook scontent image asset keys across different resolutions", () => {
    const thumb =
      "https://scontent.fmlm3-1.fna.fbcdn.net/v/t39.30808-6/835120093_122137217870741944_1268398681525045011_n.jpg?stp=s320x320&oh=abc&oe=123"
    const full =
      "https://scontent.fmlm3-1.fna.fbcdn.net/v/t39.30808-6/835120093_122137217870741944_1268398681525045011_n.jpg?stp=dst-jpg_s960x960&oh=def&oe=456"

    expect(normalizeImageAssetKey(thumb)).toBe(
      "835120093_122137217870741944_1268398681525045011_n.jpg",
    )
    expect(normalizeImageAssetKey(thumb)).toBe(normalizeImageAssetKey(full))
  })

  it("strips tracking query parameters from Facebook permalinks", () => {
    const dirty =
      "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbid02fQeB2v?__cft__[0]=AZi2&__tn__=%2CO"
    expect(
      sanitizeFacebookPermalink(dirty, "https://www.facebook.com/SNTSSSeccionXXMichoacan"),
    ).toBe("https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbid02fQeB2v")
  })

  it("extracts posts from SSR HTML <script type='application/json'> and picks highest resolution image", () => {
    const fakeRelayPayload = {
      data: {
        node: {
          comet_sections: {
            content: {
              story: {
                post_id: "122137219376741944",
                wwwURL:
                  "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbid02fQeB2v?__cft__[0]=123",
                message: {
                  text: "🏆 CLAUSURA DEL TORNEO DE VOLEIBOL ZONA URUAPAN\nCon entusiasmo y gran espíritu deportivo llegó a su clausura.",
                },
                attachments: [
                  {
                    photo_image: {
                      uri: "https://scontent.xx.fbcdn.net/v/t39.30808-6/835120093_111_222_n.jpg?stp=s960x960",
                      width: 960,
                      height: 720,
                    },
                    image: {
                      uri: "https://scontent.xx.fbcdn.net/v/t39.30808-6/835120093_111_222_n.jpg?stp=s320x320",
                      width: 320,
                      height: 240,
                    },
                  },
                ],
              },
            },
            context_layout: {
              story: {
                comet_sections: {
                  metadata: [
                    {
                      story: {
                        creation_time: 1791155621,
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    }

    const html = `<html><body><script type="application/json" data-sjs>${JSON.stringify(
      fakeRelayPayload,
    )}</script></body></html>`

    const posts = extractPostsFromFacebookHtml("seccionxx", html)
    expect(posts).toHaveLength(1)
    expect(posts[0].externalPostId).toBe("122137219376741944")
    expect(posts[0].permalinkUrl).toBe(
      "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbid02fQeB2v",
    )
    expect(posts[0].images).toHaveLength(1)
    expect(posts[0].images[0].width).toBe(960)
  })

  it("extracts video posts with thumbnails and marks isVideo flag", () => {
    const videoPayload = {
      comet_sections: {
        story: {
          post_id: "reel-123",
          creation_time: 1791155621,
          url: "https://www.facebook.com/reel/123456789/",
          message: {
            text: "🎬 Mensaje oficial en video de la Sección XX",
          },
          attachments: [
            {
              preferred_thumbnail: {
                image: {
                  uri: "https://scontent.xx.fbcdn.net/v/t39.30808-6/reel_thumb.jpg",
                  width: 720,
                  height: 1280,
                },
              },
            },
          ],
        },
      },
    }

    const posts = extractPostsFromHtmlAndGraphqlChunks(
      "seccionxx",
      [],
      [JSON.stringify(videoPayload)],
    )

    expect(posts).toHaveLength(1)
    expect(posts[0].externalPostId).toBe("reel-123")
    expect(posts[0].isVideo).toBe(true)
    expect(posts[0].images).toHaveLength(1)
    expect(posts[0].images[0].uri).toContain("reel_thumb.jpg")
  })

  it("merges graphql stream chunks and deduplicates identical text signatures", () => {
    const storyA = {
      comet_sections: {
        story: {
          post_id: "1001",
          creation_time: 1791155621,
          url: "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbidA",
          message: {
            text: "Comunicado oficial de la Sección XX sobre las convocatorias escalafonarias vigentes para todo el personal.",
          },
        },
      },
    }
    const storyDuplicateEdited = {
      comet_sections: {
        story: {
          post_id: "1002",
          creation_time: 1791155600,
          url: "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/pfbidB",
          message: {
            text: "Comunicado oficial de la Sección XX sobre las convocatorias escalafonarias vigentes para todo el personal.",
          },
        },
      },
    }

    const posts = extractPostsFromHtmlAndGraphqlChunks(
      "seccionxx",
      [],
      [`${JSON.stringify(storyA)}\n${JSON.stringify(storyDuplicateEdited)}`],
    )
    expect(posts).toHaveLength(1)
    expect(posts[0].externalPostId).toBe("1001")
  })

  it("splits headline and body when post starts with a concise title line", () => {
    const res = splitHeadlineAndBody(
      "📢 APERTURA DE CONVOCATORIAS ESCALAFONARIAS\nCon base en el Reglamento de Capacitación y Adiestramiento.",
    )
    expect(res.headline).toBe("📢 APERTURA DE CONVOCATORIAS ESCALAFONARIAS")
    expect(res.body).toBe("Con base en el Reglamento de Capacitación y Adiestramiento.")
  })
})

describe("video url helper functions", () => {
  it("detects direct video URLs correctly", () => {
    expect(isDirectVideoUrl("https://example.com/video.mp4")).toBe(true)
    expect(isDirectVideoUrl("https://example.com/stream.webm")).toBe(true)
    expect(isDirectVideoUrl("https://example.com/image.jpg")).toBe(false)
    expect(isDirectVideoUrl("")).toBe(false)
  })

  it("detects Facebook video and reel URLs correctly", () => {
    expect(isFacebookVideoUrl("https://www.facebook.com/reel/1747719799784382/")).toBe(true)
    expect(isFacebookVideoUrl("https://www.facebook.com/SNTSSSeccionXXMichoacan/videos/123/")).toBe(true)
    expect(isFacebookVideoUrl("https://www.facebook.com/watch/?v=123")).toBe(true)
    expect(isFacebookVideoUrl("https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/123")).toBe(false)
  })
})

const samplePosts: FacebookPost[] = [
  {
    id: "uuid-1",
    pageKey: "seccionxx",
    pageName: "SNTSS Sección XX Michoacán",
    externalPostId: "post-xx-1",
    permalinkUrl: "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/1",
    contentText:
      "🏆 CLAUSURA DEL TORNEO DE VOLEIBOL ZONA URUAPAN\nCon entusiasmo y gran espíritu deportivo llegó a su clausura el Torneo en Uruapan.",
    mediaUrls: ["https://supabase.la20.com.mx/storage/v1/object/public/facebook-media/seccionxx/1.jpg"],
    category: "Deportes y Cultura",
    publishedAt: "2026-10-04T23:13:41.000Z",
    syncedAt: "2026-10-05T18:00:00.000Z",
  },
  {
    id: "uuid-2",
    pageKey: "seccionxx",
    pageName: "SNTSS Sección XX Michoacán",
    externalPostId: "post-xx-2",
    permalinkUrl: "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/2",
    contentText:
      "📚 Día Mundial de los Docentes\nReconocemos a quienes hacen de la enseñanza una herramienta para transformar el IMSS.",
    mediaUrls: [],
    category: "Capacitación",
    publishedAt: "2026-10-05T16:56:51.000Z",
    syncedAt: "2026-10-05T18:00:00.000Z",
  },
]

describe("FacebookFeeds & FacebookPostCard", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: samplePosts }),
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders native posts exclusively for Sección XX Michoacán with category filter", () => {
    render(<FacebookFeeds initialPosts={samplePosts} />)

    expect(screen.getByText(/CLAUSURA DEL TORNEO DE VOLEIBOL/i)).toBeInTheDocument()
    expect(screen.getByText(/Día Mundial de los Docentes/i)).toBeInTheDocument()
    expect(screen.getAllByText("SNTSS Sección XX Michoacán").length).toBeGreaterThan(0)

    // Filter by category "Deportes y Cultura"
    fireEvent.click(screen.getByRole("button", { name: "Deportes y Cultura" }))
    expect(screen.getByText(/CLAUSURA DEL TORNEO DE VOLEIBOL/i)).toBeInTheDocument()
    expect(screen.queryByText(/Día Mundial de los Docentes/i)).not.toBeInTheDocument()
  })

  it("expands and collapses long post text when clicking Leer comunicado completo", () => {
    const longPost: FacebookPost = {
      ...samplePosts[0],
      contentText: `📢 CONVOCATORIA GENERAL\n${"Texto detallado de la convocatoria sindical ".repeat(15)}`,
    }

    render(<FacebookPostCard post={longPost} />)

    const toggleBtn = screen.getByRole("button", { name: /Leer comunicado completo/i })
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(screen.getByRole("button", { name: /Mostrar menos/i })).toBeInTheDocument()
  })

  it("renders video card and switches to player when clicking play for a video post", () => {
    const videoPost: FacebookPost = {
      id: "uuid-video",
      pageKey: "seccionxx",
      pageName: "SNTSS Sección XX Michoacán",
      externalPostId: "post-reel-1",
      permalinkUrl: "https://www.facebook.com/reel/1747719799784382/",
      contentText: "🎬 Mensaje oficial en video de la Sección XX",
      mediaUrls: [],
      isVideo: true,
      publishedAt: "2026-10-05T17:00:00.000Z",
      syncedAt: "2026-10-05T18:00:00.000Z",
    }

    render(<FacebookPostCard post={videoPost} />)

    // Should display Reel badge and play button
    expect(screen.getAllByText(/Reel/i).length).toBeGreaterThan(0)
    const playBtn = screen.getAllByRole("button", { name: /Reproducir/i })[0]
    expect(playBtn).toBeInTheDocument()

    // Click play to render iframe player
    fireEvent.click(playBtn)
    const iframe = screen.getByTitle(/Video oficial de la Sección XX/i)
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("https%3A%2F%2Fwww.facebook.com%2Freel%2F1747719799784382%2F"),
    )
  })

  it("renders native <video> element when mediaUrls contains a direct video file", () => {
    const directVideoPost: FacebookPost = {
      id: "uuid-mp4",
      pageKey: "seccionxx",
      pageName: "SNTSS Sección XX Michoacán",
      externalPostId: "post-mp4-1",
      permalinkUrl: "https://www.facebook.com/SNTSSSeccionXXMichoacan/posts/100",
      contentText: "🎥 Video institucional informativo",
      mediaUrls: ["https://example.com/comunicado.mp4"],
      isVideo: true,
      publishedAt: "2026-10-05T17:00:00.000Z",
      syncedAt: "2026-10-05T18:00:00.000Z",
    }

    render(<FacebookPostCard post={directVideoPost} />)

    // Click play to load direct video
    const playBtn = screen.getAllByRole("button", { name: /Reproducir/i })[0]
    fireEvent.click(playBtn)

    // Should render a <video> element, not an <img> element
    const videoEl = document.querySelector("video")
    expect(videoEl).toBeInTheDocument()
    expect(videoEl).toHaveAttribute("src", "https://example.com/comunicado.mp4")
  })
})
