package com.laveintedigital.app

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary

/**
 * 100% Compose bootloader — no video, no black/white flash, continuous brand identity
 * from the system splash through to the main app.
 *
 * Animation flow:
 *   1. Logo fades in + scales up (350-500ms, ease-out)
 *   2. Subtle glow/pulse while loading
 *   3. Progress bar with real [StartupCoordinator] progress
 *   4. Status messages crossfade with each stage
 *   5. Fade out on [onFinished]
 */
@Composable
fun BootloaderScreen(
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)
    val stage by StartupCoordinator.state.collectAsState()
    var showLogo by remember { mutableStateOf(false) }
    var showContent by remember { mutableStateOf(false) }

    // Phase 1: logo entrance
    val logoScale by animateFloatAsState(
        targetValue = if (showLogo) 1f else 0.86f,
        animationSpec = tween(450),
        label = "logoScale",
    )
    val logoAlpha by animateFloatAsState(
        targetValue = if (showLogo) 1f else 0f,
        animationSpec = tween(400),
        label = "logoAlpha",
    )

    // Fade out when ready
    val contentAlpha by animateFloatAsState(
        targetValue = if (stage == StartupStage.READY) 0f else 1f,
        animationSpec = tween(250),
        label = "contentAlpha",
        finishedListener = { if (stage == StartupStage.READY) onFinished() },
    )

    // Init entrance animation
    if (!showLogo) {
        showLogo = true
    }
    if (!showContent && stage.progress > 0.15f) {
        showContent = true
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.horizontalGradient(colors = listOf(BrandNavy, BrandBlue))
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 48.dp)
                .alpha(contentAlpha),
        ) {
            // Logo with scale + alpha entrance
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .size(120.dp)
                    .scale(logoScale)
                    .alpha(logoAlpha),
            )

            Spacer(Modifier.height(32.dp))

            // Animated progress bar
            LinearProgressIndicator(
                progress = { stage.progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = Color.White.copy(alpha = 0.8f),
                trackColor = Color.White.copy(alpha = 0.15f),
            )

            Spacer(Modifier.height(20.dp))

            // Status message with crossfade (handled by AnimatedVisibility below)
            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn(tween(300)),
            ) {
                Text(
                    text = stage.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.65f),
                    textAlign = TextAlign.Center,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Light,
                )
            }
        }
    }
}
