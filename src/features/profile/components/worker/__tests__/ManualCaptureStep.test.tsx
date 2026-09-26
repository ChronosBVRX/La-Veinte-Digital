// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ManualCaptureStep } from "../ManualCaptureStep"
import type { WorkerProfileDraft } from "@/shared/domain/worker"

describe("ManualCaptureStep", () => {
  const emptyDraft: WorkerProfileDraft = {
    mode: "manual",
    identity: {},
    situation: {},
    confirmedFields: [],
  }

  it("renderiza campos para matrícula y adscripción", () => {
    const onChange = vi.fn()
    const onContinue = vi.fn()
    const onBack = vi.fn()

    render(
      <ManualCaptureStep
        draft={emptyDraft}
        onChange={onChange}
        onContinue={onContinue}
        onBack={onBack}
      />
    )

    expect(screen.getByText("Datos mínimos del trabajador")).toBeTruthy()
    expect(screen.getByPlaceholderText("Ej: 12345678")).toBeTruthy()
    expect(screen.getByPlaceholderText("Ej: HGZ 32, UMF 1, etc.")).toBeTruthy()
  })

  it("deshabilita el botón Continuar si no se ha ingresado ningún dato", () => {
    render(
      <ManualCaptureStep
        draft={emptyDraft}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const continueBtn = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement
    expect(continueBtn.disabled).toBe(true)
  })

  it("habilita el botón Continuar cuando se ingresa la matrícula", () => {
    const draftWithMatricula: WorkerProfileDraft = {
      ...emptyDraft,
      identity: { matricula: "12345678" },
    }

    render(
      <ManualCaptureStep
        draft={draftWithMatricula}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const continueBtn = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement
    expect(continueBtn.disabled).toBe(false)
  })

  it("habilita el botón Continuar cuando se ingresa la adscripción", () => {
    const draftWithAdscripcion: WorkerProfileDraft = {
      ...emptyDraft,
      identity: { adscripcion: "HGZ 32" },
    }

    render(
      <ManualCaptureStep
        draft={draftWithAdscripcion}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const continueBtn = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement
    expect(continueBtn.disabled).toBe(false)
  })

  it("llama a onChange al capturar matrícula", () => {
    const onChange = vi.fn()

    render(
      <ManualCaptureStep
        draft={emptyDraft}
        onChange={onChange}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const matriculaInput = screen.getByPlaceholderText("Ej: 12345678")
    fireEvent.change(matriculaInput, { target: { value: "98765432" } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updatedDraft = onChange.mock.calls[0][0] as WorkerProfileDraft
    expect(updatedDraft.identity.matricula).toBe("98765432")
    expect(updatedDraft.confirmedFields).toContain("matricula")
  })
})
