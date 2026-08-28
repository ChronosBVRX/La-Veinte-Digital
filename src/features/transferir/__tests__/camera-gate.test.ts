import { afterEach, describe, expect, it } from "vitest"
import { requestCameraGate } from "../components/camera"

interface FakeLaVeinteApp {
  requestCameraPermission: () => Promise<{ granted: boolean; permanentlyDenied?: boolean }>
}

function withWindow(app: FakeLaVeinteApp | undefined, run: () => Promise<void>) {
  const OriginalWindow = globalThis.window
  const w = OriginalWindow as unknown as Record<string, unknown>
  if (app === undefined) {
    delete (globalThis as Record<string, unknown>).window
  } else {
    ;(globalThis as Record<string, unknown>).window = { LaVeinteApp: app } as unknown as Window
  }
  return run().finally(() => {
    ;(globalThis as Record<string, unknown>).window = w
  })
}

describe("requestCameraGate", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
  })

  it("grants immediately outside the native app", async () => {
    await withWindow(undefined, async () => {
      expect(await requestCameraGate()).toEqual({ granted: true, permanentlyDenied: false, isNative: false })
    })
  })

  it("resolves the native grant result", async () => {
    await withWindow(
      {
        requestCameraPermission: async () => ({ granted: true }),
      },
      async () => {
        expect(await requestCameraGate()).toEqual({ granted: true, permanentlyDenied: false, isNative: true })
      },
    )
  })

  it("reports permanent denial from native", async () => {
    await withWindow(
      {
        requestCameraPermission: async () => ({ granted: false, permanentlyDenied: true }),
      },
      async () => {
        expect(await requestCameraGate()).toEqual({ granted: false, permanentlyDenied: true, isNative: true })
      },
    )
  })

  it("treats a throwing bridge as not granted", async () => {
    await withWindow(
      {
        requestCameraPermission: async () => {
          throw new Error("bridge missing")
        },
      },
      async () => {
        expect(await requestCameraGate()).toEqual({ granted: false, permanentlyDenied: false, isNative: true })
      },
    )
  })
})
