package com.laveintedigital.app.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Señal de conectividad del sistema (sin polling).
 *
 * Distingue "red disponible" de "acceso real validado": expone si el sistema validó
 * Internet ([validatedInternet], vía NET_CAPABILITY_VALIDATED) para los avisos discretos
 * de recuperación. La decisión de entrar a modo offline la toma la WebView ante un fallo
 * real de navegación (ver [OfflineDetection]); este monitor solo complementa.
 */
object NetworkMonitor {

    private val _validatedInternet = MutableStateFlow<Boolean?>(null)
    val validatedInternet: StateFlow<Boolean?> = _validatedInternet.asStateFlow()

    @Volatile private var started = false

    fun start(appContext: Context) {
        if (started) return
        synchronized(this) {
            if (started) return
            started = true
        }
        val ctx = appContext.applicationContext
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return
        _validatedInternet.value = hasValidatedInternetNow(ctx)
        runCatching {
            cm.registerNetworkCallback(
                NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build(),
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        refresh(ctx)
                    }

                    override fun onLost(network: Network) {
                        refresh(ctx)
                        android.util.Log.i(OfflineLog.TAG, "NETWORK_LOST")
                    }

                    override fun onCapabilitiesChanged(
                        network: Network,
                        caps: NetworkCapabilities,
                    ) {
                        refresh(ctx)
                    }
                },
            )
        }.onFailure { e ->
            android.util.Log.w(OfflineLog.TAG, "network_callback_register_failed", e)
        }
    }

    /** ¿Hay ahora mismo una red con Internet validado por el sistema? */
    fun hasValidatedInternetNow(context: Context): Boolean {
        return runCatching {
            val cm = context.applicationContext.getSystemService(ConnectivityManager::class.java)
                ?: return false
            val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }.getOrDefault(false)
    }

    private fun refresh(ctx: Context) {
        val now = hasValidatedInternetNow(ctx)
        val prev = _validatedInternet.value
        _validatedInternet.value = now
        if (now && prev != true) {
            android.util.Log.i(OfflineLog.TAG, OfflineLog.EVENT_RECOVERED)
        }
    }
}

/**
 * Señal para que la WebView interna recargue al volver de la pantalla offline con
 * conectividad recuperada. Contador de generaciones: la pantalla interna recarga solo
 * cuando cambia (nunca en flujo online normal).
 */
object OnlineRecovery {
    private val _generation = MutableStateFlow(0L)
    val generation: StateFlow<Long> = _generation.asStateFlow()

    fun requestReload() {
        _generation.value = _generation.value + 1
    }
}
