package com.laveintedigital.app.push

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM handling:
 *  - [onNewToken] stores the new token locally so the web (via the bridge `getFcmToken()`) can
 *    re-register it against the backend whenever Firebase rotates it. Tokens are never permanent.
 *  - [onMessageReceived] routes a background push to [LaVeinteNotificationManager]; it never shows
 *    sensitive worker data. Pushes that should be silent (data-only, handled by the web) are
 *    detected via a `silent` flag and skipped.
 */
class LaVeinteFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("PUSH", "PUSH token_created len=${token.length}")
        PushTokenStore.saveToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data

        // App in foreground: if silent or handled by the web, skip the OS notification to avoid
        // duplicates. The web can also render it inline.
        if (data["silent"] == "true") return

        val type = data["type"] ?: "GENERAL"
        val title = data["title"] ?: "La Veinte Digital"
        val body = data["body"] ?: "Tienes información nueva disponible."
        val destination = data["destination"]
        val channel = data["channel"]

        // A notification with a notification payload also arrives here; avoid double-posting.
        if (message.notification != null && data.isEmpty()) return

        LaVeinteNotificationManager.notify(
            context = applicationContext,
            id = if (data["id"]?.toIntOrNull() != null) data["id"]!!.toInt() else type.hashCode(),
            type = type,
            title = title,
            body = body,
            channel = channel?.takeIf { it.isNotEmpty() },
            deepLink = destination?.takeIf { it.isNotEmpty() },
        )
        Log.d("PUSH", "PUSH foreground_message type=$type")
    }
}
