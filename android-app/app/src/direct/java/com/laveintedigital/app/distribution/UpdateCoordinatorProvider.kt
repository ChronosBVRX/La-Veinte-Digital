package com.laveintedigital.app.distribution

/**
 * Direct (sideload) build → the full self-update pipeline is active.
 *
 * This object lives ONLY in `src/direct`. For `play` variants, `src/play` provides a different
 * implementation with the same qualified name, so `main` can reference it without any
 * `if (BuildConfig....)` branching.
 */
object UpdateCoordinatorProvider {
    fun provide(): UpdateCoordinator = DirectUpdateCoordinator()
}
