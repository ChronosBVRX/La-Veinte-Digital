export interface FacebookPost {
  id: string
  text: string | null
  time: string
  image: string | null
  video: string | null
  likes: number | null
  comments: number | null
  shares: number | null
  url: string | null
}

export async function getFacebookPosts(page = "SNTSSSeccionXXMichoacan", pages = 3): Promise<FacebookPost[]> {
  const res = await fetch(`/api/facebook?page=${encodeURIComponent(page)}&pages=${pages}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.posts ?? []
}