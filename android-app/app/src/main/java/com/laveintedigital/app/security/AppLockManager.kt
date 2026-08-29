package com.laveintedigital.app.security

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * App lock lifecycle.
 *
 * States:
 *  - [LockState.INITIALIZING]   resolving whether biometric lock applies (never show private UI).
 *  - [LockState.LOCKED]         private content must not be visible/mounted.
 *  - [LockState.AUTHENTICATING] BiometricPrompt in flight.
 *  - [LockState.UNLOCKED]       the only state in which private content is shown.
 *
 * Security rules (no fail-open):
 *   error  → LOCKED
 *   cancel → LOCKED
 *   failure → LOCKED
 *   exception → LOCKED
 *   Only [BiometricPrompt.onAuthenticationSucceeded] moves to UNLOCKED.
 */
enum class LockState { INITIALIZING, LOCKED, AUTHENTICATING, UNLOCKED }

object AppLockManager {

    private val _state = MutableStateFlow(LockState.INITIALIZING)
    val state: StateFlow<LockState> = _state.asStateFlow()

    /** Deep link that arrived while locked; executed only after a successful unlock. */
    var pendingDeepLink: String? = null

    var isBiometricEnabled: Boolean = false
        private set

    private var backgroundAtMs: Long = 0L

    /**
     * Called once on cold start with whether biometric lock is enabled.
     * Cold start is ALWAYS a new lock: a fresh process must authenticate even if it was
     * killed only seconds ago (no 5-minute grace on a cold start).
     */
    fun init(enabled: Boolean) {
        isBiometricEnabled = enabled
        _state.value = if (enabled) LockState.LOCKED else LockState.UNLOCKED
        Log.d("APP_LOCK", "APP_LOCK initializing biometric_enabled=$enabled -> ${_state.value}")
    }

    fun lock() {
        _state.value = LockState.LOCKED
        Log.d("APP_LOCK", "APP_LOCK locked")
    }

    fun startAuthentication() {
        _state.value = LockState.AUTHENTICATING
        Log.d("APP_LOCK", "APP_LOCK authenticate_started")
    }

    fun unlock() {
        _state.value = LockState.UNLOCKED
        Log.d("APP_LOCK", "APP_LOCK unlocked")
    }

    /** App moved to background: remember the moment. Time in foreground never counts. */
    fun onAppBackground() {
        backgroundAtMs = System.currentTimeMillis()
        Log.d("APP_LOCK", "APP_LOCK background_timestamp=$backgroundAtMs")
    }

    /**
     * App returned to foreground. Returns true if it should re-lock because the app was in the
     * background for [timeoutMs] or more. Cold start is handled by [init], not here.
     */
    fun onAppForeground(timeoutMs: Long = AUTO_LOCK_TIMEOUT_MS): Boolean {
        if (!isBiometricEnabled) return _state.value != LockState.UNLOCKED
        if (_state.value != LockState.UNLOCKED) return true
        val backgroundDurationMs = System.currentTimeMillis() - backgroundAtMs
        if (backgroundDurationMs >= timeoutMs) {
            lock()
            Log.d("APP_LOCK", "APP_LOCK relock_after_background durationMs=$backgroundDurationMs")
            return true
        }
        Log.d("APP_LOCK", "APP_LOCK foreground_return_grace durationMs=$backgroundDurationMs")
        return false
    }

    fun isLocked(): Boolean = _state.value == LockState.LOCKED
    fun isAuthenticating(): Boolean = _state.value == LockState.AUTHENTICATING
    fun isUnlocked(): Boolean = _state.value == LockState.UNLOCKED

    private const val AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes in background
}
