package com.laveintedigital.app.imss.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.biometric.BiometricAuditReport
import com.laveintedigital.app.imss.biometric.BiometricColumn
import com.laveintedigital.app.imss.biometric.BiometricDayGroup
import com.laveintedigital.app.imss.biometric.BiometricFlowPolicy
import com.laveintedigital.app.imss.biometric.BiometricGrouping
import com.laveintedigital.app.imss.biometric.BiometricOmission
import com.laveintedigital.app.imss.biometric.BiometricOmissionDetector
import com.laveintedigital.app.imss.biometric.BiometricOmissionType
import com.laveintedigital.app.imss.biometric.BiometricOoad
import com.laveintedigital.app.imss.biometric.BiometricPeriod
import com.laveintedigital.app.imss.biometric.BiometricPunch
import com.laveintedigital.app.imss.biometric.BiometricPunchType
import com.laveintedigital.app.imss.biometric.BiometricRecord
import com.laveintedigital.app.ui.lvd.LvdBottomSheet
import com.laveintedigital.app.ui.lvd.LvdCard
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdDimens
import com.laveintedigital.app.ui.lvd.LvdMotion
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSecondaryButton
import com.laveintedigital.app.ui.lvd.LvdShapes
import com.laveintedigital.app.ui.lvd.LvdSpacing

/**
 * UI nativa de "Registros biométricos" (LVD). Todo pasa por los tokens del
 * sistema; nada de AlertDialog Material crudo ni hex sueltos.
 *
 * La selección de periodo usa un picker LVD (bottom sheet con lista de filas
 * completamente clickeables) en lugar de un dropdown flotante sobre el
 * WebView — más robusto y sin problemas de intercepción de toques.
 */

