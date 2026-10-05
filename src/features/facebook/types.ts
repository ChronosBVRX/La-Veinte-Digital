export type FacebookPageKey = "seccionxx" | "cen"

export interface FacebookPageConfig {
  key: FacebookPageKey
  name: string
  shortName: string
  subtitle: string
  url: string
  accentColor: string
}

export const FACEBOOK_PAGES: Record<FacebookPageKey, FacebookPageConfig> = {
  seccionxx: {
    key: "seccionxx",
    name: "SNTSS Sección XX Michoacán",
    shortName: "Sección XX",
    subtitle: "Comité Ejecutivo Seccional · Michoacán",
    url: "https://www.facebook.com/SNTSSSeccionXXMichoacan",
    accentColor: "#047857",
  },
  cen: {
    key: "cen",
    name: "CEN SNTSS Nacional",
    shortName: "CEN Nacional",
    subtitle: "Comité Ejecutivo Nacional · SNTSS",
    url: "https://www.facebook.com/SNTSSOFICIAL",
    accentColor: "#1d4ed8",
  },
}

export interface FacebookPost {
  id: string
  pageKey: FacebookPageKey
  pageName: string
  externalPostId: string
  permalinkUrl: string
  contentText: string
  mediaUrls: string[]
  category?: string | null
  summary?: string | null
  tags?: string[]
  publishedAt: string
  syncedAt: string
}

export interface ScrapedFacebookImage {
  uri: string
  assetKey: string
  width: number
  height: number
}

export interface ScrapedFacebookPost {
  pageKey: FacebookPageKey
  pageName: string
  externalPostId: string
  permalinkUrl: string
  contentText: string
  images: ScrapedFacebookImage[]
  publishedAt: string
}
