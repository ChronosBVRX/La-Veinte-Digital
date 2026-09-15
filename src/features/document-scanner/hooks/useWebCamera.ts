"use client"

/**
 * Cámara web para captura de documentos (getUserMedia) con manejo explícito de
 * permisos en el shell Android (bridge `requestCameraPermission`).
 *
 * Se usa únicamente como fallback cuando el motor nativo ML Kit no está
 * disponible. La captura es local: el fotograma nunca sale del dispositivo.
 *
 * La Veinte Digital
 */

import { useCallback, useEffect, useRef, useState } from "react"

export type WebCameraStatus = "idle" | "requesting" | "ready" | "denied" | "error"

export interface UseWebCameraResult {
  status: WebCameraStatus
  error: string | null
  permanentlyDenied: boolean
  /** Callback ref para montar el <video> (evita exponer un RefObject). */
  attachVideo: (element: HTMLVideoElement | null) => void
  start: () => Promise<boolean>
  stop: () => void
  capture: () => Promise<Blob | null>
}

export function useWebCamera(): UseWebCameraResult {
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<WebCameraStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)

  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element
    if (element && streamRef.current) {
      element.srcObject = streamRef.current
      element.setAttribute("playsinline", "true")
      void element.play().catch(() => {})
    }
  }, [])

  const stop = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop()
        } catch {
          // ignore
        }
      }
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null
    }
    setStatus("idle")
  }, [])

  useEffect(() => {
    return () => {
      const stream = streamRef.current
      streamRef.current = null
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop()
          } catch {
            // ignore
          }
        }
      }
    }
  }, [])

  const requestNativePermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return true
    if (!window.LaVeinteApp?.isNativeApp?.()) return true
    if (typeof window.LaVeinteApp.requestCameraPermission !== "function") return true
    try {
      const result = await window.LaVeinteApp.requestCameraPermission()
      if (result?.permanentlyDenied) setPermanentlyDenied(true)
      return Boolean(result?.granted)
    } catch {
      return false
    }
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    setStatus("requesting")

    const nativeGranted = await requestNativePermission()
    if (!nativeGranted) {
      setStatus("denied")
      setError("Necesitamos permiso para usar la cámara y digitalizar el documento.")
      return false
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error")
      setError("Este dispositivo no permite abrir la cámara desde el navegador. Puedes elegir una foto de tu galería.")
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoElementRef.current
      if (video) {
        video.srcObject = stream
        video.setAttribute("playsinline", "true")
        try {
          await video.play()
        } catch {
          // Algunos WebViews requieren interacción previa; el usuario puede reintentar.
        }
      }
      setStatus("ready")
      return true
    } catch (cameraError) {
      const name = cameraError instanceof Error ? cameraError.name : ""
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied")
        setError("Autoriza el acceso a la cámara o elige una foto de tu galería.")
      } else {
        setStatus("error")
        setError(cameraError instanceof Error ? cameraError.message : "No se pudo iniciar la cámara.")
      }
      return false
    }
  }, [requestNativePermission])

  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoElementRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92)
    })
  }, [])

  return { status, error, permanentlyDenied, attachVideo, start, stop, capture }
}
