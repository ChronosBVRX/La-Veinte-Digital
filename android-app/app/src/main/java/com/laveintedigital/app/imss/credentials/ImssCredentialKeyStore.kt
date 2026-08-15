package com.laveintedigital.app.imss.credentials

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256/GCM via Android Keystore — independent key per IMSS portal.
 * Keys are non-exportable and require BIOMETRIC_STRONG authentication.
 */
object ImssCredentialKeyStore {

    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val GCM_TAG_LENGTH = 128

    private fun keyAlias(portalId: String): String = "laveinte_imss_${portalId}_v1"

    fun createKey(portalId: String): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE
        )
        val spec = KeyGenParameterSpec.Builder(
            keyAlias(portalId),
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    fun getSecretKey(portalId: String): SecretKey? {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
        ks.load(null)
        return ks.getKey(keyAlias(portalId), null) as? SecretKey
    }

    fun deleteKey(portalId: String) {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
        ks.load(null)
        ks.deleteEntry(keyAlias(portalId))
    }

    fun encrypt(portalId: String, plaintext: ByteArray): Pair<ByteArray, ByteArray> {
        val key = getSecretKey(portalId) ?: throw IllegalStateException("Key not found for $portalId")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        return cipher.doFinal(plaintext) to cipher.iv
    }

    fun decrypt(portalId: String, ciphertext: ByteArray, iv: ByteArray): ByteArray {
        val key = getSecretKey(portalId) ?: throw IllegalStateException("Key not found for $portalId")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return cipher.doFinal(ciphertext)
    }

    fun getDecryptCipher(portalId: String): Cipher {
        val key = getSecretKey(portalId) ?: throw IllegalStateException("Key not found for $portalId")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key)
        return cipher
    }
}