/** Bottom sheet de selección de periodo. */
@Composable
fun TuPerfilBiometricPeriodSheet(
    periods: List<BiometricPeriod>,
    ooad: BiometricOoad? = null,
    selectedPeriod: BiometricPeriod?,
    onPeriodSelected: (BiometricPeriod) -> Unit,
    onConsultar: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
    consulting: Boolean = false,
) {
    var showPicker by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
    ) {
        // Fondo nativo elegante que oculta el WebView en segundo plano
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 36.dp, start = 24.dp, end = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(LvdShapes.Pill)
                    .background(LvdColors.Surface)
                    .border(1.dp, LvdColors.Border, LvdShapes.Pill)
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(LvdColors.SuccessStrong),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Tu Perfil IMSS • Conexión activa",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = LvdColors.TextPrimary,
                )
            }
            Spacer(Modifier.height(18.dp))
            Text(
                "Consulta de checadas biométricas",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = LvdColors.TextPrimary,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Selecciona la quincena deseada para auditar tus entradas y salidas.",
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp,
            )
        }

        // Velo de contraste sobre el fondo nativo
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LvdColors.Scrim),
        )

        AnimatedVisibility(
            visible = true,
            enter = fadeIn(LvdMotion.StateTransition) +
                slideInVertically(initialOffsetY = { it / 4 }, animationSpec = tween(220)),
            exit = fadeOut(LvdMotion.StateTransition) +
                slideOutVertically(targetOffsetY = { it / 4 }, animationSpec = tween(220)),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            LvdBottomSheet(
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 4.dp),
                ) {
                    Text(
                        "Registros biométricos",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Tu Perfil IMSS",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = LvdColors.Blue,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Consulta tus registros de entrada y salida registrados en Tu Perfil IMSS.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Información obtenida directamente de Tu Perfil IMSS.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )

                    Spacer(Modifier.height(LvdSpacing.Xxl))

                    // ── OOAD (delegación): fija por ahora a 17 — Michoacán ──
                    if (ooad != null) {
                        Text(
                            "OOAD",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = LvdColors.TextSecondary,
                        )
                        Spacer(Modifier.height(4.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(LvdDimens.FieldHeight)
                                .clip(LvdShapes.Field)
                                .background(LvdColors.SurfaceSoft)
                                .border(1.dp, LvdColors.Border, LvdShapes.Field)
                                .padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = ooad.label,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = LvdColors.TextPrimary,
                                maxLines = 1,
                                modifier = Modifier.weight(1f),
                            )
                            Icon(
                                Icons.Filled.CheckCircle,
                                contentDescription = "OOAD seleccionada",
                                tint = LvdColors.Blue,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        Spacer(Modifier.height(LvdSpacing.Lg))
                    }

                    // ── Campo Periodo: tap → picker LVD (lista de quincenas) ──
                    val sortedPeriods = remember(periods) { BiometricFlowPolicy.sortNewestFirst(periods) }
                    val latestPeriod = remember(sortedPeriods) { BiometricFlowPolicy.defaultPeriod(sortedPeriods) }
                    Text(
                        "Periodo",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (sortedPeriods.isNotEmpty() && !consulting) LvdColors.TextSecondary else LvdColors.TextMuted,
                    )
                    Spacer(Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(LvdDimens.FieldHeight)
                            .clip(LvdShapes.Field)
                            .background(if (sortedPeriods.isNotEmpty() && !consulting) LvdColors.SurfaceSoft else LvdColors.SurfaceSoft)
                            .border(
                                1.dp,
                                if (sortedPeriods.isNotEmpty() && !consulting) LvdColors.Border else LvdColors.Border.copy(alpha = 0.6f),
                                LvdShapes.Field,
                            )
                            .clickable(
                                enabled = sortedPeriods.isNotEmpty() && !consulting,
                                role = Role.Button,
                                onClick = { showPicker = true },
                            )
                            .padding(horizontal = 16.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = selectedPeriod?.label ?: "Selecciona un periodo",
                                fontSize = 15.sp,
                                fontWeight = if (selectedPeriod != null) FontWeight.Medium else FontWeight.Normal,
                                color = if (selectedPeriod != null) LvdColors.TextPrimary else LvdColors.TextMuted,
                                maxLines = 1,
                                modifier = Modifier.weight(1f),
                            )
                            Icon(
                                Icons.Filled.ArrowDropDown,
                                contentDescription = "Elegir periodo",
                                tint = if (sortedPeriods.isNotEmpty() && !consulting) LvdColors.Blue else LvdColors.TextMuted,
                            )
                        }
                    }
                    if (selectedPeriod != null && selectedPeriod == latestPeriod) {
                        Spacer(Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .size(6.dp)
                                    .clip(LvdShapes.Pill)
                                    .background(LvdColors.Info),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Último periodo disponible",
                                fontSize = 12.sp,
                                color = LvdColors.Info,
                                maxLines = 1,
                            )
                        }
                    }

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdPrimaryButton(
                        text = "Consultar registros",
                        onClick = onConsultar,
                        enabled = selectedPeriod != null && sortedPeriods.isNotEmpty() && !consulting,
                        loading = consulting,
                        loadingText = "Consultando registros biométricos…",
                    )

                    Spacer(Modifier.height(LvdSpacing.Sm))

                    TextButton(
                        onClick = onOpenFormularioOriginal,
                        enabled = !consulting,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    ) {
                        Text(
                            "Abrir formulario original",
                            color = LvdColors.TextSecondary,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }
    }

    // ── Picker LVD: bottom sheet con TODAS las quincenas, filas clickeables ─
    if (showPicker) {
        TuPerfilBiometricPeriodPicker(
            periods = periods,
            selectedPeriod = selectedPeriod,
            onPeriodSelected = { p ->
                onPeriodSelected(p)
                showPicker = false
            },
            onDismiss = { showPicker = false },
        )
    }
}

/** Picker de periodo: lista completa ordenada del más reciente al más antiguo, con foco inicial en el más reciente. */
@Composable
fun TuPerfilBiometricPeriodPicker(
    periods: List<BiometricPeriod>,
    selectedPeriod: BiometricPeriod?,
    onPeriodSelected: (BiometricPeriod) -> Unit,
    onDismiss: () -> Unit,
) {
    val sortedPeriods = remember(periods) { BiometricFlowPolicy.sortNewestFirst(periods) }
    val latestPeriod = remember(sortedPeriods) { BiometricFlowPolicy.defaultPeriod(sortedPeriods) }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = 0)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Scrim)
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss,
            ),
    ) {
        LvdBottomSheet(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            onClose = onDismiss,
        ) {
            Text(
                "Selecciona un periodo",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(LvdSpacing.Lg))
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 360.dp),
            ) {
                items(sortedPeriods) { period ->
                    val isSelected = period == selectedPeriod
                    val isLatest = period == latestPeriod
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .clip(LvdShapes.Medium)
                            .background(if (isSelected) LvdColors.Blue.copy(alpha = 0.06f) else Color.Transparent)
                            .clickable(role = Role.RadioButton) {
                                onPeriodSelected(period)
                            }
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                            contentDescription = if (isSelected) "Seleccionado" else "Sin seleccionar",
                            tint = if (isSelected) LvdColors.Blue else LvdColors.BorderStrong,
                            modifier = Modifier.size(22.dp),
                        )
                        Spacer(Modifier.width(LvdSpacing.Md))
                        Text(
                            period.label,
                            fontSize = 15.sp,
                            fontWeight = if (isSelected || isLatest) FontWeight.SemiBold else FontWeight.Normal,
                            color = LvdColors.TextPrimary,
                            maxLines = 2,
                            modifier = Modifier.weight(1f),
                        )
                        if (isLatest) {
                            Spacer(Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(LvdShapes.Pill)
                                    .background(LvdColors.Blue.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                            ) {
                                Text(
                                    "Más reciente",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = LvdColors.Blue,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(2.dp))
                }
            }
            Spacer(Modifier.height(LvdSpacing.Sm))
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text("Cancelar", color = LvdColors.TextSecondary, fontSize = 14.sp)
            }
        }
    }
}

