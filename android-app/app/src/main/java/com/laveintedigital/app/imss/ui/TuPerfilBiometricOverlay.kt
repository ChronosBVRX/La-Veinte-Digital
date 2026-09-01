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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Schedule
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.biometric.BiometricColumn
import com.laveintedigital.app.imss.biometric.BiometricOoad
import com.laveintedigital.app.imss.biometric.BiometricPeriod
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
            .background(LvdColors.Scrim)
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
    ) {
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
                    Text(
                        "Periodo",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (periods.isNotEmpty() && !consulting) LvdColors.TextSecondary else LvdColors.TextMuted,
                    )
                    Spacer(Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(LvdDimens.FieldHeight)
                            .clip(LvdShapes.Field)
                            .background(if (periods.isNotEmpty() && !consulting) LvdColors.SurfaceSoft else LvdColors.SurfaceSoft)
                            .border(
                                1.dp,
                                if (periods.isNotEmpty() && !consulting) LvdColors.Border else LvdColors.Border.copy(alpha = 0.6f),
                                LvdShapes.Field,
                            )
                            .clickable(
                                enabled = periods.isNotEmpty() && !consulting,
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
                                tint = if (periods.isNotEmpty() && !consulting) LvdColors.Blue else LvdColors.TextMuted,
                            )
                        }
                    }

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdPrimaryButton(
                        text = "Consultar registros",
                        onClick = onConsultar,
                        enabled = selectedPeriod != null && periods.isNotEmpty() && !consulting,
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

/** Picker de periodo: lista completa, cada fila entera es clickeable. */
@Composable
fun TuPerfilBiometricPeriodPicker(
    periods: List<BiometricPeriod>,
    selectedPeriod: BiometricPeriod?,
    onPeriodSelected: (BiometricPeriod) -> Unit,
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
                "Selecciona un periodo",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.TextPrimary,
            )
            Spacer(Modifier.height(LvdSpacing.Lg))
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 360.dp),
            ) {
                items(periods) { period ->
                    val isSelected = period == selectedPeriod
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .clip(LvdShapes.Medium)
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
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            color = LvdColors.TextPrimary,
                            maxLines = 2,
                        )
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

/** Panel nativo de resultados (WebView vivo por debajo). */
@Composable
fun TuPerfilBiometricResultsPanel(
    period: BiometricPeriod,
    columns: List<BiometricColumn>,
    records: List<BiometricRecord>,
    onChangePeriod: () -> Unit,
    onQueryAgain: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
    onSavePdf: (((String?) -> Unit) -> Unit)? = null,
    onOpenSavedPdf: ((String) -> Unit)? = null,
) {
    var savingPdf by remember { mutableStateOf(false) }
    var savedPdf by remember { mutableStateOf(false) }
    var savedPdfPath by remember { mutableStateOf<String?>(null) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .padding(horizontal = LvdSpacing.Lg),
    ) {
        Spacer(Modifier.height(LvdSpacing.Lg))

        // Resumen superior — solo datos que el portal ya reporta.
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
            Text(
                if (records.size == 1) "1 registro" else "${records.size} registros",
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
            )
        }

        Spacer(Modifier.height(LvdSpacing.Lg))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(LvdSpacing.Md),
        ) {
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
        Spacer(Modifier.height(LvdSpacing.Lg))
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
