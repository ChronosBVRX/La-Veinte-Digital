package com.laveintedigital.app.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.laveintedigital.app.MainActivity

/**
 * Central notification helper: defines the channels, builds notification objects and posts them,
 * always checking the POST_NOTIFICATIONS runtime permission on Android 13+ before notifying.
 *
 * Never put customer-sensitive data (salary, NSS, matrícula, deductions, diagnostics) in the visible
 * text — the body must be generic and the deep link opens the app to the protected content.
 */
object LaVeinteNotificationManager {

    const val CHANNEL_AVISOS = "la_veinte_avisos"
    const val CHANNEL_AGENDA = "la_veinte_agenda"
    const val CHANNEL_DOCUMENTOS = "la_veinte_documentos"
    const val CHANNEL_ACTUALIZACIONES = "la_veinte_actualizaciones"
    const val CHANNEL_DOWNLOADS = "la_veinte_downloads"

    private const val NOTIFICATION_PREFIX = "lvd_"

    /** Creates all channels (API 26+). Safe to call repeatedly. */
    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channels = listOf(
            NotificationChannel(CHANNEL_AVISOS, "Avisos importantes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Avisos importantes de La Veinte Digital"
            },
            NotificationChannel(CHANNEL_AGENDA, "Mi Agenda", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Recordatorios de tu agenda laboral"
            },
            NotificationChannel(CHANNEL_DOCUMENTOS, "Documentos IMSS", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Tarjetones, checadas y documentos disponibles"
            },
            NotificationChannel(CHANNEL_ACTUALIZACIONES, "Actualizaciones", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Novedades y actualizaciones de la app"
            },
            NotificationChannel(CHANNEL_DOWNLOADS, "Descargas", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Progreso y resultado de descargas"
            },
        )
        channels.forEach { nm.createNotificationChannel(it) }
    }

    /** Maps a push type to its channel. */
    fun channelFor(type: String): String = when (type) {
        "IMPORTANT_ALERT" -> CHANNEL_AVISOS
        "AGENDA" -> CHANNEL_AGENDA
        "DOCUMENT" -> CHANNEL_DOCUMENTOS
        "UPDATE" -> CHANNEL_ACTUALIZACIONES
        "DOWNLOAD" -> CHANNEL_DOWNLOADS
        else -> CHANNEL_AVISOS
    }

    fun canNotify(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else true

    /**
     * Shows a notification. [deepLink] should be a full internal URL (e.g.
     * `https://la-veinte-digital.vercel.app/documentos-personales`); tapping it opens the app and,
     * after biometric (if enabled), the web navigates to that destination.
     */
    fun notify(
        context: Context,
        id: Int,
        type: String,
        title: String,
        body: String,
        channel: String? = null,
        deepLink: String? = null,
    ) {
        if (!canNotify(context)) return
        val nm = NotificationManagerCompat.from(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            deepLink?.let { data = android.net.Uri.parse(it) }
        }
        val pending = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, channel ?: channelFor(type))
            .setSmallIcon(com.laveintedigital.app.R.drawable.ic_notification_laveinte)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)

        try {
            nm.notify(NOTIFICATION_PREFIX, id, builder.build())
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS revoked by the user after we built the notification — ignore.
        }
    }
}
