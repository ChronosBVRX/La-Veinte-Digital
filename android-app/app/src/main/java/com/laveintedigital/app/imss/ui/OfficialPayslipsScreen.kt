package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Info
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import com.laveintedigital.app.imss.portal.ImssPdfCaptureCoordinator
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandCyan
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary
import com.laveintedigital.app.ui.theme.SkyBlue
import com.laveintedigital.app.ui.theme.SteelBlue
import kotlinx.coroutines.launch

private const val CARD_RATIO = 0.82f

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
                    title = { Text("Consultar tarjetón IMSS") },
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
            val outerPad: Dp = if (compact) 12.dp else 16.dp
            val gridSpacing = 12.dp
            val cellWidth = (maxWidth - outerPad * 2 - gridSpacing) / 2f
            val cellHeight = cellWidth / CARD_RATIO

            val secondaryCards = remember(hasTuPerfil) {
                listOf(
                    OfficialServiceUiModel(
                        title = "Registros biométricos",
                        description = "Consulta tus checadas con tu misma cuenta de Tu Perfil IMSS.",
                        accent = BrandBlue,
                        accentLight = SkyBlue,
                        actionLabel = "Consultar checadas",
                        mainIcon = Icons.Filled.Fingerprint,
                        accentIcons = listOf(Icons.Filled.Schedule, Icons.Filled.Person),
                        onClick = onOpenBiometrics,
                        saved = hasTuPerfil,
                    ),
                    OfficialServiceUiModel(
                        title = "Administrar accesos",
                        description = "Actualiza u olvida tus contraseñas guardadas de cada portal.",
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
                contentPadding = PaddingValues(top = 12.dp, bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(gridSpacing),
                verticalArrangement = Arrangement.spacedBy(gridSpacing),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    ScreenHeader(compact = compact)
                }

                // Opción 1: Tu Perfil IMSS
                item(span = { GridItemSpan(maxLineSpan) }) {
                    TarjetonPortalOptionCard(
                        badge = "Opción 1 · Recomendado (se publica antes)",
                        title = "Tarjetón desde Tu Perfil IMSS",
                        portalHost = "tuperfil.imss.gob.mx",
                        explanation = "Portal integral del trabajador IMSS. Aquí suelen aparecer primero tus tarjetones de pago y tus registros biométricos (checadas).",
                        accountRequiredTitle = "¿Qué cuenta debes poner?",
                        accountRequiredDetail = "Tu Matrícula y la contraseña de Tu Perfil IMSS (la misma que usas para ver tus checadas). NO uses la contraseña de Tarjetón Digital antiguo ni la de La Veinte Digital.",
                        actionLabel = "Entrar con Tu Perfil IMSS",
                        icon = Icons.Filled.Person,
                        accent = Primary,
                        saved = hasTuPerfil,
                        compact = compact,
                        onClick = { onOpenPortal(ImssPortal.TU_PERFIL) },
                    )
                }

                // Opción 2: Tarjetón Digital
                item(span = { GridItemSpan(maxLineSpan) }) {
                    TarjetonPortalOptionCard(
                        badge = "Opción 2 · Portal clásico por Delegación",
                        title = "Tarjetón Digital clásico",
                        portalHost = "rh.imss.gob.mx/Personal/TarjetonDigital",
                        explanation = "Portal tradicional de Recursos Humanos del IMSS. Los tarjetones suelen publicarse aquí después que en Tu Perfil IMSS.",
                        accountRequiredTitle = "¿Qué cuenta debes poner?",
                        accountRequiredDetail = "Tu Delegación (OOAD), Usuario/Matrícula y la contraseña exclusiva de Tarjetón Digital (suele ser diferente a la de Tu Perfil IMSS).",
                        actionLabel = "Entrar con Tarjetón Digital",
                        icon = Icons.Filled.Description,
                        accent = SteelBlue,
                        saved = hasTarjeton,
                        compact = compact,
                        onClick = { onOpenPortal(ImssPortal.TARJETON_DIGITAL) },
                    )
                }

                // Aviso de protección contra bloqueos
                item(span = { GridItemSpan(maxLineSpan) }) {
                    AccountLockoutProtectionBanner(compact = compact)
                }

                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text(
                        text = "Otros servicios oficiales",
                        color = BrandNavy,
                        fontSize = if (compact) 14.sp else 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 4.dp, start = 2.dp),
                    )
                }

                items(secondaryCards) { model ->
                    OfficialServiceCard(
                        model = model,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(cellHeight),
                        compact = compact,
                    )
                }

                // Identidad del build instalado (fuente canónica: BuildConfig).
                item(span = { GridItemSpan(maxLineSpan) }) {
                    AppBuildIdentityFooter()
                }
            }
        }
    }
}

