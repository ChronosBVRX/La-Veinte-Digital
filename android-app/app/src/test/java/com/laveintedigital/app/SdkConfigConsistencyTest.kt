package com.laveintedigital.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SdkConfigConsistencyTest {

    @Test
    fun `build gradle contains expected SDK versions`() {
        val rootDir = File(System.getProperty("user.dir") ?: ".")
        // Locate build.gradle.kts
        val gradleFile = if (File(rootDir, "app/build.gradle.kts").exists()) {
            File(rootDir, "app/build.gradle.kts")
        } else {
            File(rootDir, "build.gradle.kts")
        }

        assertTrue("build.gradle.kts must exist", gradleFile.exists())
        val content = gradleFile.readText()

        assertTrue("compileSdk must be 36", content.contains("compileSdk = 36"))
        assertTrue("minSdk must be 29", content.contains("minSdk = 29"))
        assertTrue("targetSdk must be 36", content.contains("targetSdk = 36"))
        assertTrue("versionCode must be 199", content.contains("versionCode = 199"))
    }
}
