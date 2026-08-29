package com.laveintedigital.app.security

import android.util.Log
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

/**
 * Fullscreen app-lock gate. It launches [BiometricPrompt] automatically the first time it is shown
 * (no "Usar biometría" tap required). Cancel / error / failure all keep the app LOCKED; only a
 * successful authentication unlocks. A simple "Desbloquear" button re-launches the prompt.
 *
 * We allow `BIOMETRIC_WEAK | DEVICE_CREDENTIAL` so Android chooses fingerprint / face / PIN and we
 * never invent our own "face vs. fingerprint" detector.
 */
@Composable
fun BiometricUnlockScreen(
    onUnlocked: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ctx = LocalContext.current
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)

    val canAuth = remember {
        runCatching { LaveinteBiometricManager.canAuthenticate(ctx) }.getOrDefault(false)
    }

    var promptAttempt by remember { mutableStateOf(0) }

    val prompt = remember {
        runCatching {
            val activity = ctx as FragmentActivity
            BiometricPrompt(
                activity,
                Executors.newSingleThreadExecutor(),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        Log.d("APP_LOCK", "APP_LOCK authentication_success")
                        AppLockManager.unlock()
                        onUnlocked()
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        Log.d("APP_LOCK", "APP_LOCK authentication_error=$errorCode")
                        AppLockManager.lock()
                    }

                    override fun onAuthenticationFailed() {
                        Log.d("APP_LOCK", "APP_LOCK authentication_failed")
                        AppLockManager.lock()
                    }
                },
            )
        }.getOrNull()
    }

    val promptInfo = remember {
        BiometricPrompt.PromptInfo.Builder()
            .setTitle("La Veinte Digital")
            .setSubtitle("Autentica con tu huella, rostro o bloqueo seguro")
            .setAllowedAuthenticators(LaveinteBiometricManager.ALLOWED_AUTHENTICATORS)
            // No setNegativeButtonText: with DEVICE_CREDENTIAL the system provides its own fallback.
            .build()
    }

    // Auto-launch the prompt exactly once per (re)entry to the lock screen.
    LaunchedEffect(promptAttempt, canAuth) {
        if (canAuth && prompt != null) {
            Log.d("APP_LOCK", "APP_LOCK biometric_prompt_started")
            AppLockManager.startAuthentication()
            runCatching { prompt.authenticate(promptInfo) }
                .onFailure { e ->
                    Log.w("APP_LOCK", "APP_LOCK biometric_prompt_launch_failed", e)
                    AppLockManager.lock()
                }
        }
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
                text = "Tu información está protegida",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(48.dp))

            if (canAuth && prompt != null) {
                Button(
                    onClick = { promptAttempt++ },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandNavy,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Filled.Fingerprint, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.size(8.dp))
                    Text("Desbloquear", fontWeight = FontWeight.SemiBold)
                }
            } else {
                Text(
                    text = "No hay huella, rostro ni bloqueo seguro disponible.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
