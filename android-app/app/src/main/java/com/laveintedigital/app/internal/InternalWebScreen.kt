package com.laveintedigital.app.internal

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import androidx.activity.ComponentActivity
import androidx.core.content.ContextCompat
import android.graphics.Color as AndroidColor
import android.webkit.CookieManager
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.laveintedigital.app.DeepLinkBus
import com.laveintedigital.app.OfflineErrorScreen
import com.laveintedigital.app.UpdateTrigger
import com.laveintedigital.app.R
import com.laveintedigital.app.downloads.attachDownloadListener
import com.laveintedigital.app.routing.NavigationTarget
import com.laveintedigital.app.security.AppLockManager
import com.laveintedigital.app.security.BiometricKeyStore
import com.laveintedigital.app.security.BiometricPreferences
import com.laveintedigital.app.security.LaveinteBiometricManager
import com.laveintedigital.app.security.BiometricEnrollment
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary
import com.laveintedigital.app.util.configureForLaVeinte
import kotlinx.coroutines.launch

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun InternalWebScreen(
    initialUrl: String,
    onExternalNavigation: (NavigationTarget) -> Unit,
    onCustomTab: (String) -> Unit,
    onOpenOfficialPayslips: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var initialLoadDone by remember { mutableStateOf(false) }
    var isOffline by remember { mutableStateOf(false) }
    var pendingFileCallback by remember { mutableStateOf<ValueCallback<Array<android.net.Uri>>?>(null) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    // Enrollment state: show invitation dialog after web reports authenticated
    var showEnrollmentInvite by remember { mutableStateOf(false) }
    val enrollmentDone by BiometricPreferences.isEnabled(context).collectAsState(false)

    // Set up bridge handlers (reliable JS injection, no addJavascriptInterface)
    DisposableEffect(Unit) {
        BridgeHandler.onOpenOfficialPayslips = { onOpenOfficialPayslips() }
        BridgeHandler.onCheckForUpdate = { UpdateTrigger.request() }
        BridgeHandler.onAuthenticated = {
            if (!enrollmentDone && LaveinteBiometricManager.canAuthenticateStrong(context)) {
                showEnrollmentInvite = true
            }
        }
        BridgeHandler.onLoggedOut = {
            scope.launch {
                try { BiometricKeyStore.deleteKey() } catch (_: Exception) {}
                BiometricPreferences.clearAll(context)
            }
            AppLockManager.lock()
            showEnrollmentInvite = false
        }
        onDispose {
            BridgeHandler.onOpenOfficialPayslips = null
            BridgeHandler.onCheckForUpdate = null
            BridgeHandler.onAuthenticated = null
            BridgeHandler.onLoggedOut = null
        }
    }

    val chromeClient = remember { LaVeinteChromeClient() }

    val fileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        pendingFileCallback?.onReceiveValue(uris)
        pendingFileCallback = null
    }

    // A pending WebView permission request (e.g. getUserMedia camera) awaiting the runtime grant.
    var pendingWebPermission by remember { mutableStateOf<PermissionRequest?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        val request = pendingWebPermission
        pendingWebPermission = null
        if (request != null) {
            val allGranted = grants.values.all { it } || grants.isEmpty()
            if (allGranted) request.grant(request.resources) else request.deny()
        }
    }

    chromeClient.onWebPermissionRequest = { request ->
        val needed = request.resources
            .mapNotNull { it.toRuntimePermission() }
            .toSet()
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            request.grant(request.resources)
        } else {
            pendingWebPermission = request
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    chromeClient.onLaunchFilePicker = { callback, params ->
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = callback
        val intent = params?.createIntent()
        if (intent != null) {
            try {
                fileLauncher.launch(intent)
                true
            } catch (e: android.content.ActivityNotFoundException) {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = null
                false
            }
        } else {
            false
        }
    }

    val deepLink by DeepLinkBus.uri.collectAsState()
    LaunchedEffect(deepLink) {
        val uri = deepLink ?: return@LaunchedEffect
        DeepLinkBus.consume()
        webView?.loadUrl(uri.toString())
    }

    // Back press: WebView history first, then let the system handle (exit / NavHost pop)
    val activity = LocalContext.current as ComponentActivity
    DisposableEffect(activity) {
        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView?.canGoBack() == true) {
                    webView?.goBack()
                } else {
                    isEnabled = false
                    activity.onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        }
        activity.onBackPressedDispatcher.addCallback(callback)
        onDispose { callback.remove() }
    }

    DisposableEffect(Unit) {
        onDispose {
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.horizontalGradient(
                    colors = listOf(BrandNavy, BrandBlue),
                )
            ),
    ) {
        // Branded loading screen — only on initial load, not during navigation
        AnimatedVisibility(
            visible = !initialLoadDone,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize().align(Alignment.Center),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(BrandNavy, BrandBlue),
                        )
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Image(
                        painter = painterResource(R.drawable.splash_logo),
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.size(100.dp),
                    )
                    Spacer(Modifier.height(24.dp))
                    Text(
                        text = "La Veinte Digital",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        letterSpacing = 1.sp,
                    )
                    Spacer(Modifier.height(20.dp))
                    LinearProgressIndicator(
                        color = Color.White.copy(alpha = 0.5f),
                        trackColor = Color.White.copy(alpha = 0.1f),
                    )
                }
            }
        }

        // Biometric enrollment invitation — shown once after first login
        if (showEnrollmentInvite) {
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { showEnrollmentInvite = false },
                title = { Text("Acceso más rápido") },
                text = {
                    Text(
                        "Usa tu huella o rostro para proteger y abrir La Veinte Digital. " +
                        "No guardamos tu contraseña."
                    )
                },
                confirmButton = {
                    androidx.compose.material3.TextButton(
                        onClick = {
                            showEnrollmentInvite = false
                            scope.launch {
                                try {
                                BiometricKeyStore.createKey()
                                val secret = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
                                val (ct, iv) = BiometricKeyStore.encrypt(secret)
                                BiometricPreferences.saveEnrollment(
                                    context,
                                    BiometricEnrollment(ct, iv, System.currentTimeMillis())
                                )
                                } catch (_: Exception) {
                                    // Enrollment failed silently — user can retry later
                                }
                            }
                        }
                    ) { Text("Activar biometría") }
                },
                dismissButton = {
                    androidx.compose.material3.TextButton(
                        onClick = { showEnrollmentInvite = false }
                    ) { Text("Ahora no") }
                },
            )
        }

        // WebView
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    val wv = this
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    setBackgroundColor(AndroidColor.WHITE)
                    settings.configureForLaVeinte("1.0.0")
                    CookieManager.getInstance().apply {
                        setAcceptCookie(true)
                        setAcceptThirdPartyCookies(wv, true)
                    }
                    webViewClient = LaVeinteInternalWebViewClient(
                        onExternalNavigation = onExternalNavigation,
                        onCustomTab = onCustomTab,
                        onUrlChanged = {},
                        onTitleChanged = {},
                        onPageLoadStateChanged = { loading ->
                            isLoading = loading
                            if (!loading && !initialLoadDone) initialLoadDone = true
                            isOffline = false
                        },
                        onSslError = {},
                        onOffline = { isOffline = true },
                    )
                    webChromeClient = chromeClient
                    attachDownloadListener(ctx)
                    loadUrl(initialUrl)
                }.also { webView = it }
            },
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
        )

        if (isLoading && initialLoadDone) {
            LinearProgressIndicator(
                modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding(),
                color = Primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }

        if (isOffline && initialLoadDone) {
            OfflineErrorScreen(
                onRetry = {
                    isOffline = false
                    webView?.reload()
                },
            )
        }
    }
}

// Maps a WebView permission resource to the Android runtime permission it requires.
private fun String.toRuntimePermission(): String? =
    when (this) {
        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
        else -> null
    }