/** Pestañas de la vista de resultados biométricos. */
enum class BiometricResultsTab {
    REGISTROS,
    OMISIONES,
}

/** Panel nativo de resultados (WebView vivo por debajo). */
@Composable
fun TuPerfilBiometricResultsPanel(
    period: BiometricPeriod,
    columns: List<BiometricColumn>,
    records: List<BiometricRecord>,
    initialMode: String = "consultar",
    onChangePeriod: () -> Unit,
    onQueryAgain: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
    onSavePdf: (((String?) -> Unit) -> Unit)? = null,
    onOpenSavedPdf: ((String) -> Unit)? = null,
) {
    var savingPdf by remember { mutableStateOf(false) }
    var savedPdf by remember { mutableStateOf(false) }
    var savedPdfPath by remember { mutableStateOf<String?>(null) }

    val dayGroups = remember(records, columns) {
        BiometricGrouping.groupByDays(columns, records)
    }

    val auditReport = remember(dayGroups) {
        BiometricOmissionDetector.analyze(dayGroups)
    }

    var selectedTab by remember(initialMode) {
        mutableStateOf(
            if (initialMode.equals("omisiones", ignoreCase = true)) {
                BiometricResultsTab.OMISIONES
            } else {
                BiometricResultsTab.REGISTROS
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .padding(horizontal = LvdSpacing.Lg),
    ) {
        Spacer(Modifier.height(LvdSpacing.Lg))

        // Resumen superior — periodo y estado según la pestaña seleccionada
        LvdCard(modifier = Modifier.fillMaxWidth()) {
            Text(
                "Periodo consultado",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = LvdColors.TextSecondary,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                period.label,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(4.dp))
            val recordsCount = if (records.size == 1) "1 registro" else "${records.size} registros"
            val daysCount = if (dayGroups.size == 1) "1 día" else "${dayGroups.size} días"
            val subtitle = if (selectedTab == BiometricResultsTab.REGISTROS) {
                if (dayGroups.isNotEmpty()) "$recordsCount · $daysCount" else recordsCount
            } else {
                if (auditReport.hasOmissions) {
                    if (auditReport.omissions.size == 1) "1 omisión de checada detectada"
                    else "${auditReport.omissions.size} omisiones de checada detectadas"
                } else {
                    "Todas las jornadas completas (${auditReport.completeShiftsCount} turnos)"
                }
            }
            Text(
                subtitle,
                fontSize = 13.sp,
                color = if (selectedTab == BiometricResultsTab.OMISIONES && auditReport.hasOmissions) {
                    Color(0xFFDC2626)
                } else {
                    LvdColors.TextSecondary
                },
                fontWeight = if (selectedTab == BiometricResultsTab.OMISIONES && auditReport.hasOmissions) {
                    FontWeight.SemiBold
                } else {
                    FontWeight.Normal
                },
            )
        }

        Spacer(Modifier.height(LvdSpacing.Md))

        // Selector de Pestañas: Checadas vs Revisar omisiones
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(LvdShapes.Medium)
                .background(LvdColors.SurfaceSoft)
                .border(1.dp, LvdColors.Border.copy(alpha = 0.5f), LvdShapes.Medium)
                .padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Pestaña 1: Checadas
            val isRegistros = selectedTab == BiometricResultsTab.REGISTROS
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(LvdShapes.Small)
                    .background(if (isRegistros) LvdColors.Surface else Color.Transparent)
                    .clickable { selectedTab = BiometricResultsTab.REGISTROS }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Checadas (${dayGroups.size})",
                    fontSize = 13.sp,
                    fontWeight = if (isRegistros) FontWeight.Bold else FontWeight.Medium,
                    color = if (isRegistros) LvdColors.Blue else LvdColors.TextSecondary,
                )
            }

            // Pestaña 2: Omisiones
            val isOmisiones = selectedTab == BiometricResultsTab.OMISIONES
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(LvdShapes.Small)
                    .background(if (isOmisiones) LvdColors.Surface else Color.Transparent)
                    .clickable { selectedTab = BiometricResultsTab.OMISIONES }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Omisiones",
                        fontSize = 13.sp,
                        fontWeight = if (isOmisiones) FontWeight.Bold else FontWeight.Medium,
                        color = if (isOmisiones) LvdColors.Blue else LvdColors.TextSecondary,
                    )
                    Spacer(Modifier.width(6.dp))
                    if (auditReport.hasOmissions) {
                        Box(
                            modifier = Modifier
                                .clip(LvdShapes.Pill)
                                .background(Color(0xFFDC2626))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "${auditReport.omissions.size}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(LvdShapes.Pill)
                                .background(LvdColors.Success.copy(alpha = 0.2f))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "✓",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = LvdColors.SuccessStrong,
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(LvdSpacing.Md))

        // Contenido según la pestaña seleccionada
        if (selectedTab == BiometricResultsTab.REGISTROS) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(LvdSpacing.Md),
            ) {
                if (dayGroups.isNotEmpty()) {
                    items(dayGroups) { dayGroup ->
                        BiometricDayCard(dayGroup = dayGroup)
                    }
                } else {
                    itemsIndexed(records) { _, record ->
                        LvdCard(modifier = Modifier.fillMaxWidth()) {
                            columns.forEachIndexed { columnIndex, column ->
                                val value = record.fields[column.key] ?: ""
                                Text(
                                    column.label,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = LvdColors.TextSecondary,
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    value.ifBlank { "—" },
                                    fontSize = if (columnIndex == 0) 15.sp else 14.sp,
                                    fontWeight = if (columnIndex == 0) FontWeight.SemiBold else FontWeight.Normal,
                                    color = LvdColors.TextPrimary,
                                )
                                if (columnIndex < columns.size - 1) {
                                    Spacer(Modifier.height(LvdSpacing.Sm))
                                }
                            }
                        }
                    }
                }
            }
        } else {
            BiometricOmissionAuditPanel(
                auditReport = auditReport,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(LvdSpacing.Lg))

        // Guardar el PDF de checadas que ofrece Tu Perfil IMSS (mismo lugar que tarjetones).
        if (onSavePdf != null) {
            if (savedPdf && savedPdfPath != null) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    LvdPrimaryButton(
                        text = "Ver PDF de checadas",
                        onClick = { onOpenSavedPdf?.invoke(savedPdfPath!!) },
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(LvdSpacing.Sm))
                    LvdSecondaryButton(
                        text = "Guardado ✓",
                        onClick = { },
                        modifier = Modifier.weight(1f),
                    )
                }
            } else {
                LvdSecondaryButton(
                    text = if (savingPdf) "Generando PDF…" else "Guardar PDF de checadas",
                    onClick = {
                        if (!savingPdf) {
                            savingPdf = true
                            onSavePdf { path ->
                                savingPdf = false
                                if (path != null) {
                                    savedPdf = true
                                    savedPdfPath = path
                                    onOpenSavedPdf?.invoke(path)
                                } else {
                                    savedPdf = false
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Spacer(Modifier.height(LvdSpacing.Sm))
        }

        LvdPrimaryButton(
            text = "Volver a consultar",
            onClick = onQueryAgain,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LvdSecondaryButton(
                text = "Cambiar periodo",
                onClick = onChangePeriod,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(LvdSpacing.Sm))
            TextButton(onClick = onOpenFormularioOriginal) {
                Text("Formulario original", color = LvdColors.TextSecondary, fontSize = 13.sp)
            }
        }
    }
}

/** Tarjeta de un día con sus checadas clasificadas por horario. */
@Composable
fun BiometricDayCard(
    dayGroup: BiometricDayGroup,
    modifier: Modifier = Modifier,
) {
    LvdCard(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f),
            ) {
                Icon(
                    imageVector = Icons.Filled.Schedule,
                    contentDescription = null,
                    tint = LvdColors.Blue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(LvdSpacing.Sm))
                Text(
                    text = dayGroup.displayDate,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LvdColors.TextPrimary,
                    maxLines = 2,
                )
            }
            Spacer(Modifier.width(LvdSpacing.Sm))
            val badgeText = if (dayGroup.punches.size == 1) "1 registro" else "${dayGroup.punches.size} registros"
            Text(
                text = badgeText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = LvdColors.TextSecondary,
            )
        }

        Spacer(Modifier.height(LvdSpacing.Md))

        dayGroup.punches.forEachIndexed { index, punch ->
            BiometricPunchRow(punch = punch)
            if (index < dayGroup.punches.size - 1) {
                Spacer(Modifier.height(LvdSpacing.Sm))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(LvdColors.Border.copy(alpha = 0.5f)),
                )
                Spacer(Modifier.height(LvdSpacing.Sm))
            }
        }
    }
}

