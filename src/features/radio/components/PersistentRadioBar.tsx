"use client"

import dynamic from "next/dynamic"
import { useRadio } from "../context/RadioContext"
import { PersistentMiniPlayer } from "./PersistentMiniPlayer"

const MobileValueBar = dynamic(
  () => import("@/shared/components/app/MobileValueBar").then((m) => m.MobileValueBar),
  { ssr: false },
)

export function PersistentRadioBar() {
  const { currentEpisode, isVisible } = useRadio()

  // Si hay un episodio activo y visible en el reproductor (en cualquier sección incluida /radio),
  // la barra inferior despliega el reproductor persistente estilo Spotify.
  if (currentEpisode && isVisible) {
    return <PersistentMiniPlayer />
  }

  return <MobileValueBar />
}
