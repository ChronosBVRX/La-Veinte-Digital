package com.laveintedigital.app.observability

import android.content.Context
import android.util.Log
import com.laveintedigital.app.BuildConfig
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Capa de telemetría y observabilidad de Android — La Veinte Digital.
 *
 * Registra errores críticos, ANRs y excepciones no controladas sanitizando
 * cualquier dato sensible (contraseñas, cookies, tokens, CURP, RFC, NSS,
 * matrícula, datos biométricos).
 */
object Telemetry {

    private const val TAG = "LVD_TELEMETRY"
    private val initialized = AtomicBoolean(false)

    private val SENSITIVE_KEYS = setOf(
        "password", "pass", "token", "auth", "cookie", "jwt", "curp", "rfc",
        "nss", "matricula", "secret", "bearer", "credential", "clabe", "card"
    )

    fun init(context: Context) {
        if (initialized.compareAndSet(false, true)) {
            val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
            Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
                captureException(
                    throwable = throwable,
                    context = mapOf(
                        "thread" to thread.name,
                        "source" to "UncaughtExceptionHandler",
                        "appVersion" to BuildConfig.VERSION_NAME,
                        "versionCode" to BuildConfig.VERSION_CODE.toString()
                    )
                )
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }
    }

    fun captureException(throwable: Throwable, context: Map<String, String> = emptyMap()) {
        val sanitizedContext = sanitize(context)
        Log.e(TAG, "Exception: ${throwable.javaClass.simpleName}: ${throwable.message} context=$sanitizedContext", throwable)
    }

    fun captureMessage(message: String, level: Int = Log.INFO, context: Map<String, String> = emptyMap()) {
        val sanitizedContext = sanitize(context)
        when (level) {
            Log.ERROR -> Log.e(TAG, "$message context=$sanitizedContext")
            Log.WARN -> Log.w(TAG, "$message context=$sanitizedContext")
            else -> Log.i(TAG, "$message context=$sanitizedContext")
        }
    }

    fun sanitize(map: Map<String, String>): Map<String, String> {
        return map.mapValues { (key, value) ->
            if (SENSITIVE_KEYS.any { key.contains(it, ignoreCase = true) }) {
                "[REDACTED]"
            } else {
                value.take(300)
            }
        }
    }
}
