// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FloatingChatProvider, useFloatingChat } from "../context/FloatingChatContext"
import { FloatingChatWidget } from "../components/FloatingChatWidget"

// Mock de ChatAssistant para aislar el test del widget contenedor
vi.mock("../components/ChatAssistant", () => ({
  ChatAssistant: ({ showHeader }: { showHeader?: boolean }) => (
    <div data-testid="chat-assistant-body" data-show-header={String(showHeader)}>
      Chat Assistant Content
    </div>
  ),
}))

function TestController() {
  const { openChat, closeChat, minimizeChat, isOpen, isMinimized } = useFloatingChat()
  return (
    <div>
      <button onClick={openChat}>Abrir Externo</button>
      <button onClick={closeChat}>Cerrar Externo</button>
      <button onClick={minimizeChat}>Minimizar Externo</button>
      <span data-testid="state-status">{isOpen ? (isMinimized ? "minimized" : "open") : "closed"}</span>
    </div>
  )
}

describe("FloatingChatWidget y FloatingChatContext", () => {
  it("inicia cerrado mostrando el FAB flotante", () => {
    render(
      <FloatingChatProvider>
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    const fab = screen.getByLabelText("Abrir asistente de derechos")
    expect(fab).toBeTruthy()
    expect(screen.getByText("Pregunta por tus derechos")).toBeTruthy()
    expect(screen.queryByTestId("chat-assistant-body")).toBeNull()
  })

  it("al hacer clic en el FAB se expande la ventana flotante de chat", () => {
    render(
      <FloatingChatProvider>
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    const fab = screen.getByLabelText("Abrir asistente de derechos")
    fireEvent.click(fab)

    expect(screen.getByText("Asistente laboral")).toBeTruthy()
    expect(screen.getByTestId("chat-assistant-body")).toBeTruthy()
    expect(screen.getByLabelText("Minimizar chat")).toBeTruthy()
    expect(screen.getByLabelText("Cerrar chat")).toBeTruthy()
  })

  it("al hacer clic en minimizar, colapsa a la pastilla compacta", () => {
    render(
      <FloatingChatProvider>
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    // Abrir primero
    fireEvent.click(screen.getByLabelText("Abrir asistente de derechos"))
    expect(screen.getByTestId("chat-assistant-body")).toBeTruthy()

    // Minimizar
    fireEvent.click(screen.getByLabelText("Minimizar chat"))

    // Ahora no debe mostrar el cuerpo completo sino la pastilla compacta
    expect(screen.queryByTestId("chat-assistant-body")).toBeNull()
    expect(screen.getByLabelText("Restaurar chat")).toBeTruthy()
    expect(screen.getByLabelText("Cerrar chat")).toBeTruthy()
  })

  it("al restaurar desde la pastilla compacta vuelve a abrir la ventana completa", () => {
    render(
      <FloatingChatProvider>
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    fireEvent.click(screen.getByLabelText("Abrir asistente de derechos"))
    fireEvent.click(screen.getByLabelText("Minimizar chat"))

    // Restaurar
    fireEvent.click(screen.getByLabelText("Restaurar chat"))
    expect(screen.getByTestId("chat-assistant-body")).toBeTruthy()
  })

  it("al cerrar vuelve al botón flotante", () => {
    render(
      <FloatingChatProvider>
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    fireEvent.click(screen.getByLabelText("Abrir asistente de derechos"))
    expect(screen.getByTestId("chat-assistant-body")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Cerrar chat"))
    expect(screen.queryByTestId("chat-assistant-body")).toBeNull()
    expect(screen.getByLabelText("Abrir asistente de derechos")).toBeTruthy()
  })

  it("los controladores externos del contexto pueden manipular el chat", () => {
    render(
      <FloatingChatProvider>
        <TestController />
        <FloatingChatWidget />
      </FloatingChatProvider>
    )

    expect(screen.getByTestId("state-status").textContent).toBe("closed")

    fireEvent.click(screen.getByText("Abrir Externo"))
    expect(screen.getByTestId("state-status").textContent).toBe("open")
    expect(screen.getByTestId("chat-assistant-body")).toBeTruthy()

    fireEvent.click(screen.getByText("Minimizar Externo"))
    expect(screen.getByTestId("state-status").textContent).toBe("minimized")

    fireEvent.click(screen.getByText("Cerrar Externo"))
    expect(screen.getByTestId("state-status").textContent).toBe("closed")
  })
})
