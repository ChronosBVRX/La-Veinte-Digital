package com.laveintedigital.app.updates

import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Verifies an APK file's integrity against the expected SHA-256 from the manifest.
 */
object ApkVerifier {

    private const val TAG = "ApkVerifier"

    fun verify(file: File, expectedSha256: String): Boolean {
        if (expectedSha256.isBlank()) {
            Log.w(TAG, "No expected SHA-256 provided, skipping verification")
            return false
        }
        val actual = sha256(file)
        val match = actual.equals(expectedSha256, ignoreCase = true)
        if (!match) {
            Log.e(TAG, "SHA-256 mismatch: expected=$expectedSha256 actual=$actual")
        }
        return match
    }

    fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (input.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