/** Fila individual de checada con etiqueta de Entrada / Salida / Intermedia y hora. */
@Composable
fun BiometricPunchRow(
    punch: BiometricPunch,
    modifier: Modifier = Modifier,
) {
    val (badgeBg, badgeFg, label) = when (punch.type) {
        BiometricPunchType.ENTRADA -> Triple(
            LvdColors.Success.copy(alpha = 0.15f),
            LvdColors.SuccessStrong,
            "ENTRADA",
        )
        BiometricPunchType.SALIDA -> Triple(
            LvdColors.Blue.copy(alpha = 0.12f),
            LvdColors.Blue,
            "SALIDA",
        )
        BiometricPunchType.INTERMEDIA -> Triple(
            LvdColors.SurfaceSoft,
            LvdColors.TextSecondary,
            "INTERMEDIA",
        )
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier = Modifier
                    .clip(LvdShapes.Small)
                    .background(badgeBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = badgeFg,
                    letterSpacing = 0.5.sp,
                )
            }

            Text(
                text = punch.formattedTime.ifBlank { "—" },
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
        }

        if (punch.extraFields.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            punch.extraFields.forEach { (fieldLabel, value) ->
                if (value.isNotBlank()) {
                    Text(
                        text = "$fieldLabel: $value",
                        fontSize = 11.sp,
                        color = LvdColors.TextSecondary,
                    )
                }
            }
        }
    }
}

