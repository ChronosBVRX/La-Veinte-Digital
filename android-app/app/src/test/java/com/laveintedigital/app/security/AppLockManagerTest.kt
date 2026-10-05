package com.laveintedigital.app.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppLockManagerTest {

    @Test
    fun `cold start with biometric enabled starts LOCKED`() {
        AppLockManager.init(enabled = true)
        assertTrue(AppLockManager.isBiometricEnabled)
        assertEquals(LockState.LOCKED, AppLockManager.state.value)
        assertTrue(AppLockManager.isLocked())
        assertFalse(AppLockManager.isUnlocked())
    }

    @Test
    fun `cold start with biometric disabled starts UNLOCKED`() {
        AppLockManager.init(enabled = false)
        assertFalse(AppLockManager.isBiometricEnabled)
        assertEquals(LockState.UNLOCKED, AppLockManager.state.value)
        assertTrue(AppLockManager.isUnlocked())
        assertFalse(AppLockManager.isLocked())
    }

    @Test
    fun `enabling biometrics mid-session activates background auto-lock`() {
        AppLockManager.init(enabled = false)
        assertTrue(AppLockManager.isUnlocked())

        // User enables biometrics during the session (post-login or from /profile)
        AppLockManager.setBiometricEnabled(true)
        assertTrue(AppLockManager.isBiometricEnabled)
        assertTrue(AppLockManager.isUnlocked())

        // Background + immediate foreground with 0ms timeout relocks the app
        AppLockManager.onAppBackground()
        val relocked = AppLockManager.onAppForeground(timeoutMs = 0L)
        assertTrue(relocked)
        assertEquals(LockState.LOCKED, AppLockManager.state.value)
    }

    @Test
    fun `disabling biometrics mid-session stops background auto-lock`() {
        AppLockManager.init(enabled = true)
        AppLockManager.unlock()
        assertTrue(AppLockManager.isUnlocked())

        // User disables biometrics after passing BiometricPrompt confirmation
        AppLockManager.setBiometricEnabled(false)
        assertFalse(AppLockManager.isBiometricEnabled)

        AppLockManager.onAppBackground()
        val relocked = AppLockManager.onAppForeground(timeoutMs = 0L)
        assertFalse(relocked)
        assertEquals(LockState.UNLOCKED, AppLockManager.state.value)
    }

    @Test
    fun `authentication lifecycle transitions strictly between LOCKED AUTHENTICATING and UNLOCKED`() {
        AppLockManager.init(enabled = true)
        assertEquals(LockState.LOCKED, AppLockManager.state.value)

        AppLockManager.startAuthentication()
        assertTrue(AppLockManager.isAuthenticating())
        assertFalse(AppLockManager.isUnlocked())

        // Cancel / error returns to LOCKED
        AppLockManager.lock()
        assertTrue(AppLockManager.isLocked())
        assertFalse(AppLockManager.isUnlocked())

        // Only unlock() reaches UNLOCKED
        AppLockManager.unlock()
        assertTrue(AppLockManager.isUnlocked())
    }
}
