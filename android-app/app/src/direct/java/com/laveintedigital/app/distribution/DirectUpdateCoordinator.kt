package com.laveintedigital.app.distribution

import android.content.Context
import android.widget.Toast
import com.laveintedigital.app.UpdateManager
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow

/**
 * Direct (sideload) distribution channel — keeps the full self-update pipeline intact:
 * remote manifest → SHA-256 verification → download → PackageInstaller, plus forced updates and the
 * stable channel. This is the ONLY channel that may request `REQUEST_INSTALL_PACKAGES` and register
 * `UpdateInstallReceiver`; it lives entirely in `src/direct` so it is absent from the Play APK.
 */
class DirectUpdateCoordinator(
    updateChannel: String = "stable",
    private val manager: UpdateManager = UpdateManager(updateChannel),
) : UpdateCoordinator {

    override val channel: String = updateChannel

    override val canSelfUpdate: Boolean = true

    override val state: StateFlow<UpdateState> = manager.state

    override fun check(context: Context, scope: CoroutineScope) {
        manager.check(context, scope)
    }

    override fun download(context: Context, manifest: UpdateManifest, scope: CoroutineScope) {
        manager.download(context, manifest, scope)
    }

    override fun install(context: Context, manifest: UpdateManifest) {
        manager.install(context, manifest)
    }

    override fun reset() {
        manager.reset()
    }

    override fun onManualCheckRequested(context: Context, scope: CoroutineScope) {
        Toast.makeText(context, "Buscando actualización...", Toast.LENGTH_SHORT).show()
        manager.reset()
        manager.check(context, scope)
    }
}
