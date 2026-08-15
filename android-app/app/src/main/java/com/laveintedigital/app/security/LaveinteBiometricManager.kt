package com.laveintedigital.app.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators

/**
 * Wraps [BiometricManager] for availability checks.
 */
object LaveinteBiometricManager {

    /**
     * True if the device supports BIOMETRIC_STRONG authentication.
     * On API 29 this falls back to `BIOMETRIC_WEAK` if strong is unavailable,
     * but we degrade gracefully — we never block the user.
     */
    fun canAuthenticateStrong(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    fun canAuthenticateAny(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        val result = manager.canAuthenticate(
            Authenticators.BIOMETRIC_STRONG or Authenticators.BIOMETRIC_WEAK
        )
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Human-readable reason why biometric is unavailable.
     */
    fun unavailableReason(context: Context): String? {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "No hay huella ni rostro registrado en este dispositivo."
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "Este dispositivo no tiene sensor biométrico."
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "Sensor biométrico no disponible."
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "Actualización de seguridad requerida."
            else -> null
        }
    }
}
