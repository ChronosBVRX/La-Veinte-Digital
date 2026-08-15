package com.laveintedigital.app.security

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "la_veinte_biometric")

object BiometricPreferences {

    private val KEY_ENABLED = booleanPreferencesKey("biometric_enabled")
    private val KEY_CIPHERTEXT = stringPreferencesKey("biometric_ciphertext")
    private val KEY_IV = stringPreferencesKey("biometric_iv")
    private val KEY_ENROLLED_AT = longPreferencesKey("biometric_enrolled_at")

    fun isEnabled(context: Context): Flow<Boolean> =
        context.dataStore.data.map { it[KEY_ENABLED] ?: false }

    suspend fun readEnrollment(context: Context): BiometricEnrollment? {
        val prefs = context.dataStore.data.first()
        val ct = prefs[KEY_CIPHERTEXT] ?: return null
        val iv = prefs[KEY_IV] ?: return null
        val ts = prefs[KEY_ENROLLED_AT] ?: return null
        return BiometricEnrollment(
            ciphertext = Base64.decode(ct, Base64.DEFAULT),
            iv = Base64.decode(iv, Base64.DEFAULT),
            enrolledAt = ts,
        )
    }

    suspend fun saveEnrollment(context: Context, enrollment: BiometricEnrollment) {
        context.dataStore.edit { prefs ->
            prefs[KEY_ENABLED] = true
            prefs[KEY_CIPHERTEXT] = Base64.encodeToString(enrollment.ciphertext, Base64.DEFAULT)
            prefs[KEY_IV] = Base64.encodeToString(enrollment.iv, Base64.DEFAULT)
            prefs[KEY_ENROLLED_AT] = enrollment.enrolledAt
        }
    }

    suspend fun setEnabled(context: Context, enabled: Boolean) {
        context.dataStore.edit { it[KEY_ENABLED] = enabled }
    }

    suspend fun clearAll(context: Context) {
        context.dataStore.edit { it.clear() }
    }
}

data class BiometricEnrollment(
    val ciphertext: ByteArray,
    val iv: ByteArray,
    val enrolledAt: Long,
)
