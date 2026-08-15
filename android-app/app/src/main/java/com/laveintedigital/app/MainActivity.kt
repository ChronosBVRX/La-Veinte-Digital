package com.laveintedigital.app

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.compose.rememberNavController
import com.laveintedigital.app.intents.IntentLauncher
import com.laveintedigital.app.nav.AppNavHost
import com.laveintedigital.app.security.AppLockManager
import com.laveintedigital.app.security.BiometricPreferences
import com.laveintedigital.app.security.BiometricUnlockScreen
import com.laveintedigital.app.security.LockState
import com.laveintedigital.app.ui.theme.LaVeinteTheme
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateState
import android.widget.Toast
import kotlinx.coroutines.delay

class MainActivity : AppCompatActivity() {

    private var backgroundTimestamp: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        DeepLinkBus.dispatch(intent)
        setContent { MainScreen() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (AppLockManager.isLocked()) {
            AppLockManager.pendingDeepLink = intent.data?.toString()
        } else {
            DeepLinkBus.dispatch(intent)
        }
    }

    override fun onStart() {
        super.onStart()
        if (backgroundTimestamp > 0L) {
            val duration = System.currentTimeMillis() - backgroundTimestamp
            if (AppLockManager.shouldLockOnReturn(duration)) {
                AppLockManager.lock()
            }
        }
    }

    override fun onStop() {
        super.onStop()
        backgroundTimestamp = System.currentTimeMillis()
    }

    fun updateSecureFlags() {
        if (AppLockManager.isLocked() || AppLockManager.isUnlocking()) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}

@Composable
private fun MainScreen() {
    LaVeinteTheme {
        val context = androidx.compose.ui.platform.LocalContext.current
        val activity = context as MainActivity
        val navController = rememberNavController()
        val lockState by AppLockManager.state.collectAsState()
        var bootloaderDone by remember { mutableStateOf(false) }

        val biometricEnabled by BiometricPreferences.isEnabled(context).collectAsState(false)
        LaunchedEffect(biometricEnabled) {
            AppLockManager.isBiometricEnabled = biometricEnabled
        }

        LaunchedEffect(Unit) {
            while (true) {
                delay(30_000L)
                AppLockManager.tickForeground()
            }
        }

        DisposableEffect(lockState) {
            activity.updateSecureFlags()
            onDispose { }
        }

        // Bootloader Compose — runs as overlay, WebView loads underneath simultaneously
        if (!bootloaderDone) {
            LaunchedEffect(Unit) {
                delay(500)
                StartupCoordinator.advanceTo(StartupStage.UPDATE_CHECK)
                delay(600)
                StartupCoordinator.advanceTo(StartupStage.PREPARING_WEBVIEW)
                delay(400)
                StartupCoordinator.advanceTo(StartupStage.RESTORING_SESSION)
                delay(200)
                StartupCoordinator.advanceTo(StartupStage.SECURITY)
                if (AppLockManager.isBiometricEnabled) { delay(600) }
                StartupCoordinator.ready()
                bootloaderDone = true
            }
        }

        // Update check with the new coordinator
        val updateManager = remember { UpdateManager(channel = "stable") }
        val updateState by updateManager.state.collectAsState()
        val scope = rememberCoroutineScope()
        var checked by remember { mutableStateOf(false) }

        LaunchedEffect(bootloaderDone) {
            if (bootloaderDone && !checked) {
                checked = true
                updateManager.check(activity, scope)
            }
        }

        // Manual update trigger from web bridge
        val manualUpdateRequest by UpdateTrigger.pending.collectAsState()
        LaunchedEffect(manualUpdateRequest) {
            if (manualUpdateRequest) {
                UpdateTrigger.consume()
                updateManager.reset()
                updateManager.check(activity, scope)
                // Show checking feedback
                Toast.makeText(activity, "Buscando actualización...", Toast.LENGTH_SHORT).show()
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            AppNavHost(
                navController = navController,
                internalUrl = DEFAULT_URL,
                onCustomTab = { url -> IntentLauncher.launchCustomTab(activity, url) },
                onIntent = { url -> IntentLauncher.launchScheme(activity, url) },
            )

            if (lockState == LockState.LOCKED || lockState == LockState.UNLOCKING) {
                BiometricUnlockScreen(
                    onUnlocked = {
                        val pending = AppLockManager.pendingDeepLink
                        if (pending != null) {
                            AppLockManager.pendingDeepLink = null
                            DeepLinkBus.dispatch(Intent().apply { data = android.net.Uri.parse(pending) })
                        }
                        activity.updateSecureFlags()
                    },
                    onCancel = {
                        if (biometricEnabled) { } else { AppLockManager.unlock() }
                        activity.updateSecureFlags()
                    },
                    onNotAvailable = {
                        AppLockManager.unlock()
                        activity.updateSecureFlags()
                    },
                )
            }

            // Bootloader overlay — fades out revealing the already-loaded WebView underneath
            if (!bootloaderDone) {
                BootloaderScreen(onFinished = { bootloaderDone = true })
            }
        }

        // Update UI
        when (val st = updateState) {
            is UpdateState.Available -> {
                val manifest = st.manifest
                if (manifest.forceUpdate) {
                    ForceUpdateDialog(
                        manifest = manifest,
                        onDownload = { updateManager.download(activity, manifest, scope) },
                    )
                } else {
                    UpdateAvailableDialog(
                        manifest = manifest,
                        onDownload = { updateManager.download(activity, manifest, scope) },
                        onDismiss = { updateManager.reset() },
                    )
                }
            }
            is UpdateState.Downloading -> {
                DownloadingDialog(progress = st.progress)
            }
            is UpdateState.Verifying -> {
                VerifyingDialog()
            }
            is UpdateState.ReadyToInstall -> {
                ReadyToInstallDialog(
                    manifest = st.manifest,
                    onInstall = { updateManager.install(activity, st.manifest) },
                )
            }
            is UpdateState.Error -> {
                if (st.recoverable) {
                    androidx.compose.material3.AlertDialog(
                        onDismissRequest = { updateManager.reset() },
                        title = { androidx.compose.material3.Text("Error") },
                        text = { androidx.compose.material3.Text(st.message) },
                        confirmButton = {
                            androidx.compose.material3.TextButton(
                                onClick = { updateManager.reset() }
                            ) { androidx.compose.material3.Text("OK") }
                        },
                    )
                }
            }
            else -> {
                if (st is UpdateState.UpToDate && manualUpdateRequest) {
                    Toast.makeText(activity, "Ya tienes la última versión", Toast.LENGTH_SHORT).show()
                    updateManager.reset()
                }
            }
        }
    }
}

private const val DEFAULT_URL = "https://la-veinte-digital.vercel.app"
