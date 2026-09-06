package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.FilePresent
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import com.laveintedigital.app.imss.portal.ImssPdfCaptureCoordinator
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandCyan
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary
import com.laveintedigital.app.ui.theme.SkyBlue
import com.laveintedigital.app.ui.theme.SteelBlue
import kotlinx.coroutines.launch

private const val CARD_RATIO = 0.78f

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfficialPayslipsScreen(
    onOpenPortal: (ImssPortal) -> Unit,
    onOpenBiometrics: () -> Unit,
    onSaveCredentials: (ImssPortal) -> Unit,
    onManageCredentials: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = true)
    var hasTuPerfil by remember { mutableStateOf(false) }
    var hasTarjeton by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        scope.launch {
            hasTuPerfil = ImssVaultManager.hasCredentials(context, ImssPortal.TU_PERFIL)
            hasTarjeton = ImssVaultManager.hasCredentials(context, ImssPortal.TARJETON_DIGITAL)
        }
        ImssPdfCaptureCoordinator.cleanOrphans(context)
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text("Servicios oficiales IMSS") },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = BrandNavy,
                        navigationIconContentColor = BrandNavy,
                    ),
                )
                HorizontalDivider(
                    thickness = 1.dp,
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            val compact = maxWidth < 360.dp
            val outerPad: Dp = if (compact) 12.dp else 18.dp
            val gridSpacing = 14.dp
            val cellWidth = (maxWidth - outerPad * 2 - gridSpacing) / 2f
            val cellHeight = cellWidth / CARD_RATIO

            val cards = remember(hasTuPerfil, hasTarjeton) {
                listOf(
                    OfficialServiceUiModel(
                        title = "Tu Perfil IMSS",
                        description = "Tarjetón, biométricos y más.",
                        accent = SteelBlue,
                        accentLight = SkyBlue,
                        actionLabel = "Abrir Tu Perfil",
                        mainIcon = Icons.Filled.Person,
                        accentIcons = listOf(Icons.Filled.VerifiedUser, Icons.Filled.Fingerprint),
                        onClick = { onOpenPortal(ImssPortal.TU_PERFIL) },
                        saved = hasTuPerfil,
                    ),
                    OfficialServiceUiModel(
                        title = "Tarjetón Digital",
                        description = "Consulta tus tarjetones oficiales. Suelen publicarse después que en Tu Perfil.",
                        accent = Primary,
                        accentLight = SkyBlue,
                        actionLabel = "Abrir portal",
                        mainIcon = Icons.Filled.Description,
                        accentIcons = listOf(Icons.Filled.Download, Icons.Filled.FilePresent),
                        onClick = { onOpenPortal(ImssPortal.TARJETON_DIGITAL) },
                        saved = hasTarjeton,
                    ),
                    OfficialServiceUiModel(
                        title = "Registros biométricos",
                        description = "Consulta tus checadas de Tu Perfil IMSS. Usa tu acceso guardado.",
                        accent = BrandBlue,
                        accentLight = SkyBlue,
                        actionLabel = "Consultar registros",
                        mainIcon = Icons.Filled.Fingerprint,
                        accentIcons = listOf(Icons.Filled.Schedule, Icons.Filled.Person),
                        onClick = onOpenBiometrics,
                        saved = hasTuPerfil,
                    ),
                    OfficialServiceUiModel(
                        title = "Administrar accesos",
                        description = "Gestiona tus accesos guardados.",
                        accent = SteelBlue,
                        accentLight = BrandCyan,
                        actionLabel = "Administrar",
                        mainIcon = Icons.Filled.Lock,
                        accentIcons = listOf(Icons.Filled.Key, Icons.Filled.VerifiedUser),
                        onClick = onManageCredentials,
                    ),
                )
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = outerPad),
                contentPadding = PaddingValues(top = 14.dp, bottom = 18.dp),
                horizontalArrangement = Arrangement.spacedBy(gridSpacing),
                verticalArrangement = Arrangement.spacedBy(gridSpacing),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    ScreenHeader(compact = compact)
                }
                items(cards) { model ->
                    OfficialServiceCard(
                        model = model,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(cellHeight),
                        compact = compact,
                    )
                }
                // Identidad del build instalado (fuente canónica: BuildConfig).
                // Pequeña y secundaria: solo trazabilidad de la versión en el teléfono.
                item(span = { GridItemSpan(maxLineSpan) }) {
                    AppBuildIdentityFooter()
                }
            }
        }
    }
}

/**
 * Identidad inequívoca del APK instalado: versión + canal desde BuildConfig
 * (fuente única: build.gradle.kts). Nada hardcodeado.
 */
@Composable
private fun AppBuildIdentityFooter() {
    val channel = com.laveintedigital.app.BuildConfig.DISTRIBUTION_CHANNEL
        .replaceFirstChar { it.uppercase() }
    Text(
        text = "Versión ${com.laveintedigital.app.BuildConfig.VERSION_NAME} " +
            "(${com.laveintedigital.app.BuildConfig.VERSION_CODE})\nCanal: $channel",
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
        fontSize = 12.sp,
        lineHeight = 16.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 6.dp, bottom = 4.dp),
    )
}

@Composable
private fun ScreenHeader(compact: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 2.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Accede a los portales oficiales y consulta tus tarjetones y registros biométricos de manera segura.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = if (compact) 13.5.sp else 14.sp,
            lineHeight = if (compact) 18.sp else 20.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(10.dp))
        Icon(
            Icons.Filled.Shield,
            contentDescription = "Seguridad",
            tint = Primary,
            modifier = Modifier.size(if (compact) 26.dp else 30.dp),
        )
    }
}