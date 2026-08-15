package com.laveintedigital.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Tracks real startup progress so the bootloader animation reflects actual work.
 *
 * Stages advance as the app initializes. The bootloader observes [state]
 * and renders the appropriate message + progress bar.
 */
enum class StartupStage(val progress: Float, val message: String) {
    INITIALIZING(0.10f, "Iniciando La Veinte Digital"),
    UPDATE_CHECK(0.30f, "Buscando actualizaciones"),
    PREPARING_WEBVIEW(0.55f, "Preparando aplicación"),
    RESTORING_SESSION(0.70f, "Restaurando sesión"),
    SECURITY(0.90f, "Verificando acceso"),
    READY(1.00f, "Listo"),
}

object StartupCoordinator {

    private val _state = MutableStateFlow(StartupStage.INITIALIZING)
    val state: StateFlow<StartupStage> = _state.asStateFlow()

    fun advanceTo(stage: StartupStage) {
        _state.value = stage
    }

    fun ready() {
        _state.value = StartupStage.READY
    }

    fun isReady(): Boolean = _state.value == StartupStage.READY
}
