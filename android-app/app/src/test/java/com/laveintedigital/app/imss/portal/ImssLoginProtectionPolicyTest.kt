package com.laveintedigital.app.imss.portal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ImssLoginProtectionPolicyTest {

    @Test
    fun `countsAsTuPerfilCredentialFailure identifies credential and lockout errors`() {
        assertTrue(ImssLoginProtectionPolicy.countsAsTuPerfilCredentialFailure(PortalLoginErrorKind.BAD_CREDENTIALS))
        assertTrue(ImssLoginProtectionPolicy.countsAsTuPerfilCredentialFailure(PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED))
        assertFalse(ImssLoginProtectionPolicy.countsAsTuPerfilCredentialFailure(PortalLoginErrorKind.SERVICE_UNAVAILABLE))
        assertFalse(ImssLoginProtectionPolicy.countsAsTuPerfilCredentialFailure(PortalLoginErrorKind.TIMEOUT))
        assertFalse(ImssLoginProtectionPolicy.countsAsTuPerfilCredentialFailure(PortalLoginErrorKind.FIELDS_REQUIRED))
    }

    @Test
    fun `countsAsTarjetonDigitalCredentialFailure identifies credential and lockout errors`() {
        assertTrue(ImssLoginProtectionPolicy.countsAsTarjetonDigitalCredentialFailure(TarjetonDigitalLoginResult.InvalidCredentials))
        assertTrue(ImssLoginProtectionPolicy.countsAsTarjetonDigitalCredentialFailure(TarjetonDigitalLoginResult.AccountLocked))
        assertFalse(ImssLoginProtectionPolicy.countsAsTarjetonDigitalCredentialFailure(TarjetonDigitalLoginResult.ServiceUnavailable))
        assertFalse(ImssLoginProtectionPolicy.countsAsTarjetonDigitalCredentialFailure(TarjetonDigitalLoginResult.SessionExpired))
        assertFalse(ImssLoginProtectionPolicy.countsAsTarjetonDigitalCredentialFailure(TarjetonDigitalLoginResult.MissingFields))
    }

    @Test
    fun `nextFailedAttempts increments only on credential failure`() {
        assertEquals(1, ImssLoginProtectionPolicy.nextFailedAttempts(0, isCredentialFailure = true))
        assertEquals(2, ImssLoginProtectionPolicy.nextFailedAttempts(1, isCredentialFailure = true))
        assertEquals(1, ImssLoginProtectionPolicy.nextFailedAttempts(1, isCredentialFailure = false))
    }

    @Test
    fun `shouldClearSavedTuPerfilCredentials clears only when auto-login fails with credential error`() {
        assertTrue(
            ImssLoginProtectionPolicy.shouldClearSavedTuPerfilCredentials(
                wasAutoLogin = true,
                kind = PortalLoginErrorKind.BAD_CREDENTIALS,
            ),
        )
        assertFalse(
            ImssLoginProtectionPolicy.shouldClearSavedTuPerfilCredentials(
                wasAutoLogin = false,
                kind = PortalLoginErrorKind.BAD_CREDENTIALS,
            ),
        )
        assertFalse(
            ImssLoginProtectionPolicy.shouldClearSavedTuPerfilCredentials(
                wasAutoLogin = true,
                kind = PortalLoginErrorKind.SERVICE_UNAVAILABLE,
            ),
        )
    }

    @Test
    fun `shouldClearSavedTarjetonDigitalCredentials clears only when auto-login fails with credential error`() {
        assertTrue(
            ImssLoginProtectionPolicy.shouldClearSavedTarjetonDigitalCredentials(
                wasAutoLogin = true,
                result = TarjetonDigitalLoginResult.InvalidCredentials,
            ),
        )
        assertFalse(
            ImssLoginProtectionPolicy.shouldClearSavedTarjetonDigitalCredentials(
                wasAutoLogin = false,
                result = TarjetonDigitalLoginResult.InvalidCredentials,
            ),
        )
        assertFalse(
            ImssLoginProtectionPolicy.shouldClearSavedTarjetonDigitalCredentials(
                wasAutoLogin = true,
                result = TarjetonDigitalLoginResult.ServiceUnavailable,
            ),
        )
    }

    @Test
    fun `isLockoutGuardActive activates at MAX_SAFE_ATTEMPTS`() {
        assertFalse(ImssLoginProtectionPolicy.isLockoutGuardActive(0))
        assertFalse(ImssLoginProtectionPolicy.isLockoutGuardActive(1))
        assertTrue(ImssLoginProtectionPolicy.isLockoutGuardActive(2))
        assertTrue(ImssLoginProtectionPolicy.isLockoutGuardActive(3))
    }
}
