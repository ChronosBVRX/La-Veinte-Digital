package com.laveintedigital.app

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import com.laveintedigital.app.security.LaveinteBiometricManager
import com.laveintedigital.app.security.LockState
import com.laveintedigital.app.security.PermissionCoordinator
import com.laveintedigital.app.ui.theme.LaVeinteTheme
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.updates.UpdateState
import android.widget.Toast
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.delay

class MainActivity : AppCompatActivity() {

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
        if (!AppLockManager.isUnlocked()) {
            AppLockManager.pendingDeepLink = intent.data?.toString()
        } else {
            DeepLinkBus.dispatch(intent)
        }
    }

    override fun onStart() {
        super.onStart()
        AppLockManager.onAppForeground()
    }

    override fun onStop() {
        super.onStop()
        AppLockManager.onAppBackground()
    }

    fun updateSecureFlags() {
        if (AppLockManager.isUnlocked()) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
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

        // Cold start: read once and seed the lock. A fresh process is always a fresh lock when
        // enabled; disabled → open. This runs once, so enabling biometrics mid-session does not
        // immediately re-lock while the user keeps working.
        LaunchedEffect(Unit) {
            var enabled = BiometricPreferences.isEnabled(context).first()
            // Safe migration: if a previous enrollment is no longer usable on this device (no
            // biometric AND no secure credential), disable it rather than locking the user out.
            if (enabled && !LaveinteBiometricManager.canAuthenticate(context)) {
                BiometricPreferences.setEnabled(context, false)
                enabled = false
            }
            AppLockManager.init(enabled)
        }

        DisposableEffect(lockState) {
            activity.updateSecureFlags()
            onDispose { }
        }

        // Boot loader — runs once. Private content (AppNavHost/WebView) only mounts after UNLOCKED.
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
                StartupCoordinator.ready()
                bootloaderDone = true
            }
        }

        // Update check
        val updateManager = remember { UpdateManager(channel = "stable") }
        val updateState by updateManager.state.collectAsState()
        val scope = rememberCoroutineScope()
        var checked by remember { mutableStateOf(false) }

        // POST_NOTIFICATIONS (Android 13+) — ask once, after the boot loader.
        val notificationsLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission(),
        ) { /* result intentionally ignored; channel is created regardless */ }
        LaunchedEffect(bootloaderDone) {
            if (bootloaderDone) {
                PermissionCoordinator.maybeRequestNotifications(activity) { perm ->
                    notificationsLauncher.launch(perm)
                }
            }
        }

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
                Toast.makeText(activity, "Buscando actualización...", Toast.LENGTH_SHORT).show()
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            // Private content mounts ONLY after a successful unlock (avoids flashing private info).
            if (lockState == LockState.UNLOCKED) {
                AppNavHost(
                    navController = navController,
                    internalUrl = DEFAULT_URL,
                    onCustomTab = { url -> IntentLauncher.launchCustomTab(activity, url) },
                    onIntent = { url -> IntentLauncher.launchScheme(activity, url) },
                )
            }

            if (lockState != LockState.UNLOCKED) {
                BiometricUnlockScreen(
                    onUnlocked = {
                        val pending = AppLockManager.pendingDeepLink
                        if (pending != null) {
                            AppLockManager.pendingDeepLink = null
                            DeepLinkBus.dispatch(Intent().apply { data = android.net.Uri.parse(pending) })
                        }
                        // FLAG_SECURE is handled reactively by DisposableEffect(lockState) on the
                        // main thread; touching the window here would come from the biometric
                        // callback's background thread and crash (CalledFromWrongThreadException).
                    },
                )
            }

            // Boot loader overlay — fades out revealing the app once unlocked.
            if (!bootloaderDone) {
                BootloaderScreen(onFinished = { bootloaderDone = true })
            }
        }

        // Update UI — only relevant once the app is unlocked.
        if (lockState == LockState.UNLOCKED) {
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
                is UpdateState.Downloading -> DownloadingDialog(progress = st.progress)
                is UpdateState.Verifying -> VerifyingDialog()
                is UpdateState.ReadyToInstall -> ReadyToInstallDialog(
                    manifest = st.manifest,
                    onInstall = { updateManager.install(activity, st.manifest) },
                )
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
}

private const val DEFAULT_URL = "https://la-veinte-digital.vercel.app"