@Composable
private fun TarjetonPortalOptionCard(
    badge: String,
    title: String,
    portalHost: String,
    explanation: String,
    accountRequiredTitle: String,
    accountRequiredDetail: String,
    actionLabel: String,
    icon: ImageVector,
    accent: Color,
    saved: Boolean,
    compact: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(if (compact) 16.dp else 20.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(
                elevation = 2.dp,
                shape = shape,
                ambientColor = BrandNavy.copy(alpha = 0.06f),
                spotColor = BrandNavy.copy(alpha = 0.10f),
            )
            .background(MaterialTheme.colorScheme.surface, shape)
            .border(1.dp, accent.copy(alpha = 0.32f), shape)
            .clip(shape)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(if (compact) 14.dp else 16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .clip(RoundedCornerShape(50))
                        .background(accent.copy(alpha = 0.10f))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = badge,
                        color = accent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                }
                if (saved) {
                    Spacer(Modifier.width(8.dp))
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(LvdColors.Success.copy(alpha = 0.15f))
                            .border(1.dp, LvdColors.Success.copy(alpha = 0.45f), RoundedCornerShape(50))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF15803D),
                            modifier = Modifier.size(11.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "Acceso guardado",
                            color = Color(0xFF15803D),
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            softWrap = false,
                        )
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(if (compact) 40.dp else 44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(accent.copy(alpha = 0.12f))
                        .border(1.dp, accent.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(if (compact) 22.dp else 24.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = if (compact) 16.sp else 17.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 21.sp,
                    )
                    Text(
                        text = portalHost,
                        color = accent,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            Text(
                text = explanation,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = if (compact) 12.5.sp else 13.sp,
                lineHeight = 18.sp,
            )

            // Caja destacada de qué cuenta poner
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(LvdColors.SurfaceSoft)
                    .border(1.dp, LvdColors.Border, RoundedCornerShape(12.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Key,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = accountRequiredTitle,
                        color = BrandNavy,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text(
                    text = accountRequiredDetail,
                    color = LvdColors.TextPrimary,
                    fontSize = 12.sp,
                    lineHeight = 16.5.sp,
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.End,
            ) {
                Text(
                    text = actionLabel,
                    color = accent,
                    fontSize = if (compact) 13.5.sp else 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.width(5.dp))
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
private fun AccountLockoutProtectionBanner(compact: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(LvdColors.Warning.copy(alpha = 0.16f))
            .border(1.dp, LvdColors.Warning.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
            .padding(if (compact) 11.dp else 13.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            Icons.Filled.Info,
            contentDescription = null,
            tint = Color(0xFFB45309),
            modifier = Modifier
                .size(18.dp)
                .padding(top = 1.dp),
        )
        Spacer(Modifier.width(9.dp))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Protección activa contra bloqueo de cuentas",
                color = BrandNavy,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Tu Perfil IMSS y Tarjetón Digital suelen tener contraseñas distintas. Si una contraseña falla, no insistas con la misma: La Veinte detiene los reintentos automáticos al 2.º fallo para evitar que el IMSS bloquee tu cuenta.",
                color = LvdColors.TextPrimary,
                fontSize = 11.8.sp,
                lineHeight = 16.sp,
            )
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
            .padding(horizontal = 2.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Elige el portal oficial para consultar tu tarjetón",
                color = BrandNavy,
                fontSize = if (compact) 15.sp else 16.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                "Cada portal del IMSS utiliza su propia contraseña. Revisa cuál tienes activa antes de iniciar sesión.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = if (compact) 12.5.sp else 13.sp,
                lineHeight = if (compact) 17.sp else 18.sp,
            )
        }
        Spacer(Modifier.width(10.dp))
        Box(
            modifier = Modifier
                .size(if (compact) 34.dp else 38.dp)
                .clip(CircleShape)
                .background(Primary.copy(alpha = 0.10f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Shield,
                contentDescription = "Seguridad",
                tint = Primary,
                modifier = Modifier.size(if (compact) 20.dp else 22.dp),
            )
        }
    }
}