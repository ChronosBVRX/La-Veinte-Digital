package com.laveintedigital.app.agenda

import org.json.JSONObject

/**
 * Recordatorio de agenda laboral persistido localmente para programación en AlarmManager.
 */
data class NativeAgendaReminder(
    val notificationId: Int,
    val commitmentId: String,
    val reminderType: String,
    val triggerAtMs: Long,
    val title: String,
    val body: String,
    val destination: String,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("notificationId", notificationId)
        put("commitmentId", commitmentId)
        put("reminderType", reminderType)
        put("triggerAtMs", triggerAtMs)
        put("title", title)
        put("body", body)
        put("destination", destination)
    }

    companion object {
        fun fromJson(json: JSONObject): NativeAgendaReminder? = runCatching {
            NativeAgendaReminder(
                notificationId = json.getInt("notificationId"),
                commitmentId = json.getString("commitmentId"),
                reminderType = json.getString("reminderType"),
                triggerAtMs = json.getLong("triggerAtMs"),
                title = json.getString("title"),
                body = json.getString("body"),
                destination = json.optString("destination", "https://la20.com.mx/bitacora"),
            )
        }.getOrNull()
    }
}
