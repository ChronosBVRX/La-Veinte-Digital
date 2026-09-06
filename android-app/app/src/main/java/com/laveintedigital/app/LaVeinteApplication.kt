package com.laveintedigital.app

import android.app.Application
import com.google.firebase.messaging.FirebaseMessaging
import com.laveintedigital.app.internal.PdfShareManager
import com.laveintedigital.app.observability.Telemetry
import com.laveintedigital.app.push.LaVeinteNotificationManager
import com.laveintedigital.app.push.PushTokenStore

class LaVeinteApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Identidad del build instalado (una sola vez; solo datos de build).
        android.util.Log.i(
            "APP_BUILD",
            "version=${BuildConfig.VERSION_NAME} " +
                "code=${BuildConfig.VERSION_CODE} " +
                "channel=${BuildConfig.DISTRIBUTION_CHANNEL}",
        )
        Telemetry.init(this)
        LaVeinteNotificationManager.createChannels(this)
        PdfShareManager.cleanupOld(this)
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
