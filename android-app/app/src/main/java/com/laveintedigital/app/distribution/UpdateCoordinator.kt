package com.laveintedigital.app.distribution

import android.content.Context
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow

/**
 * Distribution-channel update policy.
 *
 * The app ships through two independent channels that must never contaminate each other:
 *
 *  - [play] (Play Store): the Google Play policy forbids self-updates installed from outside the
 *    store. This coordinator is a no-op (or a non-invasive "managed by Google Play" message). The
 *    stable/direct updater is NOT compiled into the Play APK and `REQUEST_INSTALL_PACKAGES` is not
 *    present in its merged manifest.
 *  - [direct] (sideload): preserves the full self-update pipeline (remote manifest → SHA-256
 *    verification → download → PackageInstaller) behind `DirectUpdateCoordinator`.
 *
 * The concrete implementation is selected by the build via `UpdateCoordinatorProvider`, which is
 * provided per source set (`src/play`, `src/direct`) so the policy is decided at build time and the
 * rest of the codebase (MainActivity, InternalWebScreen) only talks to this interface.
 */
interface UpdateCoordinator {
    /** Channel name reported to the web/bridge and used as the update channel (direct only). */
    val channel: String

    /** True if this build is allowed to install an APK downloaded from our own manifest. */
    val canSelfUpdate: Boolean

    /** Current update lifecycle state, observed by the UI. Always [UpdateState.Idle] on [play]. */
    val state: StateFlow<UpdateState>

    /** Kicks off an update check when the app boots. */
    fun check(context: Context, scope: CoroutineScope)

    /** Downloads the APK referenced by [manifest], reporting progress through [state]. */
    fun download(context: Context, manifest: UpdateManifest, scope: CoroutineScope)

    /** Installs the already-downloaded, verified APK referenced by [manifest]. */
    fun install(context: Context, manifest: UpdateManifest)

    /** Returns the lifecycle to [UpdateState.Idle] (dismiss, error recovery, after install). */
    fun reset()

    /**
     * Handle the "check for updates" request coming from the web bridge. On [play] this only shows a
     * non-invasive notice; on [direct] it re-runs the whole check flow.
     */
    fun onManualCheckRequested(context: Context, scope: CoroutineScope)
}
