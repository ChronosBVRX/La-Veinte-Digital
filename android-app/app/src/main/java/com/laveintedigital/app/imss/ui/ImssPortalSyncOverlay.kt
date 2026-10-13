package com.laveintedigital.app.imss.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdShapes

/**
 * Pantalla opaca de sincronización y carga asistida para los portales del IMSS.
 *
 * Oculta completamente el WebView del navegador en segundo plano para que el
 * trabajador vea una experiencia nativa, fluida y elegante, mientras el motor
 * web continúa procesando credenciales, iframes y capturas de PDF sin interrupciones.
 */
@Composable
fun ImssPortalSyncOverlay(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector = Icons.Filled.Shield,
    portalName: String = "Portal oficial IMSS",
    showManualButton: Boolean = false,
    onManual: (() -> Unit)? = null,
) {
    // Animación de pulso continuo (halo concéntrico)
    val infiniteTransition = rememberInfiniteTransition(label = "portal_sync_pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.14f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse_scale",
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.08f,
        targetValue = 0.22f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse_alpha",
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LvdColors.Background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Contenedor del icono con halos concéntricos animados
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(120.dp),
            ) {
                // Halo exterior pulsante
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(LvdColors.Blue.copy(alpha = pulseAlpha)),
                )
                // Halo interior medio
                Box(
                    modifier = Modifier
                        .size(86.dp)
                        .clip(CircleShape)
                        .background(LvdColors.Blue.copy(alpha = 0.12f)),
                )
                // Círculo central con icono oficial
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(LvdColors.Surface)
                        .border(1.5.dp, LvdColors.Border, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = LvdColors.Blue,
                        modifier = Modifier.size(34.dp),
                    )
                }
            }

            Spacer(Modifier.height(28.dp))

            // Título principal
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = LvdColors.TextPrimary,
                textAlign = TextAlign.Center,
            )

            if (subtitle != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = subtitle,
                    fontSize = 13.sp,
                    color = LvdColors.TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp,
                )
            }

            Spacer(Modifier.height(24.dp))

            // Barra de progreso elegante
            LinearProgressIndicator(
                modifier = Modifier
                    .width(180.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = LvdColors.Blue,
                trackColor = LvdColors.Border,
            )

            Spacer(Modifier.height(28.dp))

            // Badge de conexión segura con el portal
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(LvdShapes.Pill)
                    .background(LvdColors.Surface)
                    .border(1.dp, LvdColors.Border, LvdShapes.Pill)
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = LvdColors.TextSecondary,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "$portalName • Cifrado seguro",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = LvdColors.TextSecondary,
                )
            }

            if (showManualButton && onManual != null) {
                Spacer(Modifier.height(20.dp))
                TextButton(onClick = onManual) {
                    Text(
                        text = "Entrar manualmente",
                        color = LvdColors.Blue,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                }
            }
        }
    }
}
