package com.laveintedigital.app.security

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Centralized runtime permission requests for La Veinte Digital.
 *
 * Android 13+ (TIRAMISU / API 33) requires POST_NOTIFICATIONS to be requested at runtime;
 * CAMERA is a runtime permission since API 23. This keeps permission UX in one place so the app
 * does not depend on the WebView's onPermissionRequest as the only path.
 *
 * IMPORTANT: `shouldShowRequestPermissionRationale()` returns `false` BOTH before the first ask and
 * when the user tapped "don't ask again". To distinguish "never asked" from "permanently denied" we
 * persist a `camera_asked` flag. Only when the user was asked at least once AND the rationale is not
 * shown do we treat it as permanently denied and redirect to Settings.
 */
object PermissionCoordinator {

    private const val PREFS = "laveinte_permissions"
    private const val KEY_NOTIFICATIONS_ASKED = "notifications_asked"
    private const val KEY_CAMERA_ASKED = "camera_asked"

    /** Camera permission state, as reported to the web so the scanner can wait for the grant. */
    enum class CameraState { GRANTED, SHOW_REQUEST, PERMANENTLY_DENIED }

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Resolves the current CAMERA state:
     *  - GRANTED            → permission already granted.
     *  - SHOW_REQUEST       → never asked, or denied once but the system will still show the dialog.
     *  - PERMANENTLY_DENIED → asked before AND rationale is no longer shown (don't ask again).
     */
    fun cameraState(activity: Activity): CameraState {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return CameraState.GRANTED
        }
        val askedBefore = prefs(activity).getBoolean(KEY_CAMERA_ASKED, false)
        val rationale = activity.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)
        return if (askedBefore && !rationale) CameraState.PERMANENTLY_DENIED else CameraState.SHOW_REQUEST
    }

    /** Marks that we are about to show the CAMERA system dialog (so future calls know it was asked). */
    fun markCameraAsked(activity: Activity) {
        prefs(activity).edit().putBoolean(KEY_CAMERA_ASKED, true).apply()
    }

    private fun isNotificationDeniedForever(activity: Activity): Boolean {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }
        val askedBefore = prefs(activity).getBoolean(KEY_NOTIFICATIONS_ASKED, false)
        return askedBefore && !activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
    }

    fun openAppSettings(activity: Activity) {
        activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.fromParts("package", activity.packageName, null)
        })
    }

    /**
     * Requests POST_NOTIFICATIONS once (Android 13+) at a reasonable time, e.g. after the
     * bootloader. No-op on older devices or if already granted.
     */
    fun maybeRequestNotifications(activity: Activity, launch: (String) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (prefs(activity).getBoolean(KEY_NOTIFICATIONS_ASKED, false)) return
        prefs(activity).edit().putBoolean(KEY_NOTIFICATIONS_ASKED, true).apply()
        launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** Re-asks notifications, or opens app settings if permanently denied. */
    fun requestNotificationsFromSettings(activity: Activity) {
        if (isNotificationDeniedForever(activity)) {
            openAppSettings(activity)
        }
    }
}
