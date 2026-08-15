package com.laveintedigital.app.imss.credentials

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import java.util.concurrent.Executors

object ImssCredentialUnlock {

    private const val TAG = "ImssCredentialUnlock"

    fun canUseBiometric(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS
    }

    fun unlock(
        activity: FragmentActivity,
        portal: ImssPortal,
        onSuccess: (ImssCredentialPayload) -> Unit,
        onError: (String) -> Unit,
    ) {
        val executor = Executors.newSingleThreadExecutor()
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Desbloquea tu acceso")
            .setSubtitle("Usa tu huella para entrar a ${portal.displayName}")
            .setNegativeButtonText("Cancelar")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                try {
                    val payload = kotlinx.coroutines.runBlocking {
                        ImssVaultManager.decryptCredentials(activity, portal)
                    }
                    if (payload != null) onSuccess(payload)
                    else onError("No se pudieron descifrar las credenciales")
                } catch (e: Exception) {
                    Log.e(TAG, "Decrypt failed", e)
                    onError("No se pudieron descifrar las credenciales")
                }
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                onError(errString.toString())
            }
            override fun onAuthenticationFailed() {}
        })

        prompt.authenticate(promptInfo)
    }
}
