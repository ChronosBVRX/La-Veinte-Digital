package com.laveintedigital.app.updates

import org.json.JSONArray
import org.json.JSONObject

/**
 * Immutable model representing a release manifest from latest.json.
 * Tolerates unknown future fields gracefully.
 */
data class UpdateManifest(
    val channel: String,
    val versionCode: Int,
    val versionName: String,
    val minimumVersionCode: Int,
    val forceUpdate: Boolean,
    val publishedAt: String,
    val apk: ApkInfo,
    val releaseNotes: List<String>,
) {
    companion object {
        fun fromJson(json: JSONObject): UpdateManifest {
            val apk = json.getJSONObject("apk")
            val notes = mutableListOf<String>()
            val notesArray = json.optJSONArray("releaseNotes")
            if (notesArray != null) {
                for (i in 0 until notesArray.length()) {
                    notes.add(notesArray.getString(i))
                }
            }
            return UpdateManifest(
                channel = json.optString("channel", "stable"),
                versionCode = json.getInt("versionCode"),
                versionName = json.getString("versionName"),
                minimumVersionCode = json.optInt("minimumVersionCode", json.getInt("versionCode")),
                forceUpdate = json.optBoolean("forceUpdate", false),
                publishedAt = json.optString("publishedAt", ""),
                apk = ApkInfo(
                    url = apk.getString("url"),
                    sha256 = apk.optString("sha256", ""),
                    size = apk.optLong("size", 0L),
                ),
                releaseNotes = notes,
            )
        }
    }
}

data class ApkInfo(
    val url: String,
    val sha256: String,
    val size: Long,
)
