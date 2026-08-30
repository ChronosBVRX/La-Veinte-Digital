package com.laveintedigital.app

import android.content.Context
import com.laveintedigital.app.updates.ApkInfo
import com.laveintedigital.app.updates.ApkInstaller
import com.laveintedigital.app.updates.ApkVerifier
import com.laveintedigital.app.updates.NoUpdateAvailableException
import com.laveintedigital.app.updates.UpdateCache
import com.laveintedigital.app.updates.UpdateDownloader
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateRepository
import com.laveintedigital.app.updates.UpdateState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Coordinator for the update lifecycle.
 *
 * Usage:
 *   val manager = UpdateManager("stable")
 *   manager.state.collect { ... }
 *   manager.check(context)
 */
class UpdateManager(private val channel: String = "stable") {

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    fun check(context: Context, scope: CoroutineScope) {
        if (_state.value !is UpdateState.Idle) return
        _state.value = UpdateState.Checking
        scope.launch {
            val result = UpdateRepository.fetch(context, channel)
            _state.value = result.fold(
                onSuccess = { manifest ->
                    UpdateCache.save(context, manifest)
                    val currentCode = context.packageManager
                        .getPackageInfo(context.packageName, 0)
                        .versionCode
                    if (manifest.minimumVersionCode > currentCode) {
                        UpdateState.Available(manifest.copy(forceUpdate = true))
                    } else {
                        UpdateState.Available(manifest)
                    }
                },
                onFailure = { e ->
                    if (e is NoUpdateAvailableException) {
                        UpdateCache.save(context, e.manifest)
                        UpdateState.UpToDate
                    } else {
                        // Network/server error — use cached state as fallback
                        val cached = UpdateCache.read(context)
                        if (cached != null && cached.forceUpdate) {
                            val currentCode = context.packageManager
                                .getPackageInfo(context.packageName, 0)
                                .versionCode
                            if (cached.latestVersionCode > currentCode) {
                                UpdateState.Available(
                                    UpdateManifest(
                                        channel = channel,
                                        versionCode = cached.latestVersionCode,
                                        versionName = "?",
                                        minimumVersionCode = cached.minimumVersionCode,
                                        forceUpdate = true,
                                        publishedAt = "",
                                        apk = ApkInfo("", "", 0),
                                        releaseNotes = emptyList(),
                                    )
                                )
                            } else {
                                UpdateState.Error(
                                    "No se pudo verificar actualizaciones.",
                                    recoverable = true,
                                )
                            }
                        } else {
                            UpdateState.Error(
                                "No se pudo verificar actualizaciones. Puedes continuar.",
                                recoverable = true,
                            )
                        }
                    }
                },
            )
        }
    }

    fun download(context: Context, manifest: UpdateManifest, scope: CoroutineScope) {
        _state.value = UpdateState.Downloading(0)
        scope.launch {
            val result = UpdateDownloader.download(context, manifest) { progress ->
                _state.value = UpdateState.Downloading(progress)
            }
            result.fold(
                onSuccess = { file ->
                    _state.value = UpdateState.Verifying
                    val valid = ApkVerifier.verify(file, manifest.apk.sha256)
                    if (valid || manifest.apk.sha256.isBlank()) {
                        _state.value = UpdateState.ReadyToInstall(manifest)
                    } else {
                        file.delete()
                        _state.value = UpdateState.Error("Verificación de seguridad falló", recoverable = true)
                    }
                },
                onFailure = { e ->
                    _state.value = UpdateState.Error(
                        e.message ?: "Error de red al descargar", recoverable = true
                    )
                },
            )
        }
    }

    fun install(context: Context, manifest: UpdateManifest) {
        val file = java.io.File(context.filesDir, "updates/LaVeinteDigital-${manifest.versionName}.apk")
        android.util.Log.d("UpdateManager", "Install: ${file.absolutePath} exists=${file.exists()} size=${file.length()}")
        val success = ApkInstaller.install(context, file, manifest)
        if (!success) {
            _state.value = UpdateState.Error("No se pudo instalar la actualización", recoverable = true)
        }
    }

    fun reset() {
        _state.value = UpdateState.Idle
    }
}
