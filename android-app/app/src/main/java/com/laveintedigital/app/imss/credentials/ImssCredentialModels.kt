package com.laveintedigital.app.imss.credentials

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Metadata for an IMSS credential vault entry.
 * The actual ciphertext and IV are stored in DataStore, not Room.
 */
@Entity(tableName = "imss_credentials")
data class ImssCredentialEntity(
    @PrimaryKey val portalId: String,  // "tuperfil" or "tarjetondigital"
    val credentialVersion: Int = 1,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

enum class ImssPortal(val id: String, val displayName: String, val host: String) {
    TU_PERFIL("tuperfil", "Tu Perfil IMSS", "tuperfil.imss.gob.mx"),
    TARJETON_DIGITAL("tarjetondigital", "Tarjetón Digital IMSS", "rh.imss.gob.mx"),
}

data class ImssCredentialPayload(
    val username: String,
    val password: String,
    val credentialVersion: Int = 1,
    /** Tarjetón Digital: valor real del `<option>` de Delegación (ej. "17"). */
    val delegacionValue: String? = null,
    /** Tarjetón Digital: nombre visible de la delegación (ej. "MICHOACAN"). */
    val delegacionLabel: String? = null,
)
