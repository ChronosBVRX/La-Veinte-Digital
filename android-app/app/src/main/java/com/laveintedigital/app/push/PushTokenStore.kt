package com.laveintedigital.app.push

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists the latest FCM registration token + the user's notification preference.
 * The token is read by the web (via the bridge) to register it against the backend once a session
 * exists. Never log the full token in production.
 */
object PushTokenStore {

    private const val PREFS = "laveinte_push"
    private const val KEY_TOKEN = "fcm_token"
    private const val KEY_ENABLED = "notifications_enabled"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, true)

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }
}
