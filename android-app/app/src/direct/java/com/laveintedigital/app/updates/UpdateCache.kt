package com.laveintedigital.app.updates

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.updateCache: DataStore<Preferences> by preferencesDataStore(name = "la_veinte_update_cache")

/**
 * Local cache of the last successful update check.
 * Prevents the UpdateManager from going blind when the network is unavailable.
 */
object UpdateCache {

    private val KEY_LAST_CHECK = longPreferencesKey("update_last_check_ts")
    private val KEY_LATEST_CODE = intPreferencesKey("update_latest_code")
    private val KEY_MIN_CODE = intPreferencesKey("update_min_code")
    private val KEY_FORCE = booleanPreferencesKey("update_force")

    data class CachedState(
        val lastCheckTimestamp: Long,
        val latestVersionCode: Int,
        val minimumVersionCode: Int,
        val forceUpdate: Boolean,
    )

    suspend fun read(context: Context): CachedState? {
        val prefs = context.updateCache.data.first()
        val ts = prefs[KEY_LAST_CHECK] ?: return null
        val code = prefs[KEY_LATEST_CODE] ?: return null
        val min = prefs[KEY_MIN_CODE] ?: code
        val force = prefs[KEY_FORCE] ?: false
        return CachedState(ts, code, min, force)
    }

    suspend fun save(context: Context, manifest: UpdateManifest) {
        context.updateCache.edit {
            it[KEY_LAST_CHECK] = System.currentTimeMillis()
            it[KEY_LATEST_CODE] = manifest.versionCode
            it[KEY_MIN_CODE] = manifest.minimumVersionCode
            it[KEY_FORCE] = manifest.forceUpdate
        }
    }

    suspend fun clear(context: Context) {
        context.updateCache.edit { it.clear() }
    }

    /**
     * True if a previously-known force update is still pending and the cached
     * versionCode is greater than the installed version.
     */
    suspend fun isForceUpdatePending(context: Context): Boolean {
        val cached = read(context) ?: return false
        if (!cached.forceUpdate) return false
        val current = context.packageManager.getPackageInfo(context.packageName, 0).versionCode
        return cached.latestVersionCode > current
    }
}
