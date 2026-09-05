package com.laveintedigital.app.internal.navigation

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.laveintedigital.app.R
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary

/**
 * Overlay nativo de feedback de navegación post-splash.
 *
 * - Scrim translúcido ligero: la pantalla anterior sigue visible detrás
 *   (NO es otro splash, NO es fullscreen opaco).
 * - Solo `fade in` / `fade out` (+ pulso MUY discreto del isotipo, salvo
 *   animaciones reducidas del sistema).
 * - Sin `BackHandler`/`OnBackPressedCallback`: el Back canónico sigue intacto.
 * - Sin modificadores de puntero: no consume toques (pasan al WebView) y no
 *   introduce gestos propios. Sin haptics.
 * - Accesibilidad: anuncio cortés único ("Cargando"), logo decorativo sin
 *   descripción redundante, sin mover el foco.
 */
@Composable
internal fun NativeNavigationOverlay(
    visible: Boolean,
    slow: Boolean,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val animationsOff = remember { animationsDisabled(context) }

    AnimatedVisibility(
        visible = visible,
        enter = if (animationsOff) EnterTransition.None else fadeIn(),
        exit = if (animationsOff) ExitTransition.None else fadeOut(),
        modifier = modifier.fillMaxSize(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC).copy(alpha = 0.82f)),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val logoAlpha = if (animationsOff) {
                    1f
                } else {
                    val pulse by rememberInfiniteTransition(label = "nav-feedback-pulse").animateFloat(
                        initialValue = 0.82f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(durationMillis = 1200),
                            repeatMode = RepeatMode.Reverse,
                        ),
                        label = "nav-feedback-pulse-anim",
                    )
                    pulse
                }
                Image(
                    painter = painterResource(R.drawable.splash_logo),
                    contentDescription = null,
                    modifier = Modifier
                        .size(54.dp)
                        .alpha(logoAlpha),
                )
                Spacer(Modifier.height(12.dp))
                CircularProgressIndicator(
                    color = Primary,
                    strokeWidth = 3.dp,
                    modifier = Modifier.size(28.dp),
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    text = if (slow) "La conexión está tardando un poco…" else "Cargando…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandNavy,
                    modifier = Modifier.semantics {
                        liveRegion = LiveRegionMode.Polite
                    },
                )
            }
        }
    }
}

/** Respeta animaciones reducidas/deshabilitadas del sistema. */
internal fun animationsDisabled(context: Context): Boolean {
    return runCatching {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    }.getOrDefault(false)
}
