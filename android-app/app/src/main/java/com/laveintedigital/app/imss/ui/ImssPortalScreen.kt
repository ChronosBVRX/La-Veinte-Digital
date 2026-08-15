package com.laveintedigital.app.imss.ui

import android.annotation.SuppressLint
import android.util.Log
import android.view.ViewGroup
import android.webkit.*
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.portal.*
import com.laveintedigital.app.imss.tarjeton.*
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdLoadingState
import com.laveintedigital.app.ui.lvd.LvdTopBar
import com.laveintedigital.app.util.configureForLaVeinte
import kotlinx.coroutines.*

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ImssPortalScreen(
    portal: ImssPortal,
    autoLogin: Boolean = false,
    onBack: () -> Unit,
    onClose: () -> Unit,
    onOpenHistory: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)
    var webView by remember { mutableStateOf<WebView?>(null) }
    var pdfMonitorInstalled by remember { mutableStateOf(false) }
    var localPdfPath by rememberSaveable { mutableStateOf<String?>(null) }

    // Closes ONLY the local viewer overlay. Never pops the NavHost nor finishes the Activity.
    fun closeLocalViewer(reason: String) {
        if (localPdfPath != null) {
            if (com.laveintedigital.app.BuildConfig.DEBUG) Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_CLOSE reason=$reason")
            localPdfPath = null
        }
    }

    // For Tu Perfil, use the new flow controller
    val flowController = remember {
        if (portal == ImssPortal.TU_PERFIL) TuPerfilFlowController(scope, context) else null
    }
    val flowState by (flowController?.state?.collectAsState() ?: remember { mutableStateOf(null as TuPerfilFlowState?) })

    // For Tarjetón Digital, use its dedicated flow controller
    val tarjetonController = remember {
        if (portal == ImssPortal.TARJETON_DIGITAL) TarjetonDigitalFlowController(scope, context) else null
    }
    val tarjetonState by (tarjetonController?.state?.collectAsState()
        ?: remember { mutableStateOf(null as TarjetonDigitalFlowState?) })

    val loginUrl = when (portal) {
        ImssPortal.TU_PERFIL -> "https://tuperfil.imss.gob.mx/guitpei-web/login"
        ImssPortal.TARJETON_DIGITAL -> "https://rh.imss.gob.mx/Personal/TarjetonDigital/"
    }

    // Tarjeton overlay state (for Tu Perfil)
    var cardPageDetected by remember { mutableStateOf(false) }
    var ooadOptions by remember { mutableStateOf<List<PortalOoad>>(emptyList()) }
    var selectedOoad by remember { mutableStateOf<PortalOoad?>(null) }
    var periodOptions by remember { mutableStateOf<List<ImssPeriodOption>>(emptyList()) }
    var selectedPeriod by remember { mutableStateOf<ImssPeriodOption?>(null) }

    // Login dialog state
    var showLoginDialog by remember { mutableStateOf(false) }
    var showManualFallback by remember { mutableStateOf(false) }

    // Tarjetón Digital UI state
    var showTarjetonLoginDialog by remember { mutableStateOf(false) }
    var tarjetonTipo by remember { mutableStateOf(TarjetonDigitalFlowController.TarjetonTipo.TARJETON) }
    var tarjetonRawFormVisible by remember { mutableStateOf(false) }

    // Fallback timer: if login flow takes >10s, offer manual entry
    LaunchedEffect(flowState) {
        if (flowState is TuPerfilFlowState.LoadingLoginPage ||
            flowState is TuPerfilFlowState.ApplyingCredentials ||
            flowState is TuPerfilFlowState.SubmittingLogin ||
            flowState is TuPerfilFlowState.WaitingAuthentication) {
            showManualFallback = false
            delay(10_000)
            if (flowController?.state?.value is TuPerfilFlowState.WaitingAuthentication ||
                flowController?.state?.value is TuPerfilFlowState.ApplyingCredentials ||
                flowController?.state?.value is TuPerfilFlowState.LoadingLoginPage) {
                showManualFallback = true
            }
        } else {
            showManualFallback = false
        }
    }

    // Start the Tu Perfil flow
    LaunchedEffect(Unit) {
        if (portal == ImssPortal.TU_PERFIL) {
            flowController?.start()
        }
    }

    // Start the Tarjetón Digital flow
    LaunchedEffect(Unit) {
        if (portal == ImssPortal.TARJETON_DIGITAL) {
            tarjetonController?.start()
        }
    }

    // Auto-login for Tarjeton Digital (old flow)
    LaunchedEffect(autoLogin) {
        if (autoLogin && portal == ImssPortal.TARJETON_DIGITAL) {
            // Existing Tarjeton Digital flow
        }
    }

    // Single PDF poll loop — runs while the WebView is alive
    LaunchedEffect(webView) {
        val wv = webView ?: return@LaunchedEffect
        while (isActive) {
            delay(2000)
            try {
                ImssPdfCaptureCoordinator.pollPdfCandidates(wv, context, portal, scope) { event ->
                    when (event) {
                        is ImssPdfCaptureCoordinator.PdfCaptureEvent.PdfDetected -> {
                            if (event.sequence == 1) flowController?.markSaving()
                        }
                        is ImssPdfCaptureCoordinator.PdfCaptureEvent.TarjetonSaved -> {
                            val s = ImssPdfCaptureCoordinator.activeSession
                            if (s != null) {
                                flowController?.markTarjetonSaved(TuPerfilFlowController.TarjetonSavedInfo(
                                    documentId = event.documentId,
                                    localPath = event.localPath,
                                    wasDuplicate = event.wasDuplicate,
                                    ooadLabel = s.ooadLabel,
                                    periodLabel = s.periodLabel,
                                ))
                                if (event.localPath.isNotBlank()) {
                                    if (com.laveintedigital.app.BuildConfig.DEBUG) {
                                        Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_OPEN docId=${event.documentId}")
                                    }
                                    localPdfPath = event.localPath
                                }
                            }
                        }
                        is ImssPdfCaptureCoordinator.PdfCaptureEvent.ConceptsSaved -> {}
                        is ImssPdfCaptureCoordinator.PdfCaptureEvent.CaptureError -> flowController?.markCaptureFailed()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    // If the user leaves the screen, make sure a stale session can't block the next entry
    DisposableEffect(Unit) {
        onDispose { ImssPdfCaptureCoordinator.finishSession() }
    }

    // While the local viewer is open, Android Back closes ONLY the viewer.
    // This intercepts the event before the NavHost/Activity can pop or finish.
    BackHandler(enabled = localPdfPath != null) {
        closeLocalViewer("SYSTEM_BACK")
    }

    Scaffold(
        topBar = {
            if (localPdfPath == null) {
                LvdTopBar(
                    title = portal.displayName,
                    subtitle = portal.host,
                    onBack = { if (webView?.canGoBack() == true) webView?.goBack() else onBack() },
                    actions = {
                        IconButton(onClick = onClose) {
                            Icon(Icons.Filled.Close, "Cerrar", tint = Color.White)
                        }
                    },
                )
            }
        },
        containerColor = Color.White,
        contentWindowInsets = if (localPdfPath != null) WindowInsets(0, 0, 0, 0) else WindowInsets.safeDrawing,
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            // WebView always alive underneath
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        val wv = this
                        layoutParams = ViewGroup.LayoutParams(-1, -1)
                        setBackgroundColor(android.graphics.Color.WHITE)
                        settings.configureForLaVeinte("1.0.0")
                        // Desktop viewport — ambos portales son sitios de escritorio (985px).
                        if (portal == ImssPortal.TU_PERFIL || portal == ImssPortal.TARJETON_DIGITAL) {
                            settings.useWideViewPort = true
                            settings.loadWithOverviewMode = true
                            settings.builtInZoomControls = true
                            settings.displayZoomControls = false
                            setInitialScale(0)
                        }
                        if (com.laveintedigital.app.BuildConfig.DEBUG) {
                            android.webkit.WebView.setWebContentsDebuggingEnabled(true)
                        }
                        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(wv, true) }

                        setDownloadListener(ImssPdfCaptureCoordinator.createDownloadListener(ctx, portal, scope))

                        if (portal == ImssPortal.TARJETON_DIGITAL) {
                            addJavascriptInterface(
                                TarjetonDigitalBridge { reportUrl ->
                                    scope.launch(Dispatchers.Main) {
                                        val ctrl = tarjetonController ?: return@launch
                                        val deleg = ctrl.lastDelegacion ?: return@launch
                                        val period = ctrl.selectedPeriod ?: return@launch
                                        ctrl.markSaving()
                                        ImssPdfCaptureCoordinator.captureTarjetonDigitalReport(
                                            context, portal, reportUrl,
                                            deleg.value, deleg.label, period.code, period.displayLabel,
                                            scope,
                                        ) { event ->
                                            when (event) {
                                                is ImssPdfCaptureCoordinator.PdfCaptureEvent.TarjetonSaved -> {
                                                    ctrl.markTarjetonSaved(TarjetonDigitalFlowController.TarjetonSavedInfo(
                                                        event.documentId, event.localPath,
                                                        event.wasDuplicate, period.displayLabel))
                                                    if (event.localPath.isNotBlank()) {
                                                        if (com.laveintedigital.app.BuildConfig.DEBUG) {
                                                            Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_OPEN docId=${event.documentId}")
                                                        }
                                                        localPdfPath = event.localPath
                                                    }
                                                }
                                                is ImssPdfCaptureCoordinator.PdfCaptureEvent.CaptureError -> ctrl.markCaptureFailed()
                                                else -> {}
                                            }
                                        }
                                    }
                                },
                                TarjetonDigitalBridge.NAME,
                            )
                            webChromeClient = object : WebChromeClient() {
                                override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                                    if (message != null) tarjetonController?.onPortalAlert(message)
                                    result?.confirm()
                                    return true
                                }
                                override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                                    if (message != null && com.laveintedigital.app.BuildConfig.DEBUG) {
                                        // LVD_BIO_JS: consola JS del portal sanitizada (nunca datos personales).
                                        val raw = message.message() ?: return true
                                        val sanitized = raw
                                            .replace(Regex("\\d{6,}"), "[REDACTED]")
                                            .take(200)
                                        Log.i("LVD_BIO_JS", "${message.messageLevel()} ${message.sourceId()}:${message.lineNumber()} $sanitized")
                                    }
                                    return true
                                }
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                pdfMonitorInstalled = false
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                // The monitor must be (re)installed before any blob: PDF is created.
                                if (view != null && !pdfMonitorInstalled) {
                                    ImssPdfCaptureCoordinator.injectPdfMonitor(view)
                                    pdfMonitorInstalled = true
                                }
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                return false
                            }
                        }
                        loadUrl(loginUrl)
                    }.also { wv ->
                        webView = wv
                        flowController?.attachWebView(wv)
                        tarjetonController?.attachWebView(wv)
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )

            // Tu Perfil flow UI overlay
            if (portal == ImssPortal.TU_PERFIL && flowState != null) {
                when (flowState) {
                    is TuPerfilFlowState.LoginRequired -> {
                        LaunchedEffect(Unit) { showLoginDialog = true }
                    }
                    is TuPerfilFlowState.WaitingForm,
                    is TuPerfilFlowState.FillingForm,
                    is TuPerfilFlowState.VerifyingForm,
                    is TuPerfilFlowState.LoadingLoginPage,
                    is TuPerfilFlowState.ApplyingCredentials -> {
                        LoadingOverlay("Preparando acceso…",
                            showManualButton = showManualFallback,
                            onManual = {
                                showManualFallback = false
                                flowController?.reset()
                            })
                    }
                    is TuPerfilFlowState.SubmittingLogin,
                    is TuPerfilFlowState.WaitingAuthentication -> {
                        LoadingOverlay("Conectando con Tu Perfil IMSS…",
                            showManualButton = showManualFallback,
                            onManual = {
                                showManualFallback = false
                                flowController?.reset()
                            })
                    }
                    is TuPerfilFlowState.OpeningCardPage -> {
                        LoadingOverlay("Abriendo sección de tarjetón...")
                    }
                    is TuPerfilFlowState.PreparingCardForm -> {
                        LaunchedEffect(Unit) { cardPageDetected = true }
                    }
                    is TuPerfilFlowState.Ready -> {
                        LaunchedEffect(Unit) { cardPageDetected = true }
                    }
                    is TuPerfilFlowState.GeneratingTarjeton -> {
                        LoadingOverlay("Generando tu tarjetón...")
                    }
                    is TuPerfilFlowState.SavingTarjeton -> {
                        LoadingOverlay("Guardando tarjetón…")
                    }
                    is TuPerfilFlowState.TarjetonSaved -> {}
                    is TuPerfilFlowState.Completed -> {
                        LaunchedEffect(flowState) {
                            Toast.makeText(context, (flowState as TuPerfilFlowState.Completed).message, Toast.LENGTH_LONG).show()
                        }
                    }
                    is TuPerfilFlowState.LoginError -> {
                        // Modal LVD con el mensaje clasificado (se muestra una sola vez por error).
                        val loginError = flowState as TuPerfilFlowState.LoginError
                        TuPerfilLoginErrorDialog(
                            kind = loginError.kind,
                            portalMessage = loginError.portalMessage,
                            onReviewData = {
                                flowController?.manualEntry()
                            },
                            onRetry = {
                                flowController?.retryLogin()
                            },
                            onManualEntry = {
                                flowController?.manualEntry()
                            },
                            onDismiss = {
                                flowController?.manualEntry()
                            },
                        )
                    }
                    is TuPerfilFlowState.Error -> {
                        LaunchedEffect(flowState) {
                            Toast.makeText(context, (flowState as TuPerfilFlowState.Error).reason, Toast.LENGTH_LONG).show()
                        }
                    }
                    else -> {}
                }
            }

            // Tarjetón Digital flow UI overlay
            if (portal == ImssPortal.TARJETON_DIGITAL) {
                when (val ts = tarjetonState) {
                    is TarjetonDigitalFlowState.LoginRequired -> {
                        LaunchedEffect(Unit) { showTarjetonLoginDialog = true }
                    }
                    is TarjetonDigitalFlowState.CheckingSession,
                    is TarjetonDigitalFlowState.LoadingPage,
                    is TarjetonDigitalFlowState.WaitingIframe,
                    is TarjetonDigitalFlowState.WaitingDom,
                    is TarjetonDigitalFlowState.FillingForm,
                    is TarjetonDigitalFlowState.VerifyingForm -> {
                        LoadingOverlay("Preparando acceso…")
                    }
                    is TarjetonDigitalFlowState.Submitting,
                    is TarjetonDigitalFlowState.WaitingAuthResult -> {
                        LoadingOverlay("Conectando con Tarjetón Digital IMSS…")
                    }
                    is TarjetonDigitalFlowState.Authenticated,
                    is TarjetonDigitalFlowState.OpeningTarjetonPage -> {
                        LoadingOverlay("Abriendo consulta de tarjetones…")
                    }
                    is TarjetonDigitalFlowState.LoginError -> {
                        tarjetonRawFormVisible = false
                        TarjetonDigitalLoginErrorDialog(
                            error = ts,
                            onReviewData = { tarjetonController?.reviewData() },
                            onRetry = { tarjetonController?.retryLogin() },
                            onManualEntry = { tarjetonController?.manualEntry() },
                            onDismiss = { tarjetonController?.manualEntry() },
                        )
                    }
                    is TarjetonDigitalFlowState.TarjetonSaved -> {
                        tarjetonRawFormVisible = false
                    }
                    is TarjetonDigitalFlowState.TarjetonReady,
                    is TarjetonDigitalFlowState.GeneratingTarjeton,
                    is TarjetonDigitalFlowState.SavingTarjeton,
                    is TarjetonDigitalFlowState.Error,
                    is TarjetonDigitalFlowState.TarjetonError,
                    is TarjetonDigitalFlowState.ManualMode,
                    null -> {}
                }
            }

            // Tarjetón Digital tarjeton overlay
            if (portal == ImssPortal.TARJETON_DIGITAL && tarjetonController != null && !tarjetonRawFormVisible) {
                val ts = tarjetonState
                val inTarjetonPhase = ts is TarjetonDigitalFlowState.TarjetonReady ||
                        ts is TarjetonDigitalFlowState.GeneratingTarjeton ||
                        ts is TarjetonDigitalFlowState.SavingTarjeton ||
                        ts is TarjetonDigitalFlowState.TarjetonSaved ||
                        ts is TarjetonDigitalFlowState.TarjetonError ||
                        (ts is TarjetonDigitalFlowState.Error && tarjetonController.periods.isNotEmpty())
                if (inTarjetonPhase) {
                    val savedTitle = (ts as? TarjetonDigitalFlowState.TarjetonSaved)?.let { info ->
                        "Tarjetón guardado" + if (info.periodLabel.isNotBlank()) " — ${info.periodLabel}" else ""
                    }
                    val errorMessage = (ts as? TarjetonDigitalFlowState.Error)?.reason
                        ?: (ts as? TarjetonDigitalFlowState.TarjetonError)?.reason
                    TarjetonDigitalTarjetonOverlay(
                        periods = tarjetonController.periods,
                        selectedPeriod = tarjetonController.selectedPeriod,
                        onPeriodSelected = { p -> tarjetonController.selectedPeriod = p },
                        tipo = tarjetonTipo,
                        onTipoSelected = { tarjetonTipo = it },
                        onConsultar = {
                            val period = tarjetonController.selectedPeriod ?: return@TarjetonDigitalTarjetonOverlay
                            tarjetonController.consultarTarjeton(period, tarjetonTipo)
                        },
                        generating = ts is TarjetonDigitalFlowState.GeneratingTarjeton ||
                                ts is TarjetonDigitalFlowState.SavingTarjeton,
                        errorMessage = errorMessage,
                        onRetry = { tarjetonController.retryTarjetonAutomation() },
                        onOpenFormularioOriginal = { tarjetonRawFormVisible = true },
                        savedTitle = savedTitle,
                        onViewTarjeton = {
                            (ts as? TarjetonDigitalFlowState.TarjetonSaved)?.let { info ->
                                if (info.localPath.isNotBlank()) {
                                    if (com.laveintedigital.app.BuildConfig.DEBUG) {
                                        Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_OPEN docId=${info.documentId}")
                                    }
                                    localPdfPath = info.localPath
                                }
                            }
                        },
                        onOpenHistory = onOpenHistory,
                        onOpenLoginOriginal = { tarjetonController?.manualEntry() },
                    )
                }
            }

            // Tarjeton overlay — read state from flowController
            if (cardPageDetected && portal == ImssPortal.TU_PERFIL) {
                val overlayPageState = when (flowState) {
                    is TuPerfilFlowState.Ready -> PortalPageState.READY
                    is TuPerfilFlowState.GeneratingTarjeton,
                    is TuPerfilFlowState.SavingTarjeton -> PortalPageState.GENERATING
                    is TuPerfilFlowState.TarjetonSaved -> PortalPageState.COMPLETED
                    is TuPerfilFlowState.Error -> PortalPageState.ERROR
                    else -> PortalPageState.CARD_PAGE
                }
                val cardStage by flowController?.cardStage?.collectAsState() ?: remember { mutableStateOf("") }
                TuPerfilTarjetonOverlay(
                    pageState = overlayPageState,
                    debugStage = cardStage,
                    errorMessage = (flowState as? TuPerfilFlowState.Error)?.reason,
                    savedTitle = (flowState as? TuPerfilFlowState.TarjetonSaved)?.let {
                        buildString {
                            append("Tarjetón guardado — ")
                            append(it.ooadLabel)
                            if (it.periodLabel.isNotBlank()) append(" — ").append(it.periodLabel)
                        }
                    },
                    onRetry = { flowController?.retryCardAutomation() },
                    ooadOptions = flowController?.ooadOptions ?: emptyList(),
                    selectedOoad = flowController?.selectedOoad,
                    onOoadSelected = { ooad ->
                        flowController?.selectedOoad = ooad
                        scope.launch {
                            webView?.let { wv ->
                                TuPerfilPortalAdapter.selectOoadAndGetPeriods(wv, ooad.code) { periods ->
                                    flowController?.periodOptions = periods.map { com.laveintedigital.app.imss.tarjeton.PeriodParser.parse(it) }
                                    flowController?.selectedPeriod = com.laveintedigital.app.imss.tarjeton.PeriodParser.latestPeriod(flowController?.periodOptions ?: emptyList())
                                }
                            }
                        }
                    },
                    periodOptions = flowController?.periodOptions ?: emptyList(),
                    selectedPeriod = flowController?.selectedPeriod,
                    onPeriodSelected = { p -> flowController?.selectedPeriod = p },
                    onConsultar = {
                        val period = flowController?.selectedPeriod ?: return@TuPerfilTarjetonOverlay
                        // Session must exist BEFORE clicking Buscar, and the monitor hook
                        // is installed before this point, so blob PDFs are captured.
                        val session = ImssPdfCaptureCoordinator.startCaptureSession(portal, flowController?.selectedOoad, period)
                            ?: return@TuPerfilTarjetonOverlay
                        flowController?.markGenerating()
                        Log.i("ImssPdfCapture", "SEARCH_CLICKED sessionId=${session.id}")
                        scope.launch {
                            webView?.let { wv ->
                                TuPerfilPortalAdapter.selectPeriodAndSearch(wv, period.code) { ok ->
                                    if (!ok) Log.w("ImssPdfCapture", "SEARCH_CLICK_FAILED sessionId=${session.id}")
                                }
                            }
                        }
                        // Timeout: if the tarjetón never arrives, surface an error; otherwise just close.
                        scope.launch {
                            delay(45_000)
                            val s = ImssPdfCaptureCoordinator.activeSession
                            if (s != null) {
                                val hadTarjeton = s.tarjetonDocumentId != null
                                ImssPdfCaptureCoordinator.finishSession()
                                if (!hadTarjeton) flowController?.markCaptureFailed()
                            }
                        }
                    },
                    onViewTarjeton = {
                        (flowState as? TuPerfilFlowState.TarjetonSaved)?.let { info ->
                            if (info.localPath.isNotBlank()) {
                                if (com.laveintedigital.app.BuildConfig.DEBUG) {
                                    Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_OPEN docId=${info.documentId}")
                                }
                                localPdfPath = info.localPath
                            }
                        }
                    },
                    onOpenHistory = onOpenHistory,
                    onOpenFormularioOriginal = { cardPageDetected = false },
                )
            }

            // Local PDF viewer overlay — WebView stays alive underneath
            if (localPdfPath != null) {
                PayslipViewerScreen(
                    filePath = localPdfPath!!,
                    title = "Tarjetón guardado",
                    onBack = { closeLocalViewer("TOP_BAR") },
                )
            }
        }
    }

    // Native login dialog
    if (showLoginDialog) {
        TuPerfilLoginDialog(
            savedUsername = flowController?.lastUsername,
            onLogin = { username, password, remember ->
                showLoginDialog = false
                flowController?.loginWithCredentials(username, password, remember)
            },
            onDismiss = { showLoginDialog = false },
        )
    }

    // Tarjetón Digital native login dialog
    if (showTarjetonLoginDialog) {
        TarjetonDigitalLoginDialog(
            delegaciones = tarjetonController?.delegaciones ?: TarjetonDigitalDelegaciones.FALLBACK,
            savedDelegacion = tarjetonController?.lastDelegacion,
            savedUsername = tarjetonController?.lastUsername,
            onLogin = { delegacion, username, password, remember ->
                showTarjetonLoginDialog = false
                tarjetonController?.loginWithCredentials(delegacion, username, password, remember)
            },
            onManualEntry = {
                showTarjetonLoginDialog = false
                tarjetonController?.manualEntry()
            },
            onDismiss = { showTarjetonLoginDialog = false },
        )
    }
}

@Composable
private fun LoadingOverlay(message: String, showManualButton: Boolean = false, onManual: (() -> Unit)? = null) {
    Box(
        modifier = Modifier.fillMaxSize().background(LvdColors.Scrim),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp),
        ) {
            LvdLoadingState(title = message)
            if (showManualButton && onManual != null) {
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = onManual) {
                    Text("Entrar manualmente", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
