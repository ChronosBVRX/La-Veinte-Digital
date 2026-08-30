package com.laveintedigital.app.updates

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches the latest release manifest from the server.
 *
 * [channel] determines which endpoint to query:
 *   stable  → /android/stable/latest.json
 *   beta    → /android/beta/latest.json
 *   dev     → /android/dev/latest.json
 */
object UpdateRepository {

    private const val TAG = "UpdateRepository"
    internal const val BASE_URL = "https://la-veinte-digital.vercel.app"

    suspend fun fetch(
        context: Context,
        channel: String = "stable",
    ): Result<UpdateManifest> = withContext(Dispatchers.IO) {
        try {
            val url = URL("$BASE_URL/android/$channel/latest.json")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            conn.requestMethod = "GET"
            if (conn.responseCode != 200) {
                return@withContext Result.failure(
                    Exception("Server returned ${conn.responseCode}")
                )
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val manifest = UpdateManifest.fromJson(JSONObject(body))

            val currentCode = context.packageManager
                .getPackageInfo(context.packageName, 0)
                .versionCode

            if (manifest.versionCode <= currentCode) {
                // Already up to date
                return@withContext Result.failure(
                    NoUpdateAvailableException(manifest)
                )
            }
            Result.success(manifest)
        } catch (e: NoUpdateAvailableException) {
            Result.failure(e)
        } catch (e: Exception) {
            Log.w(TAG, "Update check failed", e)
            Result.failure(e)
        }
    }
}

class NoUpdateAvailableException(val manifest: UpdateManifest) : Exception()
