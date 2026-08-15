package com.laveintedigital.app.security

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class LockState { LOCKED, UNLOCKING, UNLOCKED }

object AppLockManager {

    private val _state = MutableStateFlow(LockState.UNLOCKED)
    val state: StateFlow<LockState> = _state.asStateFlow()

    var pendingDeepLink: String? = null
    var isBiometricEnabled: Boolean = false

    private var lastUnlockTime: Long = System.currentTimeMillis()

    fun lock() {
        _state.value = LockState.LOCKED
    }

    fun startUnlock() {
        _state.value = LockState.UNLOCKING
    }

    fun unlock() {
        lastUnlockTime = System.currentTimeMillis()
        _state.value = LockState.UNLOCKED
    }

    /**
     * Called periodically while the app is in foreground.
     * Re-locks if [timeoutMs] has elapsed since last unlock.
     */
    fun tickForeground(timeoutMs: Long = AUTO_LOCK_TIMEOUT_MS) {
        if (!isBiometricEnabled) return
        if (_state.value != LockState.UNLOCKED) return
        val elapsed = System.currentTimeMillis() - lastUnlockTime
        if (elapsed >= timeoutMs) {
            lock()
        }
    }

    /**
     * Called when returning from background.
     * Returns true if lock should be triggered due to elapsed time.
     */
    fun shouldLockOnReturn(backgroundDurationMs: Long): Boolean {
        if (!isBiometricEnabled) return false
        if (_state.value != LockState.UNLOCKED) return false
        val elapsed = System.currentTimeMillis() - lastUnlockTime
        return elapsed >= AUTO_LOCK_TIMEOUT_MS
    }

    fun isLocked(): Boolean = _state.value == LockState.LOCKED
    fun isUnlocking(): Boolean = _state.value == LockState.UNLOCKING
    fun isUnlocked(): Boolean = _state.value == LockState.UNLOCKED

    private const val AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes
}
