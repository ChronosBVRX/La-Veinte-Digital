"use client"

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { PodcastEpisode } from "../types"

interface RadioContextType {
  currentEpisode: PodcastEpisode | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  isMuted: boolean
  isVisible: boolean
  playEpisode: (episode: PodcastEpisode) => void
  pause: () => void
  resume: () => void
  togglePlay: () => void
  seek: (seconds: number) => void
  skip: (seconds: number) => void
  setRate: (rate: number) => void
  toggleMute: () => void
  closePlayer: () => void
}

const RadioContext = createContext<RadioContextType | undefined>(undefined)

const PLAYBACK_RATES = [1, 1.25, 1.5, 2]

export function RadioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRateIndex, setPlaybackRateIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const playEpisode = useCallback((episode: PodcastEpisode) => {
    setCurrentEpisode(episode)
    setIsVisible(true)

    const audio = audioRef.current
    if (!audio) return

    if (audio.src !== episode.audioUrl) {
      audio.src = episode.audioUrl
      audio.currentTime = 0
    }

    try {
      const playPromise = audio.play()
      if (playPromise !== undefined && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            setIsPlaying(true)
          })
          .catch((err: unknown) => {
            console.warn("Primary audio play rejected:", err)
            // Si la URL directa falla o es bloqueada, intentar URL de respaldo
            if (episode.fallbackAudioUrl && audio.src !== episode.fallbackAudioUrl) {
              console.log("Intentando fallback audio URL:", episode.fallbackAudioUrl)
              audio.src = episode.fallbackAudioUrl
              audio.play().then(() => setIsPlaying(true)).catch((err2) => {
                console.error("Fallback audio play failed:", err2)
                setIsPlaying(false)
              })
            } else {
              setIsPlaying(false)
            }
          })
      } else {
        setIsPlaying(true)
      }
    } catch {
      setIsPlaying(false)
    }
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    if (audioRef.current && currentEpisode) {
      try {
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined && typeof playPromise.then === "function") {
          playPromise.then(() => {
            setIsPlaying(true)
          }).catch(() => {
            setIsPlaying(false)
          })
        } else {
          setIsPlaying(true)
        }
      } catch {
        setIsPlaying(false)
      }
    }
  }, [currentEpisode])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [isPlaying, pause, resume])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const skip = useCallback((seconds: number) => {
    if (audioRef.current) {
      const targetTime = Math.min(
        Math.max(audioRef.current.currentTime + seconds, 0),
        audioRef.current.duration || 999999
      )
      audioRef.current.currentTime = targetTime
      setCurrentTime(targetTime)
    }
  }, [])

  const setRate = useCallback((rate: number) => {
    const idx = PLAYBACK_RATES.indexOf(rate)
    if (idx !== -1) {
      setPlaybackRateIndex(idx)
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const nextMuted = !audioRef.current.muted
      audioRef.current.muted = nextMuted
      setIsMuted(nextMuted)
    }
  }, [])

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
    setIsVisible(false)
    setCurrentEpisode(null)
  }, [])

  // Event handlers de audio
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleAudioError = () => {
    const audio = audioRef.current
    const err = audio?.error
    console.warn("Audio element error:", err?.code, err?.message, "Source:", audio?.src)
    if (currentEpisode?.fallbackAudioUrl && audio && audio.src !== currentEpisode.fallbackAudioUrl) {
      console.log("Recuperando con URL de respaldo:", currentEpisode.fallbackAudioUrl)
      audio.src = currentEpisode.fallbackAudioUrl
      audio.play().then(() => setIsPlaying(true)).catch(console.error)
    } else {
      setIsPlaying(false)
    }
  }

  // Integración con MediaSession API nativa
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentEpisode) return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentEpisode.title,
        artist: "La Veinte Radio · Eduardo Bolaños",
        album: "La Veinte Radio",
        artwork: [
          {
            src: currentEpisode.imageUrl || "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/46879753/46879753-1790947894171-e2a7105671072.jpg",
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      })

      navigator.mediaSession.setActionHandler("play", () => resume())
      navigator.mediaSession.setActionHandler("pause", () => pause())
      navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15))
      navigator.mediaSession.setActionHandler("seekforward", () => skip(15))
    } catch {
      // Ignorar en navegadores sin soporte completo
    }
  }, [currentEpisode, resume, pause, skip])

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused"
    } catch {
      // Fallback
    }
  }, [isPlaying])

  return (
    <RadioContext.Provider
      value={{
        currentEpisode,
        isPlaying,
        currentTime,
        duration,
        playbackRate: PLAYBACK_RATES[playbackRateIndex] || 1,
        isMuted,
        isVisible,
        playEpisode,
        pause,
        resume,
        togglePlay,
        seek,
        skip,
        setRate,
        toggleMute,
        closePlayer,
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="auto"
      />
      {children}
    </RadioContext.Provider>
  )
}

export function useRadio() {
  const context = useContext(RadioContext)
  if (!context) {
    throw new Error("useRadio debe utilizarse dentro de un RadioProvider")
  }
  return context
}
