package com.laveintedigital.app.ui.lvd

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Radios del sistema LVD v1.
 */
object LvdRadii {
    val Small = 8.dp
    val Medium = 12.dp
    val Large = 18.dp
    val Sheet = 28.dp
    val Button = 14.dp
    val Field = 14.dp
    val Card = 16.dp
}

/**
 * Shapes del sistema LVD v1.
 */
object LvdShapes {
    val Small: Shape = RoundedCornerShape(LvdRadii.Small)
    val Medium: Shape = RoundedCornerShape(LvdRadii.Medium)
    val Large: Shape = RoundedCornerShape(LvdRadii.Large)
    val Button: Shape = RoundedCornerShape(LvdRadii.Button)
    val Field: Shape = RoundedCornerShape(LvdRadii.Field)
    val Card: Shape = RoundedCornerShape(LvdRadii.Card)
    val Sheet: Shape = RoundedCornerShape(topStart = LvdRadii.Sheet, topEnd = LvdRadii.Sheet)
    val Pill: Shape = CircleShape
}

/**
 * Escala de espaciado del sistema LVD v1.
 */
object LvdSpacing {
    val Xs = 4.dp
    val Sm = 8.dp
    val Md = 12.dp
    val Lg = 16.dp
    val Xl = 20.dp
    val Xxl = 24.dp
    val Xxxl = 32.dp
}

/**
 * Elevaciones del sistema LVD v1. La plataforma es limpia: sombras mínimas.
 */
object LvdElevation {
    val Card = 1.dp
    val Sheet = 8.dp
    val Floating = 4.dp
}

/**
 * Dimensiones estructurales del sistema LVD v1.
 */
object LvdDimens {
    val ButtonHeight: Dp = 52.dp
    val ButtonHeightSmall: Dp = 44.dp
    val FieldHeight: Dp = 56.dp
    val TopBarTitle = 16f
    val TopBarSubtitle = 11f
}
