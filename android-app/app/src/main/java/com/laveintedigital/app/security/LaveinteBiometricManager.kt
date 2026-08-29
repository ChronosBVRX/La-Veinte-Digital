package com.laveintedigital.app.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators

/**
 * Biometric availability for the app-level visual lock.
 *
 * We allow `BIOMETRIC_WEAK | DEVICE_CREDENTIAL`: for protecting visual access we do not want to
 * decide "face vs. fingerprint" ourselves — Android resolves which authenticator to present, and
 * `BIOMETRIC_WEAK` covers both strong and face (Class 2) while `DEVICE_CREDENTIAL` guarantees a PIN /
 * pattern / password fallback on phones without biometrics.
 */
object LaveinteBiometricManager {

    val ALLOWED_AUTHENTICATORS: Int = Authenticators.BIOMETRIC_WEAK or Authenticators.DEVICE_CREDENTIAL

    /** True if the device can satisfy the app lock (biometric OR device credential). */
    fun canAuthenticate(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        return manager.canAuthenticate(ALLOWED_AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS
    }

    /** Human-readable reason why the app lock cannot be satisfied. */
    fun unavailableReason(context: Context): String? {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(ALLOWED_AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "No hay huella, rostro ni bloqueo seguro configurado."
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "Este dispositivo no tiene sensor biométrico ni credencial segura."
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "Sensor biométrico no disponible."
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "Actualización de seguridad requerida."
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> "Este dispositivo no admite autenticación segura."
            else -> null
        }
    }
}
