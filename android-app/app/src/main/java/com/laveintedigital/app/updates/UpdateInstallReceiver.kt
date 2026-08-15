package com.laveintedigital.app.updates

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.laveintedigital.app.R

/**
 * Receives the result of a PackageInstaller.Session commit.
 * Shows a notification with the install result.
 */
class UpdateInstallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""
        val versionName = intent.getStringExtra("versionName") ?: ""

        Log.i(TAG, "Install result: status=$status version=$versionName msg=$message")

        val title: String
        val text: String
        when (status) {
            PackageInstaller.STATUS_SUCCESS -> {
                title = "La Veinte Digital actualizada"
                text = "Versión $versionName instalada correctamente"
            }
            PackageInstaller.STATUS_FAILURE -> {
                title = "No se pudo actualizar"
                text = resolveError(message)
            }
            PackageInstaller.STATUS_FAILURE_CONFLICT -> {
                title = "Conflicto de actualización"
                text = "La APK fue firmada con un certificado diferente. Desinstala la versión actual e inténtalo de nuevo."
            }
            PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> {
                title = "Actualización incompatible"
                text = "La APK no es compatible con este dispositivo o con la versión instalada."
            }
            PackageInstaller.STATUS_FAILURE_INVALID -> {
                title = "APK inválida"
                text = "El archivo descargado no es válido o está corrupto."
            }
            PackageInstaller.STATUS_FAILURE_STORAGE -> {
                title = "Sin espacio"
                text = "No hay suficiente espacio de almacenamiento."
            }
            PackageInstaller.STATUS_FAILURE_BLOCKED -> {
                title = "Instalación bloqueada"
                text = "Android bloqueó la instalación. Verifica los permisos."
            }
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // User needs to confirm — launch the intent
                val confirmIntent = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(confirmIntent)
                }
                return
            }
            else -> {
                title = "Resultado desconocido"
                text = "Código: $status"
            }
        }

        showNotification(context, title, text)
    }

    private fun resolveError(msg: String): String = when {
        msg.contains("INSTALL_FAILED_UPDATE_INCOMPATIBLE", ignoreCase = true) ->
            "La firma del APK no coincide con la versión instalada. Desinstala manualmente y vuelve a instalar."
        msg.contains("INSTALL_FAILED_VERSION_DOWNGRADE", ignoreCase = true) ->
            "La versión descargada es anterior a la instalada."
        msg.contains("INSTALL_FAILED_INVALID_APK", ignoreCase = true) ->
            "El archivo APK es inválido o está corrupto."
        msg.isNotBlank() -> msg
        else -> "Error desconocido durante la instalación"
    }

    private fun showNotification(context: Context, title: String, text: String) {
        val channelId = "la_veinte_updates"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Actualizaciones",
                NotificationManager.IMPORTANCE_HIGH)
            context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pending = if (intent != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            } else {
                @Suppress("DEPRECATION")
                PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT)
            }
        } else null

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification_laveinte)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        context.getSystemService(NotificationManager::class.java)?.notify(8801, notification)
    }

    companion object {
        private const val TAG = "UpdateInstallReceiver"
    }
}
