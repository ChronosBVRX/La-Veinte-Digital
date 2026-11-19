package com.laveintedigital.app.agenda

import android.content.Context
import android.util.Log
import org.json.JSONArray
import java.io.File

/**
 * Almacén local de recordatorios pendientes en JSON privado (`agenda_reminders.json`).
 * Permite restaurar alarmas tras reiniciar el dispositivo (BOOT_COMPLETED).
 */
object AgendaReminderStore {

    private const val FILE_NAME = "agenda_reminders.json"
    private val lock = Any()

    private fun getFile(context: Context): File = File(context.filesDir, FILE_NAME)

    fun getAll(context: Context): List<NativeAgendaReminder> = synchronized(lock) {
        val file = getFile(context)
        if (!file.exists()) return emptyList()

        return runCatching {
            val content = file.readText()
            val array = JSONArray(content)
            val list = mutableListOf<NativeAgendaReminder>()
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val reminder = NativeAgendaReminder.fromJson(obj)
                if (reminder != null) list.add(reminder)
            }
            list
        }.getOrElse { e ->
            Log.e("AGENDA_STORE", "failed_to_read_reminders", e)
            emptyList()
        }
    }

    fun saveAll(context: Context, reminders: List<NativeAgendaReminder>) = synchronized(lock) {
        runCatching {
            val array = JSONArray()
            reminders.forEach { array.put(it.toJson()) }
            val file = getFile(context)
            file.writeText(array.toString())
        }.onFailure { e ->
            Log.e("AGENDA_STORE", "failed_to_save_reminders", e)
        }
    }

    fun remove(context: Context, notificationId: Int) = synchronized(lock) {
        val current = getAll(context)
        val updated = current.filter { it.notificationId != notificationId }
        saveAll(context, updated)
    }
}
