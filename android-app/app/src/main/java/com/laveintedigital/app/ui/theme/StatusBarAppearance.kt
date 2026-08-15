package com.laveintedigital.app.ui.theme

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Overrides the status bar icon appearance for a single screen.
 *
 * La Veinte Digital is a light brand, so the default is dark icons on light
 * surfaces. Screens that are full navy (bootloader, biometrics) or that show a
 * navy top bar (IMSS portals) call [StatusBarAppearance] with [lightIcons] = false
 * to keep the white icons visible; the previous value is restored on dispose.
 */
@Composable
fun StatusBarAppearance(lightIcons: Boolean) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        DisposableEffect(view, lightIcons) {
            val controller = WindowCompat.getInsetsController((view.context as Activity).window, view)
            val previous = controller.isAppearanceLightStatusBars
            controller.isAppearanceLightStatusBars = lightIcons
            onDispose { controller.isAppearanceLightStatusBars = previous }
        }
    }
}
