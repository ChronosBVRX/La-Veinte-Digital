package com.laveintedigital.app.security

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.ContextCompat

/**
 * Centralized runtime permission requests for La Veinte Digital.
 *
 * Android 13+ (TIRAMISU / API 33) requires POST_NOTIFICATIONS to be requested at runtime;
 * CAMERA is a runtime permission since API 23. This keeps all permission UX in one place so
 * the app does not depend on the WebView's onPermissionRequest as the only path.
 *
 * `shouldShowRequestPermissionRationale` distinguishes "first time ask" from "denied forever".
 */
object PermissionCoordinator {

    private const val PREFS = "laveinte_permissions"
    private const val KEY_NOTIFICATIONS_ASKED = "notifications_asked"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** True when [permission] was already granted "forever" (system disabled the dialog). */
    fun isDeniedForever(activity: Activity, permission: String): Boolean {
        if (ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED) {
            return false
        }
        return !activity.shouldShowRequestPermissionRationale(permission)
    }

    /**
     * Requests POST_NOTIFICATIONS once (Android 13+) at a reasonable time, e.g. after the
     * bootloader so the user has the app in front of them. No-op on older devices or if already granted.
     */
    fun maybeRequestNotifications(activity: Activity, launch: (String) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) return
        if (prefs(activity).getBoolean(KEY_NOTIFICATIONS_ASKED, false)) return
        prefs(activity).edit().putBoolean(KEY_NOTIFICATIONS_ASKED, true).apply()
        launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /**
     * Requests CAMERA before the web scanner starts the camera via getUserMedia. This makes the
     * permission ask deterministic — the WebView's onPermissionRequest remains as a second layer.
     */
    fun requestCamera(activity: Activity, launch: (Array<String>) -> Unit) {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (isDeniedForever(activity, Manifest.permission.CAMERA)) {
            Toast.makeText(
                activity,
                "Para escanear el código necesitas activar la cámara en Ajustes.",
                Toast.LENGTH_LONG,
            ).show()
            activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.fromParts("package", activity.packageName, null)
            })
            return
        }
        launch(arrayOf(Manifest.permission.CAMERA))
    }

    /**
     * Re-asks for POST_NOTIFICATIONS when the user taps a "request notifications" bridge command,
     * or opens the app settings if it was permanently denied.
     */
    fun requestNotificationsFromSettings(activity: Activity) {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (isDeniedForever(activity, Manifest.permission.POST_NOTIFICATIONS)) {
            activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.fromParts("package", activity.packageName, null)
            })
        }
    }
}
