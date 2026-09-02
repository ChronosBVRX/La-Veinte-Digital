export {}

declare global {
  /**
   * Puente nativo expuesto por la APK de La Veinte Digital a la web vía
   * `window.LaVeinteApp` (JavascriptInterface de Android).
   */
  interface LaVeinteNativeApp {
    __isInjected?: boolean
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
    openBiometrics?(): void
    hasImssCredentials(portalId: string): boolean
    checkForUpdate(): void
    requestCameraPermission(): Promise<{ granted: boolean; permanentlyDenied?: boolean }>
    requestNotificationsPermission(): void
    listNativeDocuments(): Promise<NativeDocumentMeta[]>
    readNativeDocument(localPath: string): Promise<NativeDocumentContent | null>
    deleteNativeDocument(localPath: string): Promise<boolean>
    deleteNativeDocumentById?(documentId: number, expectedLocalPath?: string): Promise<{ ok: boolean; reason?: "not_found" | "invalid_path" | "invalid_id" | "delete_failed" | "bridge_unavailable" }>
    getFcmToken(): Promise<{ token: string }>
    getPendingPrintDoc(): Promise<{ localPath: string } | null>
    clearPendingPrintDoc(): void
    shareNativeDocument?(localPath: string, title?: string): void
    openAppSettings(): void
  }

  interface NativeDocumentMeta {
    id: number
    name: string
    localPath: string
    source: string
    fileSize: number
    downloadedAt: number
    mimeType: string
  }

  interface NativeDocumentContent {
    name: string
    mimeType: string
    data: string
  }

  interface Window {
    LaVeinteApp?: LaVeinteNativeApp
  }
}
