package com.laveintedigital.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = PrimaryFg,
    background = Bg,
    onBackground = Fg,
    surface = Card,
    onSurface = Fg,
    surfaceVariant = Accent,
    onSurfaceVariant = Muted,
    outline = Border,
    error = ErrorRed,
)

/**
 * La Veinte Digital es una marca clara: el Home web (la experiencia principal,
 * cargada en el WebView) siempre renderiza el tema claro. Por eso aquí el
 * esquema de colores es SIEMPRE claro, independientemente de
 * isSystemInDarkTheme() — la política visual de la app no cambia si el
 * teléfono está en dark mode.
 */
@Composable
fun LaVeinteTheme(
    content: @Composable () -> Unit,
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowCompat.getInsetsController(window, view)
            // Iconos del status bar oscuros (sobre superficies claras). Las
            // pantallas navy de marca (bootloader, biometría) lo revierten.
            controller.isAppearanceLightStatusBars = true
            controller.isAppearanceLightNavigationBars = true
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
        }
    }
    MaterialTheme(
        colorScheme = LightColors,
        typography = LaVeinteTypography,
        content = content,
    )
}
