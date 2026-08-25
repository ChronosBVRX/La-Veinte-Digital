package com.laveintedigital.app.imss.ui

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.portal.TuPerfilBiometricFlowController
import com.laveintedigital.app.imss.portal.TuPerfilBiometricFlowState
import com.laveintedigital.app.imss.portal.TuPerfilSessionController
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdLoadingState
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTopBar
import com.laveintedigital.app.ui.theme.StatusBarAppearance
import com.laveintedigital.app.util.Hosts
import com.laveintedigital.app.util.configureForLaVeinte
import kotlinx.coroutines.delay

/**
 * Pantalla nativa "Registros biométricos" (checadas de Tu Perfil IMSS).
 *
 * La experiencia es 100% La Veinte Digital: top bar LVD, loading LVD, selector
 * de periodo LVD y resultados en Compose. El portal oficial corre por debajo
 * como fuente de datos y sesión (mismas cookies del WebView compartido con
 * Tarjetones — NUNCA se limpian al cambiar de función). El "formulario
 * original" queda como fallback explícito.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TuPerfilBiometricScreen(
    onBack: () -> Unit,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    StatusBarAppearance(lightIcons = false)

    var webView by remember { mutableStateOf<WebView?>(null) }
    var showLoginDialog by remember { mutableStateOf(false) }
    var showManualFallback by remember { mutableStateOf(false) }
    var rawFormVisible by remember { mutableStateOf(false) }

    // Selección NATIVA del trabajador — estado Compose observable (fase A).
    // La aplicación al control real del portal ocurre al pulsar Consultar (fase B).
    var selectedPeriod by remember { mutableStateOf<com.laveintedigital.app.imss.biometric.BiometricPeriod?>(null) }

    val controller = remember { TuPerfilBiometricFlowController(scope, context) }
    val flowState by controller.state.collectAsState()

    // Fallback manual: si el login tarda >10s, ofrecer entrar manualmente.
    LaunchedEffect(flowState) {
        if (flowState is TuPerfilBiometricFlowState.Authenticating) {
            showManualFallback = false
            delay(10_000)
            if (controller.state.value is TuPerfilBiometricFlowState.Authenticating) {
                showManualFallback = true
            }
        } else {
            showManualFallback = false
        }
    }

    LaunchedEffect(Unit) { controller.start() }

    BackHandler(enabled = rawFormVisible) {
        rawFormVisible = false
        controller.resumeAfterManual()
    }

    Scaffold(
        topBar = {
            LvdTopBar(
                title = "Registros biométricos",
                subtitle = "Tu Perfil IMSS",
                onBack = { if (webView?.canGoBack() == true) webView?.goBack() else onBack() },
                actions = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Filled.Close, "Cerrar", tint = Color.White)
                    }
                },
            )
        },
        containerColor = Color.White,
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        val wv = this
                        layoutParams = ViewGroup.LayoutParams(-1, -1)
                        setBackgroundColor(android.graphics.Color.WHITE)
                        settings.configureForLaVeinte("1.0.0")
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.builtInZoomControls = true
                        settings.displayZoomControls = false
                        setInitialScale(0)
                        if (BuildConfig.DEBUG) {
                            WebView.setWebContentsDebuggingEnabled(true)
                        }
                        // Cookies compartidas con Tarjetones (MISMA sesión).
                        CookieManager.getInstance().apply {
                            setAcceptCookie(true)
                            setAcceptThirdPartyCookies(wv, true)
                        }

                        webViewClient = object : WebViewClient() {
                            // Allowlist explícita: solo hosts válidos de Tu Perfil IMSS.
                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                val url = request?.url?.toString() ?: return false
                                if (url.startsWith("about:blank")) return false
                                val host = Hosts.hostOf(url) ?: return true
                                return !TuPerfilBiometricFlowController.ALLOWED_HOSTS.contains(host)
                            }
                        }
                        // Se inicia en el login: si hay sesión válida el portal redirige
                        // y el controlador entra directo; si no, auto-login.
                        loadUrl(TuPerfilSessionController.LOGIN_URL)
                    }.also { wv ->
                        webView = wv
                        controller.attachWebView(wv)
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )

            // ── UI nativa según estado ────────────────────────────────────
            if (!rawFormVisible) {
                when (val fs = flowState) {
                    is TuPerfilBiometricFlowState.CheckingSession,
                    is TuPerfilBiometricFlowState.Authenticating -> {
                        LoadingOverlay(
                            message = "Conectando con Tu Perfil IMSS…",
                            showManualButton = showManualFallback,
                            onManual = {
                                showManualFallback = false
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                        )
                    }
                    is TuPerfilBiometricFlowState.LoginRequired -> {
                        LaunchedEffect(Unit) { showLoginDialog = true }
                    }
                    is TuPerfilBiometricFlowState.OpeningBiometrics,
                    is TuPerfilBiometricFlowState.WaitingBiometricDom,
                    is TuPerfilBiometricFlowState.ReadingOoads,
                    is TuPerfilBiometricFlowState.ApplyingOoad,
                    is TuPerfilBiometricFlowState.WaitingPeriodsForOoad,
                    is TuPerfilBiometricFlowState.ReadingPeriods -> {
                        LoadingOverlay(message = "Preparando tus registros…")
                    }
                    is TuPerfilBiometricFlowState.PeriodSelection -> {
                        LaunchedEffect(fs.periods) {
                            if (selectedPeriod == null || selectedPeriod !in fs.periods) {
                                selectedPeriod = com.laveintedigital.app.imss.biometric.BiometricFlowPolicy.defaultPeriod(fs.periods)
                            }
                        }
                        TuPerfilBiometricPeriodSheet(
                            periods = fs.periods,
                            ooad = controller.selectedOoad,
                            selectedPeriod = selectedPeriod,
                            onPeriodSelected = { p ->
                                selectedPeriod = p
                                controller.selectPeriod(p)
                            },
                            onConsultar = {
                                selectedPeriod?.let { controller.consultar(it) }
                            },
                            onOpenFormularioOriginal = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                            consulting = false,
                        )
                    }
                    is TuPerfilBiometricFlowState.ApplyingPeriod,
                    is TuPerfilBiometricFlowState.VerifyingPeriod,
                    is TuPerfilBiometricFlowState.SubmittingQuery,
                    is TuPerfilBiometricFlowState.WaitingResults,
                    is TuPerfilBiometricFlowState.ReadingResults -> {
                        LoadingOverlay(
                            message = "Consultando registros biométricos…",
                            subtitle = "Esto puede tomar unos segundos.",
                        )
                    }
                    is TuPerfilBiometricFlowState.Results -> {
                        TuPerfilBiometricResultsPanel(
                            period = fs.period,
                            columns = controller.lastColumns,
                            records = fs.records,
                            onChangePeriod = { controller.backToPeriodSelection() },
                            onQueryAgain = { controller.consultar(fs.period) },
                            onOpenFormularioOriginal = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                            onSavePdf = { onResult ->
                                controller.saveBiometricPdf(onResult)
                            },
                        )
                    }
                    is TuPerfilBiometricFlowState.Empty -> {
                        TuPerfilBiometricEmptyPanel(
                            period = fs.period,
                            onChangePeriod = { controller.backToPeriodSelection() },
                            onQueryAgain = { controller.consultar(fs.period) },
                            onOpenFormularioOriginal = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                        )
                    }
                    is TuPerfilBiometricFlowState.Error -> {
                        TuPerfilBiometricErrorPanel(
                            title = errorTitle(fs.kind),
                            message = fs.message,
                            onRetry = {
                                when (fs.kind) {
                                    com.laveintedigital.app.imss.biometric.BiometricErrorKind.PERIODS_NOT_READABLE,
                                    com.laveintedigital.app.imss.biometric.BiometricErrorKind.PERIODS_TIMEOUT,
                                    com.laveintedigital.app.imss.biometric.BiometricErrorKind.DOM_NOT_RECOGNIZED,
                                    com.laveintedigital.app.imss.biometric.BiometricErrorKind.OOAD_NOT_READABLE,
                                    com.laveintedigital.app.imss.biometric.BiometricErrorKind.OOAD_REJECTED -> controller.retryOpenBiometrics()
                                    else -> controller.retryQuery()
                                }
                            },
                            onOpenFormularioOriginal = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                            onCancel = { onBack() },
                            onCopyDiagnostics = if (BuildConfig.DEBUG) {
                                {
                                    val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                    cm.setPrimaryClip(android.content.ClipData.newPlainText(
                                        "LVD Diagnóstico biométricos",
                                        controller.copyDiagnosticsReport(),
                                    ))
                                    android.widget.Toast.makeText(context, "Diagnóstico copiado", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            } else null,
                        )
                    }
                    is TuPerfilBiometricFlowState.LoginError -> {
                        TuPerfilLoginErrorDialog(
                            kind = fs.kind,
                            portalMessage = fs.portalMessage,
                            onReviewData = {
                                showLoginDialog = true
                                controller.reviewData()
                            },
                            onRetry = { controller.retryLogin() },
                            onManualEntry = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                            onDismiss = {
                                rawFormVisible = true
                                controller.manualEntry()
                            },
                        )
                    }
                    is TuPerfilBiometricFlowState.SessionExpired -> {
                        TuPerfilBiometricSessionExpiredDialog(
                            onRelogin = { controller.recoverFromExpired() },
                            onCancel = { onBack() },
                        )
                    }
                    is TuPerfilBiometricFlowState.ManualMode -> {}
                }
            }

            // Fallback "formulario original": píldora para volver a la app.
            if (rawFormVisible) {
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 20.dp)
                        .shadow(4.dp, RoundedCornerShape(50))
                        .clip(RoundedCornerShape(50))
                        .background(LvdColors.Surface)
                        .border(1.dp, LvdColors.Border, RoundedCornerShape(50))
                        .padding(start = 14.dp, end = 6.dp, top = 2.dp, bottom = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Formulario original de Tu Perfil IMSS",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )
                    Spacer(Modifier.width(LvdSpacing.Sm))
                    TextButton(onClick = {
                        rawFormVisible = false
                        controller.resumeAfterManual()
                    }) {
                        Text(
                            "Volver a La Veinte",
                            color = LvdColors.Blue,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }
    }

    // Login compartido — el MISMO diálogo que Tarjetones.
    if (showLoginDialog) {
        TuPerfilLoginDialog(
            savedUsername = controller.session.lastUsername,
            title = "Inicia sesión en Tu Perfil IMSS",
            subtitle = null,
            description = "Usaremos este mismo acceso para Tarjetones y Registros biométricos.",
            onLogin = { username, password, remember ->
                showLoginDialog = false
                controller.loginWithCredentials(username, password, remember)
            },
            onDismiss = { showLoginDialog = false },
        )
    }
}

@Composable
private fun LoadingOverlay(
    message: String,
    subtitle: String? = null,
    showManualButton: Boolean = false,
    onManual: (() -> Unit)? = null,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(LvdColors.Scrim),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp),
        ) {
            LvdLoadingState(title = message, subtitle = subtitle)
            if (showManualButton && onManual != null) {
                Spacer(Modifier.padding(8.dp))
                TextButton(onClick = onManual) {
                    Text("Entrar manualmente", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

/** Título del error según su clase (los mensajes de periodos son un problema distinto al de consulta). */
private fun errorTitle(kind: com.laveintedigital.app.imss.biometric.BiometricErrorKind): String = when (kind) {
    com.laveintedigital.app.imss.biometric.BiometricErrorKind.PERIODS_NOT_READABLE,
    com.laveintedigital.app.imss.biometric.BiometricErrorKind.PERIODS_TIMEOUT -> "No pudimos cargar los periodos"
    com.laveintedigital.app.imss.biometric.BiometricErrorKind.DOM_NOT_RECOGNIZED -> "No pudimos reconocer el formulario de Biométricos"
    com.laveintedigital.app.imss.biometric.BiometricErrorKind.OOAD_NOT_READABLE,
    com.laveintedigital.app.imss.biometric.BiometricErrorKind.OOAD_REJECTED -> "No pudimos preparar el formulario"
    else -> "No pudimos consultar tus registros"
}
