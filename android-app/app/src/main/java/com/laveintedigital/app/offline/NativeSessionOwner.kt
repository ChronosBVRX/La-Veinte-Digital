package com.laveintedigital.app.offline

import android.content.Context

/**
 * Propietario lógico de sesión para los documentos nativos (modo offline).
 *
 * La web informa el user id autenticado vía el canal WebMessage (`setOwner`); se limpia
 * al cerrar sesión. Es best-effort y nunca destructivo: un propietario desconocido (null)
 * conserva el comportamiento histórico (todo visible). Ver docs/ANDROID_OFFLINE_DOCUMENTS.md.
 *
 * Solo guarda el id opaco (UUID de Supabase); nunca tokens, PDFs ni datos del trabajador.
 */
object NativeSessionOwner {
    private const val PREFS = "offline_docs_prefs"
    private const val KEY_OWNER = "current_owner"
    private const val MAX_LEN = 128

    fun current(context: Context): String? {
        return runCatching {
            context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_OWNER, null)?.trim()?.ifBlank { null }
        }.getOrNull()
    }

    fun set(context: Context, ownerId: String?) {
        val clean = ownerId?.trim().orEmpty()
        runCatching {
            val prefs = context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (clean.isBlank()) {
                prefs.edit().remove(KEY_OWNER).apply()
            } else {
                prefs.edit().putString(KEY_OWNER, clean.take(MAX_LEN)).apply()
            }
        }
        android.util.Log.i(OfflineLog.TAG, "DOC_OWNER_SET known=${clean.isNotBlank()}")
    }

    fun clear(context: Context) = set(context, null)

    /** Validación pura del identificador (unit-testeable, sin contexto). */
    fun isValidOwnerId(ownerId: String?): Boolean {
        val clean = ownerId?.trim().orEmpty()
        if (clean.isEmpty() || clean.length > MAX_LEN) return false
        return clean.all { it.isLetterOrDigit() || it == '-' || it == '_' || it == ':' }
    }
}
