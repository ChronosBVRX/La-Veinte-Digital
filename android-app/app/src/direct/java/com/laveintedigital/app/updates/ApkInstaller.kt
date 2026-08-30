package com.laveintedigital.app.updates

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream

object ApkInstaller {

    private const val TAG = "ApkInstaller"
    private const val SESSION_NAME = "LaVeinteDigital"

    fun canInstall(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.packageManager.canRequestPackageInstalls()
        else true

    fun openInstallPermissionSettings(context: Context) {
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    /**
     * Installs using [PackageInstaller.Session] for proper error reporting.
     * Falls back to ACTION_VIEW on API < 21 (shouldn't happen with minSdk 29).
     */
    fun install(context: Context, file: File, manifest: UpdateManifest): Boolean {
        if (!file.exists()) {
            Log.e(TAG, "File not found: ${file.absolutePath}")
            return false
        }

        if (!canInstall(context)) {
            Log.w(TAG, "Install permission not granted")
            openInstallPermissionSettings(context)
            return false
        }

        return try {
            installViaSession(context, file, manifest)
        } catch (e: Exception) {
            Log.e(TAG, "PackageInstaller.Session failed: ${e.message}", e)
            installViaActionView(context, file)
        }
    }

    private fun installViaSession(context: Context, file: File, manifest: UpdateManifest): Boolean {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setInstallReason(android.content.pm.PackageManager.INSTALL_REASON_USER)
            }
        }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)

        try {
            // Write APK to session
            session.openWrite(SESSION_NAME, 0, file.length()).use { output ->
                FileInputStream(file).use { input -> input.copyTo(output) }
                session.fsync(output)
            }

            // Commit with status receiver
            val intent = Intent(context, UpdateInstallReceiver::class.java).apply {
                action = "com.laveintedigital.app.INSTALL_COMPLETE"
                putExtra("versionName", manifest.versionName)
            }
            val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.PendingIntent.getBroadcast(context, sessionId, intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE)
            } else {
                @Suppress("DEPRECATION")
                android.app.PendingIntent.getBroadcast(context, sessionId, intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT)
            }

            session.commit(pendingIntent.intentSender)
            Log.d(TAG, "PackageInstaller session $sessionId committed")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Session install failed", e)
            installer.abandonSession(sessionId)
            throw e
        }
    }

    private fun installViaActionView(context: Context, file: File): Boolean {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return true
    }
}
