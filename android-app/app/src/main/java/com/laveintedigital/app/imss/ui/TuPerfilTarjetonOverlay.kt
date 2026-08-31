package com.laveintedigital.app.imss.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.tarjeton.ImssPeriodOption
import com.laveintedigital.app.imss.tarjeton.PortalOoad
import com.laveintedigital.app.imss.tarjeton.PortalPageState
import com.laveintedigital.app.ui.lvd.LvdBottomSheet
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdErrorState
import com.laveintedigital.app.ui.lvd.LvdMotion
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSecondaryButton
import com.laveintedigital.app.ui.lvd.LvdSelectField
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdSuccessState

/**
 * Overlay de consulta de tarjetón de Tu Perfil IMSS (LVD).
 *
 * Pantalla: selector OOAD → selector periodo → Consultar → Generating → Success/Error.
 * La lógica funcional NO cambia; solo la presentación (bottom sheet 28dp).
 */
@Composable
fun TuPerfilTarjetonOverlay(
    pageState: PortalPageState,
    ooadOptions: List<PortalOoad>,
    selectedOoad: PortalOoad?,
    onOoadSelected: (PortalOoad) -> Unit,
    periodOptions: List<ImssPeriodOption>,
    selectedPeriod: ImssPeriodOption?,
    onPeriodSelected: (ImssPeriodOption) -> Unit,
    onConsultar: () -> Unit,
    onOpenFormularioOriginal: () -> Unit,
    debugStage: String = "",
    errorMessage: String? = null,
    onRetry: (() -> Unit)? = null,
    savedTitle: String? = null,
    onViewTarjeton: (() -> Unit)? = null,
    onOpenHistory: (() -> Unit)? = null,
) {
    val visible = pageState != PortalPageState.INITIALIZING && pageState != PortalPageState.LOGIN

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(LvdMotion.StateTransition) +
            slideInVertically(initialOffsetY = { it / 4 }, animationSpec = tween(220)),
        exit = fadeOut(LvdMotion.StateTransition) +
            slideOutVertically(targetOffsetY = { it / 4 }, animationSpec = tween(220)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LvdColors.Scrim)
                .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
        ) {
            LvdBottomSheet(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 4.dp),
                ) {
                    // Título
                    Text(
                        "Consultar tarjetón",
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
                        "Datos obtenidos directamente del portal oficial del IMSS.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )

                    Spacer(Modifier.height(LvdSpacing.Xxl))

                    val ready = pageState == PortalPageState.READY

                    LvdSelectField(
                        label = "OOAD",
                        value = selectedOoad,
                        valueLabel = selectedOoad?.displayLabel ?: "",
                        placeholder = "Cargando...",
                        options = ooadOptions,
                        optionLabel = { it.displayLabel },
                        onSelected = onOoadSelected,
                        enabled = ready,
                    )

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdSelectField(
                        label = "Periodo",
                        value = selectedPeriod,
                        valueLabel = selectedPeriod?.displayLabel ?: "",
                        placeholder = "Cargando...",
                        options = periodOptions,
                        optionLabel = { it.displayLabel },
                        onSelected = onPeriodSelected,
                        enabled = ready,
                        hint = "Último periodo disponible",
                    )

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    // Debug stage (solo builds de debug)
                    if (BuildConfig.DEBUG && debugStage.isNotBlank()) {
                        Text(
                            "Preparando: $debugStage",
                            fontSize = 11.sp,
                            color = LvdColors.Info,
                        )
                        Spacer(Modifier.height(LvdSpacing.Sm))
                    }

                    Spacer(Modifier.height(4.dp))

                    // Acción principal según estado
                    when (pageState) {
                        PortalPageState.GENERATING -> LvdPrimaryButton(
                            text = "Consultar tarjetón",
                            loading = true,
                            loadingText = "Generando tu tarjetón…",
                            onClick = onConsultar,
                            enabled = false,
                        )
                        PortalPageState.COMPLETED -> LvdPrimaryButton(
                            text = "Tarjetón guardado",
                            onClick = {},
                            enabled = false,
                        )
                        else -> LvdPrimaryButton(
                            text = "Consultar tarjetón",
                            onClick = onConsultar,
                            enabled = ready,
                        )
                    }

                    // Success
                    if (pageState == PortalPageState.COMPLETED && savedTitle != null) {
                        Spacer(Modifier.height(LvdSpacing.Xl))
                        LvdSuccessState(
                            title = savedTitle,
                            subtitle = "Guardado en este dispositivo y disponible sin conexión.",
                        )
                        Spacer(Modifier.height(LvdSpacing.Lg))
                        Row {
                            LvdSecondaryButton(
                                text = "Ver tarjetón",
                                onClick = { onViewTarjeton?.invoke() },
                            )
                            Spacer(Modifier.width(LvdSpacing.Sm))
                            TextButton(onClick = { onOpenHistory?.invoke() }) {
                                Text("Histórico", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
                            }
                        }
                    }

                    // Error
                    if (pageState == PortalPageState.ERROR) {
                        Spacer(Modifier.height(LvdSpacing.Xl))
                        LvdErrorState(
                            message = errorMessage ?: "No pudimos preparar tus tarjetones.",
                            onRetry = onRetry,
                        )
                        Spacer(Modifier.height(4.dp))
                        TextButton(
                            onClick = onOpenFormularioOriginal,
                            modifier = Modifier.padding(vertical = 4.dp),
                        ) {
                            Text("Abrir formulario original", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }
}
