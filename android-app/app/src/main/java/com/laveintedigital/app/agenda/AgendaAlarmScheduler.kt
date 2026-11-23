package com.laveintedigital.app.agenda

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Gestor central de programación de alarmas locales para la agenda laboral.
 * Funciona 100% offline a través del AlarmManager de Android.
 */
object AgendaAlarmScheduler {

    private val CDMX_ZONE = ZoneId.of("America/Mexico_City")
    private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")
    private val DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    private fun parseTimestamp(isoString: String?): Long? {
        if (isoString.isNullOrBlank()) return null
        return runCatching {
            Instant.parse(isoString).toEpochMilli()
        }.recoverCatching {
            // Fallback para strings locales tipo "YYYY-MM-DDTHH:mm:ss"
            val localDt = java.time.LocalDateTime.parse(isoString)
            localDt.atZone(CDMX_ZONE).toInstant().toEpochMilli()
        }.getOrNull()
    }

    private fun formatTime(epochMs: Long): String = runCatching {
        Instant.ofEpochMilli(epochMs).atZone(CDMX_ZONE).format(TIME_FORMATTER)
    }.getOrDefault("")

    private fun formatDate(epochMs: Long): String = runCatching {
        Instant.ofEpochMilli(epochMs).atZone(CDMX_ZONE).format(DATE_FORMATTER)
    }.getOrDefault("")

    /**
     * Sincroniza la lista de compromisos enviada desde la interfaz web.
     * Cancela recordatorios obsoletos y programa las nuevas alarmas en el hardware.
     */
    fun syncFromWeb(context: Context, jsonArrayString: String): Pair<Int, Int> {
        val nowMs = System.currentTimeMillis()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return Pair(0, 0)

        val newReminders = mutableListOf<NativeAgendaReminder>()

        runCatching {
            val array = JSONArray(jsonArrayString)
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val id = obj.optString("id", "").takeIf { it.isNotEmpty() } ?: continue
                val status = obj.optString("status", "active")
                if (status != "active") continue

                val title = obj.optString("title", "Compromiso").ifBlank { "Compromiso" }
                val startAtStr = obj.optString("startAt", "")
                val startMs = parseTimestamp(startAtStr) ?: continue
                val workplace = obj.optString("workplace", "").trim()
                val service = obj.optString("service", "").trim()
                val locationDesc = when {
                    service.isNotEmpty() && workplace.isNotEmpty() -> " · $service, $workplace"
                    service.isNotEmpty() -> " · $service"
                    workplace.isNotEmpty() -> " · $workplace"
                    else -> ""
                }

                val dateStr = formatDate(startMs)
                val destination = "https://la20.com.mx/bitacora?date=$dateStr&commitment=$id"

                val reminderObj = obj.optJSONObject("reminder") ?: JSONObject()
                val detailsObj = obj.optJSONObject("details") ?: JSONObject()

                val dayBeforeEnabled = reminderObj.optBoolean("dayBefore", false)
                val hoursBeforeEnabled = reminderObj.optBoolean("hoursBefore", false)
                val atStartEnabled = reminderObj.optBoolean("atStart", false)
                val reminderAtStr = detailsObj.optString("reminderAt", "").takeIf { it.isNotBlank() }

                // 1. Un día antes (a las 19:00 del día anterior en hora México)
                if (dayBeforeEnabled) {
                    val startZdt = Instant.ofEpochMilli(startMs).atZone(CDMX_ZONE)
                    val dayBeforeMs = startZdt.minusDays(1)
                        .withHour(19).withMinute(0).withSecond(0).withNano(0)
                        .toInstant().toEpochMilli()

                    if (dayBeforeMs > nowMs) {
                        val notifId = (id + ":DAY_BEFORE").hashCode()
                        val startTimeText = formatTime(startMs)
                        newReminders.add(
                            NativeAgendaReminder(
                                notificationId = notifId,
                                commitmentId = id,
                                reminderType = "DAY_BEFORE",
                                triggerAtMs = dayBeforeMs,
                                title = "Mañana: $title",
                                body = "Inicia a las $startTimeText$locationDesc",
                                destination = destination,
                            )
                        )
                    }
                }

                // 2. Dos horas antes
                if (hoursBeforeEnabled) {
                    val hoursBeforeMs = startMs - 2 * 60 * 60 * 1000L
                    if (hoursBeforeMs > nowMs) {
                        val notifId = (id + ":HOURS_BEFORE").hashCode()
                        val startTimeText = formatTime(startMs)
                        newReminders.add(
                            NativeAgendaReminder(
                                notificationId = notifId,
                                commitmentId = id,
                                reminderType = "HOURS_BEFORE",
                                triggerAtMs = hoursBeforeMs,
                                title = "En 2 horas: $title",
                                body = "Hoy a las $startTimeText$locationDesc",
                                destination = destination,
                            )
                        )
                    }
                }

                // 3. Al iniciar
                if (atStartEnabled) {
                    if (startMs > nowMs) {
                        val notifId = (id + ":AT_START").hashCode()
                        newReminders.add(
                            NativeAgendaReminder(
                                notificationId = notifId,
                                commitmentId = id,
                                reminderType = "AT_START",
                                triggerAtMs = startMs,
                                title = "Es hora: $title",
                                body = "Programado para iniciar ahora$locationDesc",
                                destination = destination,
                            )
                        )
                    }
                }

                // 4. Fecha/Hora específica (reminderAt en details)
                if (reminderAtStr != null) {
                    val schedMs = parseTimestamp(reminderAtStr)
                    if (schedMs != null && schedMs > nowMs) {
                        val notifId = (id + ":SCHEDULED_TIME").hashCode()
                        newReminders.add(
                            NativeAgendaReminder(
                                notificationId = notifId,
                                commitmentId = id,
                                reminderType = "SCHEDULED_TIME",
                                triggerAtMs = schedMs,
                                title = "Recordatorio: $title",
                                body = "Fecha y hora configurada para este evento$locationDesc",
                                destination = destination,
                            )
                        )
                    }
                }
            }
        }.onFailure { e ->
            Log.e("AGENDA_SCHEDULER", "parse_web_commitments_failed", e)
            return Pair(0, 0)
        }

