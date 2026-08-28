import { describe, expect, it } from "vitest"
import { extractTransferToken, extractUploadUrl } from "../lib/transfer"

const TOKEN = "0123456789abcdef"

describe("extractTransferToken", () => {
  it("accepts an official host with a valid token", () => {
    expect(extractTransferToken(`https://la-veinte-digital.vercel.app/transfer?t=${TOKEN}`)).toBe(TOKEN)
  })

  it("accepts the production domain and its www alias", () => {
    expect(extractTransferToken(`https://la20.com.mx/transfer?t=${TOKEN}`)).toBe(TOKEN)
    expect(extractTransferToken(`https://www.la20.com.mx/transfer?t=${TOKEN}`)).toBe(TOKEN)
  })

  it("rejects arbitrary/forged hosts", () => {
    expect(extractTransferToken(`https://evil.example.com/transfer?t=${TOKEN}`)).toBeNull()
    expect(extractTransferToken(`https://la-veinte-digital.vercel.app.evil.com/transfer?t=${TOKEN}`)).toBeNull()
  })

  it("rejects missing token or wrong path", () => {
    expect(extractTransferToken("https://la-veinte-digital.vercel.app/transfer")).toBeNull()
    expect(extractTransferToken("https://la-veinte-digital.vercel.app/other?t=abc")).toBeNull()
  })

  it("rejects non-URL input", () => {
    expect(extractTransferToken("not a url")).toBeNull()
    expect(extractTransferToken("")).toBeNull()
  })
})

describe("extractUploadUrl", () => {
  it("returns the canonical transfer URL for an official host", () => {
    expect(extractUploadUrl(`https://la20.com.mx/transfer?t=${TOKEN}`)).toBe(
      `https://la20.com.mx/transfer?t=${TOKEN}`,
    )
  })

  it("rejects arbitrary hosts", () => {
    expect(extractUploadUrl(`https://evil.example.com/transfer?t=${TOKEN}`)).toBeNull()
  })
})