/** Panel de auditoría de omisiones de checada con alertas y recomendaciones normativas. */
@Composable
fun BiometricOmissionAuditPanel(
    auditReport: BiometricAuditReport,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(LvdSpacing.Md),
    ) {
        if (!auditReport.hasOmissions) {
            item {
                LvdCard(
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(LvdShapes.Pill)
                                .background(LvdColors.Success.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.CheckCircle,
                                contentDescription = null,
                                tint = LvdColors.SuccessStrong,
                                modifier = Modifier.size(28.dp),
                            )
                        }

                        Spacer(Modifier.height(LvdSpacing.Md))

                        Text(
                            text = "¡Sin omisiones detectadas!",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = LvdColors.TextPrimary,
                            textAlign = TextAlign.Center,
                        )

                        Spacer(Modifier.height(6.dp))

                        Text(
                            text = "Todas tus jornadas registradas en este periodo cuentan con entrada y salida completas. Se auditaron jornadas diurnas, nocturnas que cruzan medianoche y acumuladas.",
                            fontSize = 13.sp,
                            color = LvdColors.TextSecondary,
                            textAlign = TextAlign.Center,
                            lineHeight = 19.sp,
                        )

                        Spacer(Modifier.height(LvdSpacing.Md))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(LvdShapes.Small)
                                .background(LvdColors.SurfaceSoft)
                                .padding(12.dp),
                        ) {
                            Text(
                                text = "Tus estímulos de puntualidad y asistencia (Conceptos 032 y 033) cuentan con respaldo en tus checadas biométricas.",
                                fontSize = 12.sp,
                                color = LvdColors.TextSecondary,
                                lineHeight = 17.sp,
                            )
                        }
                    }
                }
            }
        } else {
            // Banner de alerta principal
            item {
                LvdCard(
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(LvdShapes.Small)
                                .background(Color(0xFFFEF3C7)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Warning,
                                contentDescription = null,
                                tint = Color(0xFFB45309),
                                modifier = Modifier.size(22.dp),
                            )
                        }

                        Spacer(Modifier.width(LvdSpacing.Md))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (auditReport.omissions.size == 1)
                                    "1 omisión de checada detectada"
                                else
                                    "${auditReport.omissions.size} omisiones de checada detectadas",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF92400E),
                            )

                            Spacer(Modifier.height(4.dp))

                            Text(
                                text = "Acude de inmediato con tu Delegado Sindical y con el Departamento de Personal de tu unidad para ingresar la justificación oficial antes del corte de quincena.",
                                fontSize = 12.sp,
                                color = LvdColors.TextSecondary,
                                lineHeight = 17.sp,
                            )
                        }
                    }
                }
            }

            // Tarjetas individuales de cada omisión detectada
            items(auditReport.omissions) { omission ->
                BiometricOmissionCard(omission = omission)
            }

            // Guía de procedimiento ante Personal
            item {
                LvdCard(
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "Procedimiento oficial ante Personal",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "• Solicita con tu Delegado Sindical la papeleta de omisión de checada.\n" +
                               "• Recaba la firma de visto bueno de tu Jefatura de Servicio donde conste que laboraste tu jornada.\n" +
                               "• Preséntala en la Oficina de Personal antes de la fecha de corte quincenal para proteger tus estímulos 032 y 033.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                        lineHeight = 18.sp,
                    )
                }
            }
        }
    }
}

