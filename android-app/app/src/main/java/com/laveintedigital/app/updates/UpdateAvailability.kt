package com.laveintedigital.app.updates

/**
 * Regla canónica de actualización (fuente única):
 *
 * Solo `versionCode` ordena las versiones — NUNCA `versionName`.
 * Cada APK instalable entrega un `versionCode` nuevo y creciente
 * (1.1.3 → 203, 1.1.4 → 204, ...).
 */
fun isUpdateAvailable(latestVersionCode: Int, installedVersionCode: Int): Boolean =
    latestVersionCode > installedVersionCode
