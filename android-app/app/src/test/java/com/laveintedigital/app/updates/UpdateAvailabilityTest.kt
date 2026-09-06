package com.laveintedigital.app.updates

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regla canónica de actualización: solo versionCode ordena.
 *
 * Casos de la publicación 1.1.4 (204): instalado 203 → hay update;
 * instalado 204 → actualizado.
 */
class UpdateAvailabilityTest {

    @Test
    fun `instalado 203 contra latest 204 informa actualizacion`() {
        assertTrue(isUpdateAvailable(latestVersionCode = 204, installedVersionCode = 203))
    }

    @Test
    fun `instalado 204 contra latest 204 indica actualizado`() {
        assertFalse(isUpdateAvailable(latestVersionCode = 204, installedVersionCode = 204))
    }

    @Test
    fun `instalado mas nuevo que latest no informa actualizacion`() {
        assertFalse(isUpdateAvailable(latestVersionCode = 203, installedVersionCode = 204))
    }

    @Test
    fun `versionName nunca decide por si solo`() {
        // Mismo versionCode con distinto versionName: sin actualización.
        assertFalse(isUpdateAvailable(latestVersionCode = 204, installedVersionCode = 204))
    }
}
