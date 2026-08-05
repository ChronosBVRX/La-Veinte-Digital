// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormField } from "../FormField"

describe("FormField", () => {
  it("renders label text", () => {
    render(
      <FormField label="Nombre" htmlFor="name">
        <input id="name" />
      </FormField>,
    )
    expect(screen.getByText("Nombre")).toBeTruthy()
  })

  it("associates label with input via htmlFor", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    )
    const label = screen.getByText("Email")
    expect(label.tagName).toBe("LABEL")
    expect(label.getAttribute("for")).toBe("email")
  })

  it("renders hint text when provided", () => {
    render(
      <FormField label="Nombre" htmlFor="name" hint="Ingresa tu nombre completo">
        <input id="name" />
      </FormField>,
    )
    expect(screen.getByText("Ingresa tu nombre completo")).toBeTruthy()
  })

  it("renders error text when provided", () => {
    render(
      <FormField
        label="Nombre"
        htmlFor="name"
        error="Este campo es obligatorio"
      >
        <input id="name" />
      </FormField>,
    )
    expect(screen.getByText("Este campo es obligatorio")).toBeTruthy()
  })

  it("error shows instead of hint when both provided", () => {
    render(
      <FormField
        label="Nombre"
        htmlFor="name"
        hint="Consejo útil"
        error="Error real"
      >
        <input id="name" />
      </FormField>,
    )
    expect(screen.getByText("Error real")).toBeTruthy()
    expect(screen.queryByText("Consejo útil")).toBeNull()
  })

  it("shows required indicator when required=true", () => {
    render(
      <FormField label="Nombre" htmlFor="name" required>
        <input id="name" />
      </FormField>,
    )
    expect(screen.getByText("Obligatorio")).toBeTruthy()
    expect(screen.getByTitle("Obligatorio")).toBeTruthy()
  })

  it("error paragraph has role=alert and an id", () => {
    render(
      <FormField label="Nombre" htmlFor="name" error="Error">
        <input id="name" />
      </FormField>,
    )
    const error = screen.getByRole("alert")
    expect(error).toBeTruthy()
    expect(error.getAttribute("id")).toBeTruthy()
  })

  it("hint paragraph has an id for aria-describedby wiring", () => {
    render(
      <FormField label="Nombre" htmlFor="name" hint="Ayuda">
        <input id="name" />
      </FormField>,
    )
    const hint = screen.getByText("Ayuda")
    expect(hint.getAttribute("id")).toBeTruthy()
  })

  it("does not render error when only hint is provided", () => {
    render(
      <FormField label="Nombre" htmlFor="name" hint="Consejo">
        <input id="name" />
      </FormField>,
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
