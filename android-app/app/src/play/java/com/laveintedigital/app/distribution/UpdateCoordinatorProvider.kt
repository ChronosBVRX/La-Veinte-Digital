package com.laveintedigital.app.distribution

/**
 * Play Store build → the self-update pipeline is inert.
 *
 * This object lives ONLY in `src/play`. For `direct` variants, `src/direct` provides a different
 * implementation with the same qualified name, so `main` can reference it without any
 * `if (BuildConfig....)` branching.
 */
object UpdateCoordinatorProvider {
    fun provide(): UpdateCoordinator = PlayUpdateCoordinator()
}
