package com.laveintedigital.app.agenda

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject

class AgendaAlarmSchedulerTest {

    @Test
    fun testNativeAgendaReminderSerialization() {
        val reminder = NativeAgendaReminder(
            notificationId = 12345,
            commitmentId = "comm-abc",
            reminderType = "HOURS_BEFORE",
            triggerAtMs = 1750000000000L,
            title = "En 2 horas: Tiempo extra",
            body = "Hoy a las 16:00 · Urgencias",
            destination = "https://la20.com.mx/bitacora?date=2026-09-20&commitment=comm-abc",
        )

        val json = reminder.toJson()
        assertEquals(12345, json.getInt("notificationId"))
        assertEquals("comm-abc", json.getString("commitmentId"))
        assertEquals("HOURS_BEFORE", json.getString("reminderType"))
        assertEquals(1750000000000L, json.getLong("triggerAtMs"))

        val deserialized = NativeAgendaReminder.fromJson(json)
        assertNotNull(deserialized)
        assertEquals(reminder.notificationId, deserialized!!.notificationId)
        assertEquals(reminder.commitmentId, deserialized.commitmentId)
        assertEquals(reminder.reminderType, deserialized.reminderType)
        assertEquals(reminder.triggerAtMs, deserialized.triggerAtMs)
        assertEquals(reminder.title, deserialized.title)
        assertEquals(reminder.body, deserialized.body)
        assertEquals(reminder.destination, deserialized.destination)
    }

    @Test
    fun testJsonArrayParsingFormat() {
        val rawArray = JSONArray().apply {
            put(JSONObject().apply {
                put("id", "comm-1")
                put("status", "active")
                put("title", "Guardia festiva")
                put("startAt", "2026-11-20T14:00:00.000Z")
                put("service", "Quirófano")
                put("workplace", "HGR 1")
                put("reminder", JSONObject().apply {
                    put("dayBefore", true)
                    put("hoursBefore", true)
                    put("atStart", true)
                })
            })
        }

        assertEquals(1, rawArray.length())
        val item = rawArray.getJSONObject(0)
        assertEquals("comm-1", item.getString("id"))
        assertTrue(item.getJSONObject("reminder").getBoolean("dayBefore"))
    }
}
