package com.laveintedigital.app.agenda

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Escucha el reinicio del teléfono (BOOT_COMPLETED) o actualización de la app (MY_PACKAGE_REPLACED)
 * para reprogramar automáticamente en AlarmManager todas las alarmas de la agenda laboral.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.i("AGENDA_BOOT", "boot_completed action=$action rescheduling_agenda_alarms")
            AgendaAlarmScheduler.rescheduleAll(context)
        }
    }
}
