package com.laveintedigital.app.imss.credentials

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import org.json.JSONObject

private val Context.imssVaultStore: DataStore<Preferences> by preferencesDataStore(name = "laveinte_imss_vault")

/**
 * Stores encrypted IMSS credentials (ciphertext + IV) in DataStore.
 * Metadata (portalId, version, timestamps) goes to Room.
 */
object ImssCredentialRepository {

    private fun ctKey(portalId: String) = stringPreferencesKey("imss_ct_$portalId")
    private fun ivKey(portalId: String) = stringPreferencesKey("imss_iv_$portalId")

    suspend fun hasCredentials(context: Context, portalId: String): Boolean {
        val prefs = context.imssVaultStore.data.first()
        return prefs[ctKey(portalId)] != null
    }

    suspend fun save(
        context: Context,
        portalId: String,
        ciphertext: ByteArray,
        iv: ByteArray,
    ) {
        context.imssVaultStore.edit {
            it[ctKey(portalId)] = Base64.encodeToString(ciphertext, Base64.DEFAULT)
            it[ivKey(portalId)] = Base64.encodeToString(iv, Base64.DEFAULT)
        }
    }

    suspend fun read(context: Context, portalId: String): Pair<ByteArray, ByteArray>? {
        val prefs = context.imssVaultStore.data.first()
        val ct = prefs[ctKey(portalId)] ?: return null
        val iv = prefs[ivKey(portalId)] ?: return null
        return Base64.decode(ct, Base64.DEFAULT) to Base64.decode(iv, Base64.DEFAULT)
    }

    suspend fun delete(context: Context, portalId: String) {
        context.imssVaultStore.edit {
            it.remove(ctKey(portalId))
            it.remove(ivKey(portalId))
        }
    }
}
