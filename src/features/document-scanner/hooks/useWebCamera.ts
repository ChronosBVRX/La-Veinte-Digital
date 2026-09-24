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

export type CameraCaptureResult =
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; error: string }

export interface UseWebCameraResult {
  status: WebCameraStatus
  error: string | null
  permanentlyDenied: boolean
  /** Callback ref para montar el <video> (evita exponer un RefObject). */
  attachVideo: (element: HTMLVideoElement | null) => void
  start: () => Promise<boolean>
  stop: () => void
  capture: () => Promise<CameraCaptureResult>
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 4000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
      resolve(true)
      return
    }

    let resolved = false
    const check = () => {
      if (resolved) return
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        cleanup()
        resolved = true
        resolve(true)
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      if (!resolved) {
        resolved = true
        resolve(video.videoWidth > 0 && video.videoHeight > 0)
      }
    }, timeoutMs)

    const interval = setInterval(check, 80)

    const cleanup = () => {
      clearTimeout(timer)
      clearInterval(interval)
      video.removeEventListener("loadedmetadata", check)
      video.removeEventListener("canplay", check)
      video.removeEventListener("playing", check)
    }

    video.addEventListener("loadedmetadata", check)
    video.addEventListener("canplay", check)
    video.addEventListener("playing", check)
  })
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
      element
        .play()
        .then(() => {
          void waitForVideoReady(element, 3000).then((ready) => {
            if (ready) setStatus("ready")
          })
        })
        .catch(() => {})
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
        await waitForVideoReady(video, 3000)
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

  const capture = useCallback(async (): Promise<CameraCaptureResult> => {
    const video = videoElementRef.current
    if (!video) {
      return {
        ok: false,
        error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
      }
    }

    // Si aún no existen dimensiones o el frame no está decodificado, esperar brevemente y reintentar
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      const becameReady = await waitForVideoReady(video, 800)
      if (!becameReady || !video.videoWidth || !video.videoHeight) {
        return {
          ok: false,
          error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
        }
      }
    }

    let canvas: HTMLCanvasElement
    try {
      canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    } catch {
      return {
        ok: false,
        error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
      }
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return {
        ok: false,
        error: "No pudimos inicializar el procesador de imagen en este dispositivo.",
      }
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch {
      return {
        ok: false,
        error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
      }
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 3000)
      canvas.toBlob(
        (b) => {
          clearTimeout(timeout)
          resolve(b)
        },
        "image/jpeg",
        0.92
      )
    })

    if (!blob) {
      return {
        ok: false,
        error: "No pudimos obtener la foto. Mantén la cámara abierta e inténtalo nuevamente.",
      }
    }

    return { ok: true, blob, width: canvas.width, height: canvas.height }
  }, [])

  return { status, error, permanentlyDenied, attachVideo, start, stop, capture }
}
