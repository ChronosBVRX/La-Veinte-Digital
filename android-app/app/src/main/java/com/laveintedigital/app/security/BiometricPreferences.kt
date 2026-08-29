package com.laveintedigital.app.security

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "la_veinte_biometric")

/**
 * Preferences for the visual app lock. We only persist whether the lock is enabled.
 * No decorative crypto: the actual gate is a [androidx.biometric.BiometricPrompt] on top of the
 * device's own secure credential (fingerprint / face / device credential). Nothing sensitive is
 * encrypted here.
 */
object BiometricPreferences {

    private val KEY_ENABLED = booleanPreferencesKey("biometric_enabled")

    // Legacy keys (pre-v1.0.97, decorative ciphertext) — only used to detect an old enrollment.
    private val KEY_LEGACY_CIPHERTEXT = stringLegacyKey("biometric_ciphertext")
    private fun stringLegacyKey(name: String) = androidx.datastore.preferences.core.stringPreferencesKey(name)

    fun isEnabled(context: Context): Flow<Boolean> =
        context.dataStore.data.map { it[KEY_ENABLED] ?: false }

    suspend fun setEnabled(context: Context, enabled: Boolean) {
        context.dataStore.edit { it[KEY_ENABLED] = enabled }
    }

    suspend fun clearLegacyEnrollment(context: Context) {
        context.dataStore.edit {
            it.remove(KEY_LEGACY_CIPHERTEXT)
            it.remove(androidx.datastore.preferences.core.stringPreferencesKey("biometric_iv"))
            it.remove(androidx.datastore.preferences.core.longPreferencesKey("biometric_enrolled_at"))
        }
    }

    suspend fun clearAll(context: Context) {
        context.dataStore.edit { it.clear() }
    }
}