/** Tarjeta individual de omisión con horario y sugerencia de acción inmediata. */
@Composable
fun BiometricOmissionCard(
    omission: BiometricOmission,
    modifier: Modifier = Modifier,
) {
    val isFaltaEntrada = omission.omissionType == BiometricOmissionType.FALTA_ENTRADA
    val (badgeBg, badgeFg, badgeText) = if (isFaltaEntrada) {
        Triple(Color(0xFFFEE2E2), Color(0xFFDC2626), "FALTA ENTRADA")
    } else {
        Triple(Color(0xFFFEF3C7), Color(0xFFD97706), "FALTA SALIDA")
    }

    LvdCard(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = omission.displayDate,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )

            Box(
                modifier = Modifier
                    .clip(LvdShapes.Small)
                    .background(badgeBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = badgeText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = badgeFg,
                    letterSpacing = 0.5.sp,
                )
            }
        }

        Spacer(Modifier.height(LvdSpacing.Sm))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(LvdShapes.Small)
                .background(LvdColors.SurfaceSoft)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "Checada registrada:",
                    fontSize = 12.sp,
                    color = LvdColors.TextSecondary,
                )
                Text(
                    text = "${omission.recordedPunch.formattedTime} hrs",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LvdColors.TextPrimary,
                )
            }
        }

        Spacer(Modifier.height(LvdSpacing.Sm))

        Text(
            text = omission.explanation,
            fontSize = 12.sp,
            color = LvdColors.TextSecondary,
            lineHeight = 17.sp,
        )

        Spacer(Modifier.height(6.dp))

        Text(
            text = "Acción sugerida: ${omission.recommendation}",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = if (isFaltaEntrada) Color(0xFFB91C1C) else Color(0xFFB45309),
            lineHeight = 17.sp,
        )
    }
}

