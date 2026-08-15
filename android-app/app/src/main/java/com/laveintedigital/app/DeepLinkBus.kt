package com.laveintedigital.app

import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton bus that transports deep-link URIs from [MainActivity.onNewIntent] back to the
 * Compose tree so the internal WebView can load the OAuth callback.
 */
object DeepLinkBus {
    private val _uri = MutableStateFlow<Uri?>(null)
    val uri: StateFlow<Uri?> = _uri.asStateFlow()

    fun dispatch(intent: Intent?) {
        _uri.value = intent?.data
    }

    fun consume() {
        _uri.value = null
    }
}
