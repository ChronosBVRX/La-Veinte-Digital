package com.laveintedigital.app.ui.lvd

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Duración estándar de animaciones de estado (180-280ms). */
object LvdMotion {
    val StateTransition = tween<Float>(220)
}

/**
 * Estado de carga LVD: indicador circular azul + mensaje. Uso en overlays.
 */
@Composable
fun LvdLoadingState(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(32.dp),
            color = LvdColors.Blue,
            strokeWidth = 3.dp,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            title,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = LvdColors.TextPrimary,
            textAlign = TextAlign.Center,
        )
        if (subtitle != null) {
            Spacer(Modifier.height(6.dp))
            Text(
                subtitle,
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * Estado de error LVD: icono rojo suave + mensaje. Reintento opcional.
 */
@Composable
fun LvdErrorState(
    message: String,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Filled.ErrorOutline,
                contentDescription = null,
                tint = LvdColors.ErrorStrong,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                message,
                fontSize = 13.sp,
                color = LvdColors.TextPrimary,
                modifier = Modifier.weight(1f),
            )
        }
        if (onRetry != null) {
            Spacer(Modifier.height(12.dp))
            LvdSecondaryButton(text = "Reintentar", onClick = onRetry)
        }
    }
}

/**
 * Estado de éxito LVD: check verde + título. Con transición de aparición.
 */
@Composable
fun LvdSuccessState(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    AnimatedVisibility(
        visible = true,
        enter = fadeIn(LvdMotion.StateTransition) + scaleIn(initialScale = 0.94f, animationSpec = LvdMotion.StateTransition),
        exit = fadeOut(LvdMotion.StateTransition) + scaleOut(targetScale = 0.96f, animationSpec = LvdMotion.StateTransition),
    ) {
        Row(
            modifier = modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = LvdColors.Success,
                modifier = Modifier.size(22.dp),
            )
            Spacer(Modifier.width(8.dp))
            Column {
                Text(
                    title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LvdColors.TextPrimary,
                )
                if (subtitle != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        subtitle,
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )
                }
            }
        }
    }
}

/**
 * Overlay de pantalla completa para estados de carga/éxito/error dentro del flujo.
 * Reemplaza el patrón "Box negro + Card" disperso.
 */
@Composable
fun LvdFullscreenState(
    modifier: Modifier = Modifier,
    scrim: Color = LvdColors.Scrim,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(scrim),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