/**
 * Bottom sheet modal que permite elegir entre consultar biométricos o auditar omisiones.
 */
@Composable
fun TuPerfilBiometricOptionSheet(
    onConsultar: () -> Unit,
    onRevisarOmisiones: () -> Unit,
    onDismiss: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Scrim)
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss,
            ),
    ) {
        LvdBottomSheet(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            onClose = onDismiss,
        ) {
            Text(
                text = "Registros biométricos",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "¿Qué deseas realizar con tus checadas de Tu Perfil IMSS?",
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
            )

            Spacer(Modifier.height(LvdSpacing.Lg))

            // Opción 1: Consultar registros biométricos
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LvdShapes.Medium)
                    .background(LvdColors.SurfaceSoft)
                    .border(1.dp, LvdColors.Border, LvdShapes.Medium)
                    .clickable(role = Role.Button, onClick = onConsultar)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(LvdShapes.Small)
                        .background(LvdColors.Blue.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Fingerprint,
                        contentDescription = null,
                        tint = LvdColors.Blue,
                        modifier = Modifier.size(24.dp),
                    )
                }

                Spacer(Modifier.width(LvdSpacing.Md))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Consultar registros biométricos",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = "Ver tus checadas agrupadas por día y clasificadas por entrada y salida.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                        lineHeight = 16.sp,
                    )
                }

                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = LvdColors.TextMuted,
                    modifier = Modifier.size(18.dp),
                )
            }

            Spacer(Modifier.height(LvdSpacing.Md))

            // Opción 2: Revisar omisiones de checadas
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LvdShapes.Medium)
                    .background(LvdColors.SurfaceSoft)
                    .border(1.dp, LvdColors.Border, LvdShapes.Medium)
                    .clickable(role = Role.Button, onClick = onRevisarOmisiones)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(LvdShapes.Small)
                        .background(Color(0xFFFEF3C7)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = null,
                        tint = Color(0xFFB45309),
                        modifier = Modifier.size(24.dp),
                    )
                }

                Spacer(Modifier.width(LvdSpacing.Md))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Revisar omisiones de checada",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = "Detecta si te faltó entrada o salida para aclararlo con Personal antes de la quincena.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                        lineHeight = 16.sp,
                    )
                }

                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = LvdColors.TextMuted,
                    modifier = Modifier.size(18.dp),
                )
            }

            Spacer(Modifier.height(LvdSpacing.Lg))

            TextButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text("Cancelar", color = LvdColors.TextSecondary, fontSize = 14.sp)
            }
        }
    }
}

