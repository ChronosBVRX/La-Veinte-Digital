package com.laveintedigital.app.agenda

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.laveintedigital.app.push.LaVeinteNotificationManager

/**
 * Receptor de alarmas locales programadas con AlarmManager.
 * Se ejecuta a la hora exacta definida por el trabajador, completamente offline.
 */
class AgendaAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        val commitmentId = intent.getStringExtra(EXTRA_COMMITMENT_ID) ?: ""
        val reminderType = intent.getStringExtra(EXTRA_REMINDER_TYPE) ?: "AGENDA"
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "La Veinte Digital"
        val body = intent.getStringExtra(EXTRA_BODY) ?: "Tienes un compromiso programado."
        val destination = intent.getStringExtra(EXTRA_DESTINATION)

        Log.i("AGENDA_ALARM", "alarm_received notifId=$notificationId commId=$commitmentId type=$reminderType")

        // Disparar la notificación nativa usando el canal CHANNEL_AGENDA con sonido y vibración
        LaVeinteNotificationManager.notify(
            context = context,
            id = notificationId,
            type = "AGENDA",
            title = title,
            body = body,
            channel = LaVeinteNotificationManager.CHANNEL_AGENDA,
            deepLink = destination?.takeIf { it.isNotBlank() },
        )

        // Limpiar de la lista de pendientes local
        AgendaReminderStore.remove(context, notificationId)
    }

    companion object {
        const val EXTRA_NOTIFICATION_ID = "com.laveintedigital.app.agenda.EXTRA_NOTIFICATION_ID"
        const val EXTRA_COMMITMENT_ID = "com.laveintedigital.app.agenda.EXTRA_COMMITMENT_ID"
        const val EXTRA_REMINDER_TYPE = "com.laveintedigital.app.agenda.EXTRA_REMINDER_TYPE"
        const val EXTRA_TITLE = "com.laveintedigital.app.agenda.EXTRA_TITLE"
        const val EXTRA_BODY = "com.laveintedigital.app.agenda.EXTRA_BODY"
        const val EXTRA_DESTINATION = "com.laveintedigital.app.agenda.EXTRA_DESTINATION"
    }
}
