package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdShapes
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTopBar
import com.laveintedigital.app.ui.theme.StatusBarAppearance

/**
 * Ventana intermedia para seleccionar la acción a realizar con los registros biométricos:
 * 1. Consultar un periodo (flujo completo con selector de quincena, historial y descarga PDF).
 * 2. Revisar mi quincena (flujo automático sobre el último periodo con resumen de omisiones/faltas).
 */
@Composable
fun TuPerfilBiometricHubScreen(
    onConsultarPeriodo: () -> Unit,
    onRevisarQuincena: () -> Unit,
    onBack: () -> Unit,
    onClose: () -> Unit,
) {
    StatusBarAppearance(lightIcons = false)

    Scaffold(
        topBar = {
            LvdTopBar(
                title = "Registros biométricos",
                subtitle = "Tu Perfil IMSS",
                onBack = onBack,
                actions = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Filled.Close, contentDescription = "Cerrar", tint = Color.White)
                    }
                },
            )
        },
        containerColor = LvdColors.Background,
        contentWindowInsets = WindowInsets.safeDrawing,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = LvdSpacing.Lg, vertical = 20.dp),
        ) {
            Text(
                text = "¿Qué deseas realizar?",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Selecciona una opción para consultar tus registros oficiales de checadas en Tu Perfil IMSS:",
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
                lineHeight = 18.sp,
            )

            Spacer(Modifier.height(20.dp))

            // Opción 1: Consultar un periodo
            BiometricHubOptionCard(
                icon = Icons.Filled.CalendarMonth,
                iconTint = LvdColors.Blue,
                iconBg = LvdColors.Blue.copy(alpha = 0.12f),
                badgeText = "Historial completo",
                badgeColor = LvdColors.Blue,
                badgeBg = LvdColors.Blue.copy(alpha = 0.10f),
                title = "Consultar un periodo",
                description = "Elige cualquier quincena anterior o actual para ver el desglose completo de tus checadas.",
                onClick = onConsultarPeriodo,
            )

            Spacer(Modifier.height(14.dp))

            // Opción 2: Revisar mi quincena
            BiometricHubOptionCard(
                icon = Icons.Filled.Warning,
                iconTint = Color(0xFFB45309),
                iconBg = Color(0xFFFEF3C7),
                badgeText = "Rápido y automático",
                badgeColor = Color(0xFFB45309),
                badgeBg = Color(0xFFFEF3C7),
                title = "Revisar mi quincena",
                description = "Consulta automáticamente el último periodo disponible y revisa si tienes faltas u omisiones de registro.",
                onClick = onRevisarQuincena,
            )

            Spacer(Modifier.height(24.dp))

            // Tarjeta informativa de seguridad y privacidad
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LvdShapes.Medium)
                    .background(Color.White)
                    .border(1.dp, LvdColors.Border, LvdShapes.Medium)
                    .padding(14.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(LvdShapes.Small)
                        .background(LvdColors.SurfaceSoft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Shield,
                        contentDescription = null,
                        tint = LvdColors.TextSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Consulta directa y segura",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = "La aplicación consulta directamente el portal oficial de Tu Perfil IMSS desde tu dispositivo usando tus accesos guardados. Ningún dato sensible se envía a servidores de terceros.",
                        fontSize = 12.sp,
                        color = LvdColors.TextMuted,
                        lineHeight = 16.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun BiometricHubOptionCard(
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    badgeText: String,
    badgeColor: Color,
    badgeBg: Color,
    title: String,
    description: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(LvdShapes.Large)
            .background(Color.White)
            .border(1.dp, LvdColors.Border, LvdShapes.Large)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .clip(LvdShapes.Medium)
                .background(iconBg),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(24.dp),
            )
        }

        Spacer(Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .clip(LvdShapes.Pill)
                        .background(badgeBg)
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text(
                        text = badgeText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = badgeColor,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = description,
                fontSize = 12.sp,
                color = LvdColors.TextSecondary,
                lineHeight = 16.sp,
            )
        }

        Spacer(Modifier.width(8.dp))

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = LvdColors.TextMuted,
            modifier = Modifier.size(20.dp),
        )
    }
}
