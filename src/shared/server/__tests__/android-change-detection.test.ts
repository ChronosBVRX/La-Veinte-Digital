import { describe, it, expect } from "vitest"
import { doesAffectAndroid } from "../../../../scripts/check-android-changes"

describe("Android Change Detection (Multi-Commit PR & Paths)", () => {
  it("Case A: Multi-commit PR containing an android-app file and README.md triggers Android", () => {
    const multiCommitChanges = [
      "android-app/app/src/main/java/com/laveintedigital/app/MainActivity.kt",
      "README.md",
      "docs/CHANGELOG.md",
    ]
    expect(doesAffectAndroid(multiCommitChanges)).toBe(true)
  })

  it("Case B: Multi-commit PR containing only docs and unrelated web features does NOT trigger Android", () => {
    const webOnlyChanges = [
      "README.md",
      "src/app/(dashboard)/acerca-de/page.tsx",
      "src/features/asistente/components/ChatBox.tsx",
      "docs/CONTRIBUTING.md",
    ]
    expect(doesAffectAndroid(webOnlyChanges)).toBe(false)
  })

  it("Case C: Shared contracts change triggers Android", () => {
    const contractChanges = [
      "src/shared/contracts/tarjeton-import.ts",
    ]
    expect(doesAffectAndroid(contractChanges)).toBe(true)
  })

  it("Case D: Push feature contract change triggers Android", () => {
    const pushChanges = [
      "src/features/push/services/push-sender.ts",
    ]
    expect(doesAffectAndroid(pushChanges)).toBe(true)
  })

  it("Case E: Android App Links domain verification change triggers Android", () => {
    const appLinkChanges = [
      "public/.well-known/assetlinks.json",
    ]
    expect(doesAffectAndroid(appLinkChanges)).toBe(true)
  })

  it("Case F: Proxy routing change triggers Android", () => {
    const proxyChanges = [
      "src/proxy.ts",
    ]
    expect(doesAffectAndroid(proxyChanges)).toBe(true)
  })
})
