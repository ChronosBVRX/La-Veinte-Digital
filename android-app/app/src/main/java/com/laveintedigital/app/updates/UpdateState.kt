package com.laveintedigital.app.updates

/**
 * UI state for the update process.
 */
sealed class UpdateState {
    data object Idle : UpdateState()
    data object Checking : UpdateState()
    data class Available(val manifest: UpdateManifest) : UpdateState()
    data object UpToDate : UpdateState()
    data class Downloading(val progress: Int) : UpdateState() // 0–100
    data object Verifying : UpdateState()
    data class ReadyToInstall(val manifest: UpdateManifest) : UpdateState()
    data class Error(val message: String, val recoverable: Boolean = true) : UpdateState()
}
