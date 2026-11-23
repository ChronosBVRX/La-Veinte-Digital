// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RadioProvider, useRadio } from "../context/RadioContext"
import { PersistentRadioBar } from "../components/PersistentRadioBar"
import type { PodcastEpisode } from "../types"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

const mockEpisode: PodcastEpisode = {
  id: "test-ep-1",
  title: "Ep. 6 | ¿Cuántos Pacientes Me Tocan?",
  description: "Descripción de prueba",
  cleanDescription: "Descripción limpia",
  pubDate: "Thu, 19 Nov 2026 02:04:20 GMT",
  formattedDate: "19 nov 2026",
  audioUrl: "https://example.com/audio.mp3",
  duration: "09:04",
}

function TestPlayerTrigger() {
  const { playEpisode } = useRadio()
  return (
    <button onClick={() => playEpisode(mockEpisode)}>
      Iniciar Reproducción
    </button>
  )
}

describe("PersistentRadioBar and RadioContext", () => {
  it("muestra la barra de sugerencias por defecto cuando no hay audio activo", async () => {
    render(
      <RadioProvider>
        <PersistentRadioBar />
      </RadioProvider>
    )

    // Al no haber episodio activo, se presenta la barra informativa habitual
    expect(await screen.findByLabelText("Consejo de La Veinte Digital")).toBeDefined()
  })

  it("reemplaza la barra por el mini reproductor cuando se activa un episodio", async () => {
    render(
      <RadioProvider>
        <TestPlayerTrigger />
        <PersistentRadioBar />
      </RadioProvider>
    )

    fireEvent.click(screen.getByText("Iniciar Reproducción"))

    // La barra ahora es el mini reproductor
    const player = await screen.findByLabelText("Reproductor persistente de La Veinte Radio")
    expect(player).toBeDefined()
    expect(screen.getByText("Ep. 6 | ¿Cuántos Pacientes Me Tocan?")).toBeDefined()
    expect(screen.getByLabelText("Pausar episodio")).toBeDefined()
    expect(screen.getByLabelText("Retroceder 15 segundos")).toBeDefined()
    expect(screen.getByLabelText("Adelantar 15 segundos")).toBeDefined()

    // Al pulsar cerrar (X), se detiene y regresa a la barra habitual
    fireEvent.click(screen.getByLabelText("Cerrar reproductor"))
    expect(screen.queryByLabelText("Reproductor persistente de La Veinte Radio")).toBeNull()
  })
})
