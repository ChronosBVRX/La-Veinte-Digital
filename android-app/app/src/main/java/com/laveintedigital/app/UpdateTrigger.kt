package com.laveintedigital.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Simple trigger that the web bridge can fire to request an update check.
 * MainActivity observes this and delegates to the build-selected
 * `UpdateCoordinatorProvider` (Play = no-op, Direct = full self-update check).
 */
object UpdateTrigger {
    private val _pending = MutableStateFlow(false)
    val pending: StateFlow<Boolean> = _pending.asStateFlow()

    fun request() { _pending.value = true }
    fun consume() { _pending.value = false }
}
