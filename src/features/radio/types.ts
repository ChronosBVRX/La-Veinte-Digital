export interface PodcastEpisode {
  id: string
  title: string
  description: string
  cleanDescription: string
  pubDate: string
  formattedDate: string
  audioUrl: string
  duration: string
  link?: string
  imageUrl?: string
}

export interface PodcastShow {
  title: string
  description: string
  link: string
  imageUrl: string
  author: string
  feedUrl: string
  episodes: PodcastEpisode[]
}