/** Estado vacío: el portal respondió bien pero sin checadas. */
@Composable
fun TuPerfilBiometricEmptyPanel(
    period: BiometricPeriod,
    onChangePeriod: () -> Unit,
    onQueryAgain: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .padding(horizontal = LvdSpacing.Lg),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        Icon(
            Icons.Filled.Schedule,
            contentDescription = null,
            tint = LvdColors.Info,
            modifier = Modifier.size(40.dp),
        )
        Spacer(Modifier.height(LvdSpacing.Lg))
        Text(
            "No encontramos registros en este periodo",
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = LvdColors.TextPrimary,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        Text(
            "Tu Perfil IMSS no reportó checadas para el periodo seleccionado.",
            fontSize = 13.sp,
            color = LvdColors.TextSecondary,
        )
        Spacer(Modifier.height(LvdSpacing.Xl))
        LvdPrimaryButton(
            text = "Cambiar periodo",
            onClick = onChangePeriod,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        LvdSecondaryButton(
            text = "Volver a consultar",
            onClick = onQueryAgain,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        TextButton(onClick = onOpenFormularioOriginal) {
            Text("Abrir formulario original", color = LvdColors.TextSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.weight(1f))
    }
}

/** Error de consulta con acciones nativas. */
@Composable
fun TuPerfilBiometricErrorPanel(
    title: String,
    message: String,
    onRetry: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
    onCancel: () -> Unit,
    onCopyDiagnostics: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .padding(horizontal = LvdSpacing.Lg),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        Icon(
            Icons.Filled.Schedule,
            contentDescription = null,
            tint = LvdColors.ErrorStrong,
            modifier = Modifier.size(40.dp),
        )
        Spacer(Modifier.height(LvdSpacing.Lg))
        Text(
            title,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = LvdColors.TextPrimary,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        Text(
            message,
            fontSize = 13.sp,
            color = LvdColors.TextSecondary,
        )
        Spacer(Modifier.height(LvdSpacing.Xl))
        LvdPrimaryButton(
            text = "Reintentar",
            onClick = onRetry,
        )
        Spacer(Modifier.height(LvdSpacing.Sm))
        LvdSecondaryButton(
            text = "Abrir formulario original",
            onClick = onOpenFormularioOriginal,
        )
        if (BuildConfig.DEBUG && onCopyDiagnostics != null) {
            Spacer(Modifier.height(LvdSpacing.Sm))
            LvdSecondaryButton(
                text = "Copiar diagnóstico",
                onClick = onCopyDiagnostics,
            )
        }
        Spacer(Modifier.height(LvdSpacing.Sm))
        TextButton(onClick = onCancel) {
            Text("Cancelar", color = LvdColors.TextSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.weight(1f))
    }
}

/** Diálogo de sesión expirada (tras agotar la reautenticación automática). */
@Composable
fun TuPerfilBiometricSessionExpiredDialog(
    onRelogin: () -> Unit,
    onCancel: () -> Unit,
) {
    LvdDialog(
        onDismissRequest = onCancel,
        title = "Tu sesión de Tu Perfil IMSS terminó",
        text = {
            Column {
                Text(
                    "Necesitamos que vuelvas a iniciar sesión para consultar tus registros biométricos.",
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )
            }
        },
        confirmButton = {
            LvdPrimaryButton(
                text = "Volver a iniciar sesión",
                onClick = onRelogin,
                fullWidth = false,
            )
        },
        dismissButton = {
            TextButton(onClick = onCancel) {
                Text("Cancelar", color = LvdColors.TextSecondary)
            }
        },
    )
}
