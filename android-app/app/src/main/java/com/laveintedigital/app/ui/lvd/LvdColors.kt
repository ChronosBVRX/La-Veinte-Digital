package com.laveintedigital.app.ui.lvd

import androidx.compose.ui.graphics.Color

/**
 * LVD (La Veinte Digital) — tokens de color v1.
 * Referencia visual: la plataforma web actual (dashboard claro + navy + azul).
 *
 * Regla: NINGÚN composable usa colores hex sueltos. Todo pasa por aquí
 * (o por [LvdSemantic]) para poder cambiar la identidad desde un solo archivo.
 */
object LvdColors {

    // ── Brand ──────────────────────────────────────────────────────────────
    val Navy = Color(0xFF161F32)   // cabeceras, top bars, identidad
    val Blue = Color(0xFF2462EA)   // acciones, CTAs, links, selección

    // ── Fondos ─────────────────────────────────────────────────────────────
    val Background = Color(0xFFF7F9FA)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceSoft = Color(0xFFF3F6F9)

    // ── Texto ──────────────────────────────────────────────────────────────
    val TextPrimary = Color(0xFF161F32)
    val TextSecondary = Color(0xFF5E728C)
    val TextMuted = Color(0xFF9DA2AA)

    // ── Bordes ─────────────────────────────────────────────────────────────
    val Border = Color(0xFFD9E1EA)
    val BorderStrong = Color(0xFFB9CADF)

    // ── Semánticos ─────────────────────────────────────────────────────────
    val Info = Color(0xFF5F92F1)
    val Success = Color(0xFF5FCA8A)
    val Warning = Color(0xFFF0C65B)
    val Error = Color(0xFFEEAFAA)

    // Variantes legibles sobre superficies claras (texto de error/success)
    val ErrorStrong = Color(0xFFB3261E)
    val SuccessStrong = Color(0xFF15803D)

    // ── Aliases funcionales ────────────────────────────────────────────────
    val Primary get() = Blue
    val OnPrimary get() = Color.White
    val Scrim get() = Color(0xFF161F32).copy(alpha = 0.40f)
}

/**
 * Alias semánticos por uso. Preferir estos nombres en los composables.
 */
object LvdSemantic {
    val Primary get() = LvdColors.Blue
    val Background get() = LvdColors.Background
    val Surface get() = LvdColors.Surface
    val SurfaceSoft get() = LvdColors.SurfaceSoft
    val TextPrimary get() = LvdColors.TextPrimary
    val TextSecondary get() = LvdColors.TextSecondary
    val TextMuted get() = LvdColors.TextMuted
    val Border get() = LvdColors.Border
    val BorderStrong get() = LvdColors.BorderStrong
    val Success get() = LvdColors.Success
    val Warning get() = LvdColors.Warning
    val Error get() = LvdColors.Error
    val Info get() = LvdColors.Info
}
