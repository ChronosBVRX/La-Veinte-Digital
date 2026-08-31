package com.laveintedigital.app

import android.app.Application
import com.google.firebase.messaging.FirebaseMessaging
import com.laveintedigital.app.observability.Telemetry
import com.laveintedigital.app.push.LaVeinteNotificationManager
import com.laveintedigital.app.push.PushTokenStore

class LaVeinteApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Telemetry.init(this)
        LaVeinteNotificationManager.createChannels(this)
        // Fetch/rotate the FCM token so the web (via the bridge getFcmToken()) can register it.
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> PushTokenStore.saveToken(this, token) }
            .addOnFailureListener { /* FCM not ready yet; onNewToken will populate it. */ }
    }

    companion object {
        @Deprecated("Use LaVeinteNotificationManager.CHANNEL_DOWNLOADS")
        const val CHANNEL_DOWNLOADS = "la_veinte_downloads"
    }
}
