"use client"

import { useState, useEffect } from "react"
import { getFacebookPosts, type FacebookPost } from "@/features/facebook/services/feed"

export function useFacebookFeed(page = "SNTSSSeccionXXMichoacan") {
  const [posts, setPosts] = useState<FacebookPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getFacebookPosts(page)
      .then((data) => {
        if (cancelled) return
        setPosts(data)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [page])

  return { posts, loading, error }
}