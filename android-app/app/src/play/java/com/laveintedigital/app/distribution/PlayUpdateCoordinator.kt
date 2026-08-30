package com.laveintedigital.app.distribution

import android.content.Context
import android.widget.Toast
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Play Store policy: the app is updated exclusively by Google Play. There is no self-update
 * pipeline, no `REQUEST_INSTALL_PACKAGES` permission and no installer activity. The update
 * lifecycle never leaves [UpdateState.Idle], so the release/pending dialogs never render.
 *
 * The web's "check for updates" trigger is answered with a single, non-invasive toast so the user
 * understands where updates come from; if it adds no value we could suppress it entirely, but a
 * one-line explanation avoids the web UI feeling broken.
 */
class PlayUpdateCoordinator : UpdateCoordinator {

    override val channel: String = "play"
    override val canSelfUpdate: Boolean = false

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    override val state: StateFlow<UpdateState> = _state.asStateFlow()

    override fun check(context: Context, scope: CoroutineScope) = Unit

    override fun download(context: Context, manifest: UpdateManifest, scope: CoroutineScope) = Unit

    override fun install(context: Context, manifest: UpdateManifest) = Unit

    override fun reset() {
        _state.value = UpdateState.Idle
    }

    override fun onManualCheckRequested(context: Context, scope: CoroutineScope) {
        Toast.makeText(
            context,
            "Las actualizaciones se administran mediante Google Play.",
            Toast.LENGTH_SHORT,
        ).show()
    }
}
