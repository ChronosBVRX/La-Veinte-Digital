export {}

declare global {
  /**
   * Puente nativo expuesto por la APK de La Veinte Digital a la web vía
   * `window.LaVeinteApp` (JavascriptInterface de Android).
   */
  interface LaVeinteNativeApp {
    appPlatform(): string
    appVersion(): string
    sdkVersion(): number
    packageName(): string
    isNativeApp(): boolean
    hasBiometrics(): boolean
    isBiometricsEnabled(): boolean
    openExternal(url: string): void
    pickPdf(acceptHint?: string): void
    share(title?: string, text?: string): void
    haptic(): void
    log(message: string): void
    onAuthenticated(): void
    onLoggedOut(): void
    openOfficialPayslips(): void
    hasImssCredentials(portalId: string): boolean
    checkForUpdate(): void
  }

  interface Window {
    LaVeinteApp?: LaVeinteNativeApp
  }
}
