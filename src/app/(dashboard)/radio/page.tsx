import { fetchPodcastFeed, DEFAULT_PODCAST_RSS, SPOTIFY_SHOW_URL } from "@/features/radio/services/podcast-rss"
import { RadioPage } from "@/features/radio/components/RadioPage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "La 20 Radio | La Veinte Digital",
  description: "Podcast informativo sindical y laboral IMSS con análisis de normativa y derechos laborales.",
}

export const revalidate = 1800

export default async function RadioRoute() {
  let show
  try {
    show = await fetchPodcastFeed(DEFAULT_PODCAST_RSS)
  } catch (error) {
    console.error("Error al cargar feed de La 20 Radio:", error)
    show = {
      title: "La Veinte Radio",
      description: "Espacio informativo sobre normativa sindical, cláusulas del CCT y derechos de la base trabajadora del IMSS.",
      link: SPOTIFY_SHOW_URL,
      imageUrl: "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/46879753/46879753-1790947894171-e2a7105671072.jpg",
      author: "Eduardo Bolaños Vázquez",
      feedUrl: DEFAULT_PODCAST_RSS,
      episodes: [],
    }
  }

  return <RadioPage initialShow={show} />
}