        // Cancelar alarmas anteriores que ya no existen
        val currentReminders = AgendaReminderStore.getAll(context)
        val newIds = newReminders.map { it.notificationId }.toSet()
        var cancelledCount = 0

        for (curr in currentReminders) {
            if (curr.notificationId !in newIds) {
                cancelAlarm(context, alarmManager, curr.notificationId)
                cancelledCount++
            }
        }

        // Programar nuevas alarmas
        var scheduledCount = 0
        for (r in newReminders) {
            scheduleAlarm(context, alarmManager, r)
            scheduledCount++
        }

        // Actualizar almacén local
        AgendaReminderStore.saveAll(context, newReminders)
        Log.i("AGENDA_SCHEDULER", "sync_complete scheduled=$scheduledCount cancelled=$cancelledCount")
        return Pair(scheduledCount, cancelledCount)
    }

    /**
     * Reprograma todas las alarmas futuras guardadas en el almacén local.
     * Invocado tras reiniciar el dispositivo móvil (BootReceiver).
     */
    fun rescheduleAll(context: Context) {
        val nowMs = System.currentTimeMillis()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val saved = AgendaReminderStore.getAll(context)
        val validFuture = saved.filter { it.triggerAtMs > nowMs }

        var count = 0
        for (r in validFuture) {
            scheduleAlarm(context, alarmManager, r)
            count++
        }

        AgendaReminderStore.saveAll(context, validFuture)
        Log.i("AGENDA_SCHEDULER", "reschedule_complete count=$count")
    }

    private fun scheduleAlarm(context: Context, alarmManager: AlarmManager, r: NativeAgendaReminder) {
        val intent = Intent(context, AgendaAlarmReceiver::class.java).apply {
            putExtra(AgendaAlarmReceiver.EXTRA_NOTIFICATION_ID, r.notificationId)
            putExtra(AgendaAlarmReceiver.EXTRA_COMMITMENT_ID, r.commitmentId)
            putExtra(AgendaAlarmReceiver.EXTRA_REMINDER_TYPE, r.reminderType)
            putExtra(AgendaAlarmReceiver.EXTRA_TITLE, r.title)
            putExtra(AgendaAlarmReceiver.EXTRA_BODY, r.body)
            putExtra(AgendaAlarmReceiver.EXTRA_DESTINATION, r.destination)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            r.notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.triggerAtMs, pendingIntent)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.triggerAtMs, pendingIntent)
                }
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.triggerAtMs, pendingIntent)
            }
        } catch (e: SecurityException) {
            Log.w("AGENDA_SCHEDULER", "exact_alarm_permission_denied, falling back to inexact", e)
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.triggerAtMs, pendingIntent)
        }
    }

    private fun cancelAlarm(context: Context, alarmManager: AlarmManager, notificationId: Int) {
        val intent = Intent(context, AgendaAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }
}
