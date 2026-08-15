package com.laveintedigital.app.ui.lvd

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Top bar LVD: navy [#161F32], título blanco, subtítulo blanco 70%, acciones.
 * Usado en cabeceras de identidad (portales IMSS, pantallas navy).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LvdTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    containerColor: Color = LvdColors.Navy,
    actions: @Composable RowScope.() -> Unit = {},
) {
    TopAppBar(
        modifier = modifier,
        title = {
            Column {
                Text(
                    title,
                    fontSize = LvdDimens.TopBarTitle.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (subtitle != null) {
                    Text(
                        subtitle,
                        fontSize = LvdDimens.TopBarSubtitle.sp,
                        color = Color.White.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = containerColor,
            titleContentColor = Color.White,
            navigationIconContentColor = Color.White,
            actionIconContentColor = Color.White,
        ),
    )
}

/**
 * Bottom sheet LVD: radio superior 28dp, sombra ligera, superficie blanca.
 * Reemplaza a los AlertDialog genéricos cuando el contenido es un formulario.
 */
@Composable
fun LvdBottomSheet(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
    onClose: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = LvdShapes.Sheet,
        colors = CardDefaults.cardColors(containerColor = LvdColors.Surface),
        elevation = CardDefaults.cardElevation(defaultElevation = LvdElevation.Sheet),
    ) {
        Column(modifier = Modifier.padding(contentPadding)) {
            // Grab handle + optional close
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                if (onClose != null) {
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier.align(Alignment.CenterEnd).size(32.dp),
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Cerrar",
                            tint = LvdColors.TextMuted,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
                Box(
                    Modifier
                        .width(36.dp)
                        .height(4.dp)
                        .background(LvdColors.Border, LvdShapes.Pill),
                )
            }
            Spacer(Modifier.height(LvdSpacing.Lg))
            content()
        }
    }
}

/**
 * Card LVD: superficie blanca, sombra 1dp, radio 16dp.
 */
@Composable
fun LvdCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(LvdSpacing.Lg),
    onClick: (() -> Unit)? = null,
    elevation: Dp = LvdElevation.Card,
    containerColor: Color = LvdColors.Surface,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = LvdShapes.Card
    val colors = CardDefaults.cardColors(containerColor = containerColor)
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
            shape = shape,
            colors = colors,
            elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        ) {
            Column(modifier = Modifier.padding(contentPadding), content = content)
        }
    } else {
        Card(
            modifier = modifier,
            shape = shape,
            colors = colors,
            elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        ) {
            Column(modifier = Modifier.padding(contentPadding), content = content)
        }
    }
}

/**
 * Diálogo LVD: superficie blanca, radio grande. Reemplaza a los AlertDialog genéricos.
 */
@Composable
fun LvdDialog(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    icon: (@Composable () -> Unit)? = null,
    title: String? = null,
    text: (@Composable () -> Unit)? = null,
    confirmButton: (@Composable () -> Unit)? = null,
    dismissButton: (@Composable () -> Unit)? = null,
    containerColor: Color = LvdColors.Surface,
) {
    AlertDialog(
        onDismissRequest = onDismissRequest,
        modifier = modifier,
        icon = icon,
        title = title?.let { { Text(it, color = LvdColors.TextPrimary, fontWeight = FontWeight.SemiBold) } },
        text = text,
        confirmButton = { confirmButton?.invoke() },
        dismissButton = { dismissButton?.invoke() },
        shape = LvdShapes.Large,
        containerColor = containerColor,
        titleContentColor = LvdColors.TextPrimary,
        textContentColor = LvdColors.TextSecondary,
    )
}

/**
 * Encabezado de sección LVD: título + subtítulo opcional + acción al final.
 */
@Composable
fun LvdSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    action: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
            if (subtitle != null) {
                Spacer(Modifier.height(2.dp))
                Text(
                    subtitle,
                    fontSize = 13.sp,
                    color = LvdColors.TextSecondary,
                )
            }
        }
        if (action != null) {
            Spacer(Modifier.width(LvdSpacing.Md))
            action()
        }
    }
}

/**
 * Card de estado LVD: icono + título + subtítulo.
 */
@Composable
fun LvdStatusCard(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    LvdCard(modifier = modifier, contentPadding = PaddingValues(LvdSpacing.Lg)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(LvdSpacing.Md))
            Column {
                Text(
                    title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
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
