import java.util.Properties
import java.util.Base64

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

// Release signing — credentials from environment variables (never committed)
val keystoreBase64Env: String? = System.getenv("LAVEINTE_KEYSTORE_BASE64")
val keystorePasswordEnv: String? = System.getenv("LAVEINTE_KEYSTORE_PASSWORD")
val releaseKeyAliasEnv: String? = System.getenv("LAVEINTE_KEY_ALIAS")
val releaseKeyPasswordEnv: String? = System.getenv("LAVEINTE_KEY_PASSWORD")

android {
    namespace = "com.laveintedigital.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.laveintedigital.app"
        minSdk = 29
        targetSdk = 36
        versionCode = 202
        versionName = "1.1.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }
    }

    // Two independent distribution channels. `play` must comply with Google Play policy (no
    // self-update, no REQUEST_INSTALL_PACKAGES, no installer). `direct` is the sideload channel
    // that keeps the full self-update pipeline. The concrete behavior is chosen per source set via
    // `UpdateCoordinatorProvider` (`src/play`, `src/direct`), NOT scattered `if(BuildConfig)`.
    flavorDimensions += "distribution"
    productFlavors {
        create("play") {
            dimension = "distribution"
            buildConfigField("String", "DISTRIBUTION_CHANNEL", "\"play\"")
            buildConfigField("boolean", "SELF_UPDATE_ENABLED", "false")
        }
        create("direct") {
            dimension = "distribution"
            buildConfigField("String", "DISTRIBUTION_CHANNEL", "\"direct\"")
            buildConfigField("boolean", "SELF_UPDATE_ENABLED", "true")
        }
    }

    signingConfigs {
        create("release") {
            if (keystoreBase64Env != null && keystorePasswordEnv != null && releaseKeyAliasEnv != null && releaseKeyPasswordEnv != null) {
                val keystoreDir = File(rootDir, "build/keystore")
                keystoreDir.mkdirs()
                val keystoreFile = File(keystoreDir, "laveinte-release.jks")
                keystoreFile.outputStream().use { it.write(Base64.getDecoder().decode(keystoreBase64Env)) }
                storeFile = keystoreFile
                storePassword = keystorePasswordEnv
                keyAlias = releaseKeyAliasEnv
                keyPassword = releaseKeyPasswordEnv
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
            isDebuggable = true
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (keystoreBase64Env != null && keystorePasswordEnv != null && releaseKeyAliasEnv != null && releaseKeyPasswordEnv != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        create("releaseDebug") {
            initWith(buildTypes.getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    applicationVariants.all {
        outputs.all {
            // Only rename APK outputs; bundle (.aab) outputs do not expose outputFileName.
            if (outputFile?.name?.endsWith(".apk") == true) {
                (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName =
                    "LaVeinteDigital-${flavorName}-${buildType.name}-v${versionName}.apk"
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    // Release lint is enabled (see docs/store-readiness for the rationale).
    lint {
        checkReleaseBuilds = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

// ----------------------------------------------------------------------------------------------
// Distribution-policy validation: fails the build if the merged manifest drifts out of compliance.
//   play  → must NOT contain REQUEST_INSTALL_PACKAGES or the self-update receiver.
//   direct → MUST contain REQUEST_INSTALL_PACKAGES and the self-update receiver.
// This runs automatically as part of `check` and can be run alone via `validateDistributionPolicy*`.
// It inspects the FINAL merged manifest, so it is the source of truth for what a reviewer scans.
// ----------------------------------------------------------------------------------------------
androidComponents {
    onVariants { variant ->
        val variantName = variant.name
        val capitalized = variantName.replaceFirstChar { it.uppercase() }
        val taskName = "validateDistributionPolicy${capitalized}"
        val manifestPath = layout.buildDirectory.file(
            "intermediates/merged_manifests/$variantName/process${capitalized}Manifest/AndroidManifest.xml",
        )
        tasks.register(taskName) {
            group = "verification"
            description = "Assert the merged manifest respects the distribution-channel policy."
            dependsOn("process${capitalized}Manifest")
            doLast {
                val file = manifestPath.get().asFile
                if (!file.exists()) {
                    throw GradleException("Merged manifest not found for $variantName: $file")
                }
                val text = file.readText()
                val isPlay = variantName.startsWith("play")

                // Ignore the explanatory XML comments; strip comments before the real check.
                val noComments = text.replace(Regex("<!--[\\s\\S]*?-->"), "")
                val effectiveInstall = noComments.contains("android.permission.REQUEST_INSTALL_PACKAGES")
                val effectiveReceiver = noComments.matches(Regex(".*<receiver\\s+android:name=\"[^\"]*UpdateInstallReceiver\".*", RegexOption.DOT_MATCHES_ALL))

                if (isPlay) {
                    if (effectiveInstall || effectiveReceiver) {
                        throw GradleException(
                            "[POLICY FAIL] $variantName (Google Play) must NOT declare " +
                                "REQUEST_INSTALL_PACKAGES or register UpdateInstallReceiver.",
                        )
                    }
                } else {
                    if (!effectiveInstall || !effectiveReceiver) {
                        throw GradleException(
                            "[POLICY FAIL] $variantName (direct) MUST declare REQUEST_INSTALL_PACKAGES " +
                                "and register UpdateInstallReceiver.",
                        )
                    }
                }
                logger.lifecycle(
                    "[$taskName] OK: $variantName " +
                        "installPermission=$effectiveInstall receiver=$effectiveReceiver",
                )
            }
        }
    }
}

tasks.named("check") {
    dependsOn(tasks.matching { it.name.startsWith("validateDistributionPolicy") })
}

dependencies {
    // Firebase (FCM)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.biometric)
    implementation(libs.kotlinx.coroutines.android)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.animation)
    implementation(libs.material)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Testing
    testImplementation(libs.junit)
    testImplementation("org.json:json:20240303")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
}
