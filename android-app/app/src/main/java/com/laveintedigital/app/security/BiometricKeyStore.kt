package com.laveintedigital.app.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Manages an AES/GCM key inside Android Keystore that requires user authentication.
 * The key is non-exportable and bound to biometric (or device credential fallback
 * for API < 30, but we only use BIOMETRIC_STRONG on 29+).
 */
object BiometricKeyStore {

    private const val KEY_ALIAS = "laveinte_biometric_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val GCM_TAG_LENGTH = 128

    fun createKey(timeoutSeconds: Int = 0): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE,
        )
        val specBuilder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setUnlockedDeviceRequired(true)

        // On API 30+ we can set validity duration; on API 28-29 we use 0
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            specBuilder.setUserAuthenticationParameters(
                timeoutSeconds,
                KeyProperties.AUTH_BIOMETRIC_STRONG,
            )
        } else {
            specBuilder.setUserAuthenticationValidityDurationSeconds(timeoutSeconds)
        }
        keyGenerator.init(specBuilder.build())
        return keyGenerator.generateKey()
    }

    fun getSecretKey(): SecretKey? {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        return keyStore.getKey(KEY_ALIAS, null) as? SecretKey
    }

    fun deleteKey() {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        keyStore.deleteEntry(KEY_ALIAS)
    }

    fun encrypt(plaintext: ByteArray): Pair<ByteArray, ByteArray> {
        val key = getSecretKey() ?: throw IllegalStateException("Keystore key not found")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext)
        return ciphertext to iv
    }

    fun decrypt(ciphertext: ByteArray, iv: ByteArray): ByteArray {
        val key = getSecretKey() ?: throw IllegalStateException("Keystore key not found")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return cipher.doFinal(ciphertext)
    }

    /**
     * Returns a [Cipher] initialized for decryption, wrapped in a [CryptoObject]-compatible
     * form. The caller must pass this to [androidx.biometric.BiometricPrompt].
     */
    fun getDecryptCipher(): Cipher {
        val key = getSecretKey() ?: throw IllegalStateException("Keystore key not found")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key)
        return cipher
    }
}
