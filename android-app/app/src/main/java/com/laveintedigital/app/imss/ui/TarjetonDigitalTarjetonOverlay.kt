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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import com.laveintedigital.app.imss.portal.TarjetonDigitalFlowController.TarjetonTipo
import com.laveintedigital.app.imss.portal.TarjetonPeriod
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
 * Overlay de consulta de tarjetón de Tarjetón Digital IMSS (LVD).
 *
 * Periodo → Tipo (Tarjetón de Pago / Listado de Conceptos / XML) → Consultar.
 * El formato se fija internamente en "Archivo" para poder capturar el PDF.
 */
@Composable
fun TarjetonDigitalTarjetonOverlay(
    periods: List<TarjetonPeriod>,
    selectedPeriod: TarjetonPeriod?,
    onPeriodSelected: (TarjetonPeriod) -> Unit,
    tipo: TarjetonTipo,
    onTipoSelected: (TarjetonTipo) -> Unit,
    onConsultar: () -> Unit,
    generating: Boolean,
    errorMessage: String? = null,
    onRetry: (() -> Unit)? = null,
    onOpenFormularioOriginal: () -> Unit,
    savedTitle: String? = null,
    onViewTarjeton: (() -> Unit)? = null,
    onOpenHistory: (() -> Unit)? = null,
    onOpenLoginOriginal: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Scrim),
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
                Text(
                    "Consultar tarjetón",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LvdColors.TextPrimary,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "Tarjetón Digital IMSS",
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

                val ready = periods.isNotEmpty() && !generating

                LvdSelectField(
                    label = "Periodo",
                    value = selectedPeriod,
                    valueLabel = selectedPeriod?.displayLabel ?: "",
                    placeholder = "Cargando...",
                    options = periods,
                    optionLabel = { it.displayLabel },
                    onSelected = onPeriodSelected,
                    enabled = ready,
                )

                Spacer(Modifier.height(LvdSpacing.Lg))

                LvdSelectField(
                    label = "Tipo de comprobante",
                    value = tipo,
                    valueLabel = tipo.displayName,
                    placeholder = "Selecciona un tipo",
                    options = TarjetonTipo.entries,
                    optionLabel = { it.displayName },
                    onSelected = onTipoSelected,
                    enabled = ready,
                )

                Spacer(Modifier.height(LvdSpacing.Lg))

                when {
                    generating -> LvdPrimaryButton(
                        text = "Consultar tarjetón",
                        loading = true,
                        loadingText = "Generando tu tarjetón…",
                        onClick = onConsultar,
                        enabled = false,
                    )
                    savedTitle != null -> LvdPrimaryButton(
                        text = "Tarjetón guardado",
                        onClick = {},
                        enabled = false,
                    )
                    else -> LvdPrimaryButton(
                        text = "Consultar tarjetón",
                        onClick = onConsultar,
                        enabled = ready && selectedPeriod != null,
                    )
                }

                if (savedTitle != null) {
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

                if (errorMessage != null) {
                    Spacer(Modifier.height(LvdSpacing.Xl))
                    LvdErrorState(message = errorMessage, onRetry = onRetry)
                }

                if (errorMessage != null || savedTitle == null) {
                    Spacer(Modifier.height(4.dp))
                    TextButton(
                        onClick = onOpenFormularioOriginal,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Text("Abrir formulario original", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
                    }
                    TextButton(
                        onClick = onOpenLoginOriginal,
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        Text("Cerrar sesión en el portal", color = LvdColors.TextSecondary)
                    }
                }
            }
        }
    }
}

private val TarjetonTipo.displayName: String
    get() = when (this) {
        TarjetonTipo.TARJETON -> "Tarjetón de Pago"
        TarjetonTipo.CONCEPTOS -> "Listado de Conceptos"
        TarjetonTipo.XML -> "XML"
    }
