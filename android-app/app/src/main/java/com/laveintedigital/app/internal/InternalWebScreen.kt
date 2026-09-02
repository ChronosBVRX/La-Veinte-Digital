package com.laveintedigital.app.internal

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import androidx.activity.ComponentActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
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
import com.laveintedigital.app.security.BiometricPreferences
import com.laveintedigital.app.security.LaveinteBiometricManager
import com.laveintedigital.app.security.PermissionCoordinator
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary
import com.laveintedigital.app.util.configureForLaVeinte
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import android.util.Log
import java.util.concurrent.Executors
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun InternalWebScreen(
    initialUrl: String,
    onExternalNavigation: (NavigationTarget) -> Unit,
    onCustomTab: (String) -> Unit,
    onOpenOfficialPayslips: () -> Unit = {},
    onOpenBiometrics: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var initialLoadDone by remember { mutableStateOf(false) }
    var isOffline by remember { mutableStateOf(false) }
    var pendingFileCallback by remember { mutableStateOf<ValueCallback<Array<android.net.Uri>>?>(null) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    val activity = context as ComponentActivity

    // Enrollment state: show invitation dialog after web reports authenticated
    var showEnrollmentInvite by remember { mutableStateOf(false) }
    val enrollmentDone by BiometricPreferences.isEnabled(context).collectAsState(false)

    // Set up bridge handlers (reliable JS injection, no addJavascriptInterface)
    var pendingCameraReq by remember { mutableStateOf<String?>(null) }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        android.util.Log.i("PRINT_FLOW", "camera_result=$granted")
        val req = pendingCameraReq
        pendingCameraReq = null
        if (req != null) {
            pushBridgeResult(webView, req, JSONObject().put("granted", granted).toString())
        }
    }
    val cameraPermissionResolver = remember {
        object : (WebView?, String) -> Unit {
            override fun invoke(wv: WebView?, req: String) {
                val state = PermissionCoordinator.cameraState(activity)
                when (state) {
                    PermissionCoordinator.CameraState.GRANTED -> {
                        android.util.Log.i("PRINT_FLOW", "camera_permission=granted")
                        pushBridgeResult(wv, req, JSONObject().put("granted", true).toString())
                    }
                    PermissionCoordinator.CameraState.PERMANENTLY_DENIED -> {
                        android.util.Log.i("PRINT_FLOW", "camera_permission=permanently_denied")
                        pushBridgeResult(wv, req, JSONObject().put("granted", false).put("permanentlyDenied", true).toString())
                        // The web shows an "Abrir ajustes" path; do not auto-open Settings here so the
                        // user stays on the scanner screen and can decide.
                    }
                    PermissionCoordinator.CameraState.SHOW_REQUEST -> {
                        android.util.Log.i("PRINT_FLOW", "camera_permission=show_request")
                        PermissionCoordinator.markCameraAsked(activity)
                        pendingCameraReq = req
                        // Launch always on main thread; result is delivered via the launcher above.
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                }
            }
        }
    }

    val internalOrigin = remember(initialUrl) { laveinteOrigin(initialUrl) }

    // Pending "Imprimir" (send via QR): the native viewer stored the doc and popped back to this
    // WebView. When the WebView exists and the pending generation has not been consumed, load the
    // transfer send flow exactly once. No callback, no dependence on a live parent Composable.
    LaunchedEffect(webView) {
        val wv = webView ?: return@LaunchedEffect
        android.util.Log.i("PRINT_FLOW", "internal_recreated")
        val generation = com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.pendingGeneration()
        if (generation < 0L) return@LaunchedEffect
        if (com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.alreadyConsumed(generation)) {
            return@LaunchedEffect
        }
        if (com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.get() == null) {
            return@LaunchedEffect
        }
        com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.consume(generation)
        android.util.Log.i("PRINT_FLOW", "loading_transfer=${internalOrigin}/transfer?print=1")
        wv.post { wv.loadUrl("$internalOrigin/transfer?print=1") }
    }

    DisposableEffect(Unit) {
        BridgeHandler.onOpenOfficialPayslips = { onOpenOfficialPayslips() }
        BridgeHandler.onOpenBiometrics = { onOpenBiometrics() }
        BridgeHandler.onCheckForUpdate = { UpdateTrigger.request() }
        BridgeHandler.onRequestNotificationsPermission = {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                PermissionCoordinator.requestNotificationsFromSettings(activity)
            }
        }
        BridgeHandler.onOpenAppSettings = { PermissionCoordinator.openAppSettings(activity) }
        BridgeHandler.onRequestCameraPermission = cameraPermissionResolver
        BridgeHandler.onListNativeDocuments = { wv, req ->
            scope.launch {
                val payload = runCatching { com.laveintedigital.app.imss.payslips.NativeDocuments.list(context).toString() }
                    .getOrDefault("[]")
                pushBridgeResult(wv, req, payload)
            }
        }
        BridgeHandler.onReadNativeDocument = { wv, req, path ->
            scope.launch {
                val payload = runCatching {
                    val doc = com.laveintedigital.app.imss.payslips.NativeDocuments.read(context, path)
                    doc?.toString() ?: "null"
                }.getOrDefault("null")
                pushBridgeResult(wv, req, payload)
            }
        }
        BridgeHandler.onGetPendingPrintDoc = { wv, req ->
            scope.launch {
                val payload = runCatching {
                    val path = com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.get()
                    if (path == null) "null"
                    else JSONObject().put("localPath", path).toString()
                }.getOrDefault("null")
                pushBridgeResult(wv, req, payload)
            }
        }
        BridgeHandler.onDeleteNativeDocument = { wv, req, path ->
            scope.launch {
                val payload = runCatching {
                    com.laveintedigital.app.imss.payslips.NativeDocuments.delete(context, path).toString()
                }.getOrDefault("false")
                pushBridgeResult(wv, req, payload)
            }
        }
        BridgeHandler.onGetFcmToken = { wv, req ->
            val token = com.laveintedigital.app.push.PushTokenStore.getToken(context) ?: ""
            org.json.JSONObject().put("token", token).let { pushBridgeResult(wv, req, it.toString()) }
        }
        BridgeHandler.onShare = { title, text ->
            runCatching {
                val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(android.content.Intent.EXTRA_TITLE, title)
                    putExtra(android.content.Intent.EXTRA_TEXT, text ?: title)
                }
                context.startActivity(android.content.Intent.createChooser(intent, title ?: "Compartir"))
            }
        }
        BridgeHandler.onShareNativeDocument = { path, title ->
            runCatching {
                if (path.isBlank()) {
                    android.widget.Toast.makeText(context, "Ruta de documento no válida", android.widget.Toast.LENGTH_SHORT).show()
                    return@runCatching
                }
                val base = context.filesDir.canonicalFile
                val file = runCatching { java.io.File(path).canonicalFile }.getOrNull()
                if (file == null || !file.path.startsWith(base.path) || !file.exists()) {
                    android.widget.Toast.makeText(context, "No se encontró el archivo del documento", android.widget.Toast.LENGTH_SHORT).show()
                    return@runCatching
                }
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
                val shareTitle = title ?: file.name
                val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                    type = "application/pdf"
                    putExtra(android.content.Intent.EXTRA_STREAM, uri)
                    putExtra(android.content.Intent.EXTRA_TITLE, shareTitle)
                    clipData = android.content.ClipData.newRawUri(shareTitle, uri)
                    addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val chooser = android.content.Intent.createChooser(intent, shareTitle).apply {
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(chooser)
            }.onFailure { e ->
                android.util.Log.e("InternalWebScreen", "shareNativeDocument failed", e)
                android.widget.Toast.makeText(context, "No se pudo compartir el archivo", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
        BridgeHandler.onAuthenticated = {
            if (!enrollmentDone && LaveinteBiometricManager.canAuthenticate(context)) {
                showEnrollmentInvite = true
            }
        }
        BridgeHandler.onLoggedOut = {
            showEnrollmentInvite = false
            AppLockManager.pendingDeepLink = null
            scope.launch {
                BiometricPreferences.clearLegacyEnrollment(context)
                BiometricPreferences.setEnabled(context, false)
            }
        }
        onDispose {
            BridgeHandler.onOpenOfficialPayslips = null
            BridgeHandler.onOpenBiometrics = null
            BridgeHandler.onCheckForUpdate = null
            BridgeHandler.onAuthenticated = null
            BridgeHandler.onLoggedOut = null
            BridgeHandler.onRequestCameraPermission = null
            BridgeHandler.onRequestNotificationsPermission = null
            BridgeHandler.onOpenAppSettings = null
            BridgeHandler.onListNativeDocuments = null
            BridgeHandler.onReadNativeDocument = null
            BridgeHandler.onDeleteNativeDocument = null
            BridgeHandler.onGetFcmToken = null
            BridgeHandler.onGetPendingPrintDoc = null
            BridgeHandler.onShare = null
            BridgeHandler.onShareNativeDocument = null
        }
    }

    val chromeClient = remember {
        LaVeinteChromeClient().also { it.attachActivity(activity) }
    }

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
            android.util.Log.i("PRINT_FLOW", "web_permission_granted resources=${request.resources?.joinToString(",")}")
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
        val url = uri.toString()
        // Security: never feed an externally-authored deep link straight into the privileged internal
        // WebView. Only our own `laveinte://` bridge protocol and https deep links on OUR OWN domain
        // (verified App Link / OAuth callback) are allowed. This blocks `file://`, `javascript://`,
        // `content://`, arbitrary custom schemes and any https host we do not own.
        if (isDeepLinkLoadAllowed(uri.scheme, uri.host, url)) {
            webView?.loadUrl(url)
        } else {
            android.util.Log.w(InternalWebScreenTAG, "Ignoring deep link with disallowed scheme/host: ${uri.scheme}://${uri.host}")
        }
    }

    // Back press: WebView history first, then let the system handle (exit / NavHost pop)
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

        // Biometric enrollment invitation — shown once after first login. Runs a REAL
        // BiometricPrompt; only onAuthenticationSucceeded persists biometric_enabled=true.
        if (showEnrollmentInvite) {
            val enrollmentPrompt = remember {
                runCatching {
                    val fragActivity = context as FragmentActivity
                    BiometricPrompt(
                        fragActivity,
                        Executors.newSingleThreadExecutor(),
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                Log.d("APP_LOCK", "APP_LOCK enrollment_success")
                                scope.launch { BiometricPreferences.setEnabled(context, true) }
                            }
                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                Log.w("APP_LOCK", "APP_LOCK enrollment_error=$errorCode")
                            }
                            override fun onAuthenticationFailed() {}
                        },
                    )
                }.getOrNull()
            }
            val enrollmentPromptInfo = remember {
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Protege La Veinte Digital")
                    .setSubtitle("Usa tu huella, rostro o bloqueo seguro para proteger tu información")
                    .setAllowedAuthenticators(LaveinteBiometricManager.ALLOWED_AUTHENTICATORS)
                    .build()
            }

            androidx.compose.material3.AlertDialog(
                onDismissRequest = { showEnrollmentInvite = false },
                title = { Text("Protege La Veinte Digital") },
                text = {
                    Text(
                        "Usa la huella, el rostro o el bloqueo seguro de tu teléfono para proteger " +
                        "tu información. No guardamos tu contraseña."
                    )
                },
                confirmButton = {
                    androidx.compose.material3.TextButton(
                        onClick = {
                            showEnrollmentInvite = false
                            val p = enrollmentPrompt
                            if (p != null) {
                                runCatching { p.authenticate(enrollmentPromptInfo) }
                                    .onFailure { Log.w("APP_LOCK", "APP_LOCK enrollment_prompt_failed", it) }
                            }
                        }
                    ) { Text("Activar") }
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
                    // Inject the native bridge at DOCUMENT START so it exists before Next.js hydrates,
                    // removing the bridge-missing race in the QR scanner. Falls back to onPageFinished.
                    LaVeinteBridgeInjector.installAtDocumentStart(wv)
                    loadUrl(initialUrl)
                }.also { webView = it }
            },
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
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

/**
 * Pushes an async bridge result to the page. [payload] is a JSON string (e.g. from JSONObject) and
 * is delivered as a JavaScript string so `JSON.parse` on the JS side reconstructs it. Using
 * [JSONObject.quote] escapes the JSON into a valid JS string literal, preventing `'`, `"`, `\n`,
 * base64 `/+=\n` etc. from corrupting the `evaluateJavascript` expression (which previously left the
 * Promise pending forever → the scanner stuck on "Preparando…").
 */
internal fun pushBridgeResult(wv: WebView?, req: String, payload: String) {
    val js = bridgeResultJs(req, payload)
    wv?.post { wv.evaluateJavascript(js, null) }
}

/** Pure pure-JVM builder of the JS expression, kept separate so it is unit-testable. */
internal fun bridgeResultJs(req: String, payload: String): String =
    "window.__laveinteBridgeResult(${JSONObject.quote(req)}, ${JSONObject.quote(payload)})"

/**
 * Builds the origin (scheme://authority) of an internal URL. Given
 * `https://la-veinte-digital.vercel.app` this returns `https://la-veinte-digital.vercel.app`
 * — `substringBeforeLast('/')` is NOT suitable because it corrupts a bare origin into `https:/`.
 *
 * Implemented with plain string parsing (no android.net.Uri) so it is deterministic and unit-testable
 * on the JVM. Accepts URLs with or without a path.
 */
internal fun laveinteOrigin(rawUrl: String): String {
    val trimmed = rawUrl.trim()
    val noTrailing = trimmed.trimEnd('/')
    // If there's a scheme:// prefix, take scheme + authority only.
    val schemeMatch = Regex("^(https?|laveinte)://").find(noTrailing)
    if (schemeMatch == null) {
        // Already a bare host/authority, or a path-only input → return as is.
        return noTrailing
    }
    val scheme = schemeMatch.value.removeSuffix("://")
    val rest = noTrailing.substring(schemeMatch.range.last + 1)
    val authority = rest.substringBefore('/')
    return "$scheme://$authority"
}

private const val InternalWebScreenTAG = "InternalWebScreen"
