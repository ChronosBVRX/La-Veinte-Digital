package com.laveintedigital.app.internal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Fuente única de versión: build.gradle.kts → BuildConfig.
 *
 * El script inyectado NO puede hardcodear versiones (antes '1.1.2'):
 * `window.LaVeinteApp.appVersion()` debe reflejar automáticamente el
 * versionName de cada compilación. Se verifica sobre el fuente porque
 * `bridgeScript()` interpola `android.os.Build` (no ejecutable en JVM pura).
 */
class BridgeVersionSourceTest {

    private fun injectorSource(): String {
        val rootDir = File(System.getProperty("user.dir") ?: ".")
        val file = if (File(rootDir, "app/src/main/java/com/laveintedigital/app/internal/LaVeinteBridgeInjector.kt").exists()) {
            File(rootDir, "app/src/main/java/com/laveintedigital/app/internal/LaVeinteBridgeInjector.kt")
        } else {
            File(rootDir, "src/main/java/com/laveintedigital/app/internal/LaVeinteBridgeInjector.kt")
        }
        assertTrue("LaVeinteBridgeInjector.kt must exist", file.exists())
        return file.readText()
    }

    @Test
    fun `bridge script has no hardcoded app version`() {
        val src = injectorSource()
        assertFalse(src.contains("return '1.1.2'"))
        assertFalse(src.contains("return '1.1.3'"))
        assertFalse(src.contains("return '1.1.4'"))
    }

    @Test
    fun `bridge script reports the canonical BuildConfig version`() {
        val src = injectorSource()
        assertTrue(src.contains("appVersion"))
        assertTrue(src.contains("BuildConfig.VERSION_NAME"))
    }

    @Test
    fun `no call site hardcodes a user agent version literal`() {
        // Pin: todo configureForLaVeinte debe recibir BuildConfig.VERSION_NAME.
        val rootDir = File(System.getProperty("user.dir") ?: ".")
        val srcDir = if (File(rootDir, "app/src/main").exists()) {
            File(rootDir, "app/src/main")
        } else {
            File(rootDir, "src/main")
        }
        val offenders = mutableListOf<String>()
        srcDir.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .forEach { file ->
                file.forEachLine { line ->
                    if (line.contains("configureForLaVeinte(\"")) {
                        offenders += "${file.name}: $line"
                    }
                }
            }
        assertTrue(
            "Hardcoded UA versions (use BuildConfig.VERSION_NAME): $offenders",
            offenders.isEmpty(),
        )
    }
}
