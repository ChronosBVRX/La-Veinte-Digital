"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useRadio } from "../context/RadioContext"
import { PersistentMiniPlayer } from "./PersistentMiniPlayer"

const MobileValueBar = dynamic(
  () => import("@/shared/components/app/MobileValueBar").then((m) => m.MobileValueBar),
  { ssr: false },
)

export function PersistentRadioBar() {
  const pathname = usePathname()
  const { currentEpisode, isVisible } = useRadio()

  // Si hay un episodio activo y visible, y no estamos en /radio (donde ya está el reproductor completo),
  // la barra de sugerencias inferior es reemplazada por el mini reproductor persistente.
  if (currentEpisode && isVisible && pathname !== "/radio") {
    return <PersistentMiniPlayer />
  }

  return <MobileValueBar />
}
