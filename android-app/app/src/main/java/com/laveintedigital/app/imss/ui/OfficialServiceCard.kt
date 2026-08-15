package com.laveintedigital.app.imss.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary

/**
 * UI model for one service tile of the "Tarjetones oficiales IMSS" hub.
 *
 * Cards are always LIGHT surfaces (white), matching the "¿Qué necesitas hoy?"
 * tiles of the web Home. The brand color lives in the illustration and the
 * CTA — never as a full card background.
 */
data class OfficialServiceUiModel(
    val title: String,
    val description: String,
    val accent: Color,
    val accentLight: Color,
    val actionLabel: String,
    val mainIcon: ImageVector,
    val accentIcons: List<ImageVector>,
    val onClick: () -> Unit,
    @DrawableRes val imageRes: Int? = null,
    val saved: Boolean = false,
)

@Composable
fun OfficialServiceCard(
    model: OfficialServiceUiModel,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val pressScale by animateFloatAsState(
        targetValue = if (pressed) 0.98f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 300f),
        label = "pressScale",
    )
    val corner = if (compact) 16.dp else 20.dp
    val shape = RoundedCornerShape(corner)

    val titleColor = MaterialTheme.colorScheme.onSurface
    val descriptionColor = MaterialTheme.colorScheme.onSurfaceVariant
    val ctaColor = Primary

    Box(
        modifier = modifier
            .shadow(
                elevation = 2.dp,
                shape = shape,
                ambientColor = BrandNavy.copy(alpha = 0.06f),
                spotColor = BrandNavy.copy(alpha = 0.10f),
            )
            .graphicsLayer {
                scaleX = pressScale
                scaleY = pressScale
            }
            .background(MaterialTheme.colorScheme.surface, shape)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f), shape)
            .clickable(
                interactionSource = interactionSource,
                indication = LocalIndication.current,
                role = Role.Button,
                onClickLabel = model.actionLabel,
                onClick = model.onClick,
            )
            .semantics {
                contentDescription = buildString {
                    append(model.title)
                    append(". ")
                    append(model.description)
                    append(". ")
                    append(model.actionLabel)
                    if (model.saved) append(". Acceso guardado")
                }
            },
    ) {
        if (model.saved) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 8.dp, end = 8.dp)
                    .clip(RoundedCornerShape(50))
                    .background(model.accent.copy(alpha = 0.10f))
                    .border(1.dp, model.accent.copy(alpha = 0.30f), RoundedCornerShape(50))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = model.accent,
                    modifier = Modifier.size(10.dp),
                )
                Spacer(Modifier.width(3.dp))
                Text(
                    "Guardado",
                    color = model.accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(if (compact) 12.dp else 14.dp),
        ) {
            // TOP — illustration (brand color lives here, not the card bg)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                if (model.imageRes != null) {
                    androidx.compose.foundation.Image(
                        painter = painterResource(model.imageRes),
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    ServiceIllustration(model, compact)
                }
            }

            Spacer(Modifier.height(if (compact) 6.dp else 8.dp))

            // MIDDLE — title + description
            Text(
                model.title,
                color = titleColor,
                fontSize = if (compact) 15.sp else 17.sp,
                lineHeight = if (compact) 20.sp else 22.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            Spacer(Modifier.height(3.dp))

            Text(
                model.description,
                color = descriptionColor,
                fontSize = if (compact) 12.sp else 13.sp,
                lineHeight = if (compact) 16.sp else 18.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            Spacer(Modifier.height(if (compact) 8.dp else 10.dp))

            // BOTTOM — text CTA + arrow (no outline capsule)
            Row(
                modifier = Modifier
                    .fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    model.actionLabel,
                    color = ctaColor,
                    fontSize = if (compact) 13.sp else 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(4.dp))
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = ctaColor,
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}

/**
 * Built-in illustration: layered translucent shapes in the brand blue family,
 * a main emblem icon and small accent chips. All color lives here so the card
 * stays neutral white.
 */
@Composable
private fun ServiceIllustration(model: OfficialServiceUiModel, compact: Boolean) {
    val mainSize = if (compact) 52.dp else 64.dp
    val chipSize = if (compact) 18.dp else 22.dp
    val glow = model.accent
    val emblemBackground = model.accent.copy(alpha = 0.10f)
    val emblemBorder = model.accent.copy(alpha = 0.28f)
    val emblemIcon = model.accent

    Box(Modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(
                color = glow.copy(alpha = 0.14f),
                radius = size.minDimension * 0.36f,
                center = Offset(size.width * 0.80f, size.height * 0.22f),
            )
            drawCircle(
                color = glow.copy(alpha = 0.09f),
                radius = size.minDimension * 0.28f,
                center = Offset(size.width * 0.16f, size.height * 0.86f),
            )
            drawCircle(
                color = glow.copy(alpha = 0.12f),
                radius = size.minDimension * 0.20f,
                center = Offset(size.width * 0.14f, size.height * 0.14f),
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .size(mainSize + 18.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(emblemBackground)
                .border(1.dp, emblemBorder, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                model.mainIcon,
                contentDescription = null,
                tint = emblemIcon,
                modifier = Modifier.size(mainSize),
            )
        }

        model.accentIcons.forEachIndexed { index, icon ->
            val alignment = if (index % 2 == 0) Alignment.TopStart else Alignment.BottomEnd
            Box(
                modifier = Modifier
                    .align(alignment)
                    .padding(if (compact) 6.dp else 8.dp)
                    .size(chipSize + 10.dp)
                    .clip(CircleShape)
                    .background(model.accentLight.copy(alpha = 0.16f))
                    .border(1.dp, model.accent.copy(alpha = 0.22f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = model.accent,
                    modifier = Modifier.size(chipSize),
                )
            }
        }
    }
}
