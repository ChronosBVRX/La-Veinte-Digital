package com.laveintedigital.app.security

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.laveintedigital.app.R
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandNavy
import java.util.concurrent.Executors

@Composable
fun BiometricUnlockScreen(
    onUnlocked: () -> Unit,
    onCancel: () -> Unit,
    onNotAvailable: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ctx = LocalContext.current

    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)

    // Detect biometric availability safely
    val canAuth = remember {
        try {
            val manager = BiometricManager.from(ctx)
            val result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            result == BiometricManager.BIOMETRIC_SUCCESS
        } catch (e: Exception) {
            Log.w("BiometricUnlock", "canAuthenticate failed", e)
            false
        }
    }

    val prompt = remember {
        try {
            val activity = ctx as FragmentActivity
            BiometricPrompt(
                activity,
                Executors.newSingleThreadExecutor(),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        try {
                            val enrollment = kotlinx.coroutines.runBlocking {
                                BiometricPreferences.readEnrollment(ctx)
                            }
                            if (enrollment != null) {
                                BiometricKeyStore.decrypt(enrollment.ciphertext, enrollment.iv)
                            }
                        } catch (_: Exception) {
                            // Crypto failed — still allow unlock as fallback
                        }
                        AppLockManager.unlock()
                        onUnlocked()
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        AppLockManager.lock()
                        onCancel()
                    }

                    override fun onAuthenticationFailed() {}
                },
            )
        } catch (e: Exception) {
            Log.w("BiometricUnlock", "prompt creation failed", e)
            null
        }
    }

    val promptInfo = remember {
        BiometricPrompt.PromptInfo.Builder()
            .setTitle("La Veinte Digital")
            .setSubtitle("Desbloquea tu cuenta para continuar")
            .setNegativeButtonText("Cancelar")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.horizontalGradient(colors = listOf(BrandNavy, BrandBlue))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(100.dp),
            )
            Spacer(Modifier.height(24.dp))
            Text(
                text = "La Veinte Digital",
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                letterSpacing = 1.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Desbloquea tu cuenta para continuar",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(48.dp))

            if (canAuth && prompt != null) {
                Button(
                    onClick = {
                        AppLockManager.startUnlock()
                        try {
                            val cipher = BiometricKeyStore.getDecryptCipher()
                            val crypto = BiometricPrompt.CryptoObject(cipher)
                            prompt.authenticate(promptInfo, crypto)
                        } catch (e: Exception) {
                            Log.w("BiometricUnlock", "auth launch failed", e)
                            AppLockManager.unlock()
                            onUnlocked()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandNavy,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Filled.Fingerprint, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.size(8.dp))
                    Text("Usar biometria", fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = onCancel) {
                    Text("Iniciar sesion de nuevo", color = Color.White.copy(alpha = 0.6f))
                }
            } else {
                Text(
                    text = "Sensor biometrico no disponible.\nPuedes continuar normalmente.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = { AppLockManager.unlock(); onUnlocked() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = BrandNavy),
                ) {
                    Text("Continuar", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
