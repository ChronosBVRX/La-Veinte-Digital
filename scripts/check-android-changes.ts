/**
 * Android Change Detection — La Veinte Digital
 *
 * Determina si un conjunto de archivos modificados (entre base SHA y head SHA)
 * afecta a la aplicación nativa Android, sus contratos de datos compartidos,
 * el proxy WebView, la configuración de push o los App Links.
 */

export const ANDROID_TRIGGER_PREFIXES = [
  "android-app/",
  "src/shared/contracts/",
  "src/features/push/",
  "src/proxy.ts",
  "public/.well-known/assetlinks.json",
  "public/android/",
  "scripts/upload-android-release.mjs",
  "scripts/android-release-auto.sh",
]

export function doesAffectAndroid(changedFiles: string[]): boolean {
  return changedFiles.some((file) =>
    ANDROID_TRIGGER_PREFIXES.some((prefix) =>
      prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix
    )
  )
}
