package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.biometric.BiometricColumn
import com.laveintedigital.app.imss.biometric.BiometricGrouping
import com.laveintedigital.app.imss.biometric.BiometricOmission
import com.laveintedigital.app.imss.biometric.BiometricOmissionDetector
import com.laveintedigital.app.imss.biometric.BiometricPeriod
import com.laveintedigital.app.imss.biometric.BiometricRecord
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdShapes
import com.laveintedigital.app.ui.lvd.LvdSpacing

/**
 * Panel de resumen exclusivo para el flujo de "Revisar mi quincena".
 * Muestra directamente si el trabajador tiene o no faltas u omisiones de registro
 * en el último periodo disponible en Tu Perfil IMSS.
 */
@Composable
fun TuPerfilBiometricQuincenaSummaryPanel(
    period: BiometricPeriod,
    columns: List<BiometricColumn>,
    records: List<BiometricRecord>,
    onVerDetalleCompleto: () -> Unit,
    onConsultarOtroPeriodo: () -> Unit,
    onClose: () -> Unit,
) {
    val dayGroups = remember(records, columns) {
        BiometricGrouping.groupByDays(columns, records)
    }

    val auditReport = remember(dayGroups) {
        BiometricOmissionDetector.analyze(dayGroups)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = LvdSpacing.Lg, vertical = 16.dp),
    ) {
        // Encabezado del periodo
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Resumen de quincena",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = LvdColors.TextSecondary,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = period.label,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = LvdColors.TextPrimary,
                )
            }
            Box(
                modifier = Modifier
                    .clip(LvdShapes.Pill)
                    .background(LvdColors.SurfaceSoft)
                    .border(1.dp, LvdColors.Border, LvdShapes.Pill)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(
                    text = "Último periodo",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LvdColors.TextSecondary,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // Hero Card del Estado de la Quincena
        if (!auditReport.hasOmissions) {
            // Caso A: Sin omisiones detectadas
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LvdShapes.Large)
                    .background(Color(0xFFF0FDF4))
                    .border(1.dp, Color(0xFFBBF7D0), LvdShapes.Large)
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(LvdShapes.Pill)
                        .background(Color(0xFFDCFCE7)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFF16A34A),
                        modifier = Modifier.size(36.dp),
                    )
                }

                Spacer(Modifier.height(12.dp))

                Text(
                    text = "¡Sin omisiones de registro!",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF15803D),
                )

                Spacer(Modifier.height(6.dp))

                Text(
                    text = "Todas tus jornadas cuentan con sus registros completos de entrada y salida en Tu Perfil IMSS.",
                    fontSize = 13.sp,
                    color = Color(0xFF166534),
                    lineHeight = 18.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )

                Spacer(Modifier.height(16.dp))

                // Resumen estadístico
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(LvdShapes.Medium)
                        .background(Color.White)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${auditReport.completeShiftsCount}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF15803D),
                        )
                        Text(
                            text = if (auditReport.completeShiftsCount == 1) "Turno completo" else "Turnos completos",
                            fontSize = 11.sp,
                            color = LvdColors.TextSecondary,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(32.dp)
                            .background(LvdColors.Border),
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${auditReport.totalPunches}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = LvdColors.TextPrimary,
                        )
                        Text(
                            text = if (auditReport.totalPunches == 1) "Checada registrada" else "Checadas registradas",
                            fontSize = 11.sp,
                            color = LvdColors.TextSecondary,
                        )
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Protección de estímulos
                Text(
                    text = "🛡️ Tus estímulos de puntualidad y asistencia (conceptos 032 y 033 del CCT) están protegidos contra descuentos por omisión de checada en esta quincena.",
                    fontSize = 12.sp,
                    color = Color(0xFF166534),
                    lineHeight = 16.sp,
                )
            }
        } else {
            // Caso B: Se detectaron omisiones de registro
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LvdShapes.Large)
                    .background(Color(0xFFFEF2F2))
                    .border(1.dp, Color(0xFFFECACA), LvdShapes.Large)
                    .padding(20.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(LvdShapes.Medium)
                            .background(Color(0xFFFEE2E2)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            tint = Color(0xFFDC2626),
                            modifier = Modifier.size(26.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (auditReport.omissions.size == 1) "1 omisión detectada" else "${auditReport.omissions.size} omisiones detectadas",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF991B1B),
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = "Se encontraron turnos con falta de entrada o salida.",
                            fontSize = 12.sp,
                            color = Color(0xFF7F1D1D),
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                Text(
                    text = "Detalle de omisiones:",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF991B1B),
                )

                Spacer(Modifier.height(8.dp))

                auditReport.omissions.forEach { omission ->
                    QuincenaOmissionItemCard(omission = omission)
                    Spacer(Modifier.height(8.dp))
                }

                Spacer(Modifier.height(8.dp))

                // Orientación sindical y administrativa
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(LvdShapes.Medium)
                        .background(Color(0xFFFFFBEB))
                        .border(1.dp, Color(0xFFFDE68A), LvdShapes.Medium)
                        .padding(12.dp),
                ) {
                    Text(
                        text = "💡 ¿Qué debes hacer para proteger tus estímulos?",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF92400E),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Acude con la Oficina de Control de Personal y tu Delegación Sindical para tramitar el pase de omisión o justificación oportuna antes del corte de nómina. Esto protege tus estímulos de puntualidad y asistencia (conceptos 032 y 033).",
                        fontSize = 12.sp,
                        color = Color(0xFF78350F),
                        lineHeight = 16.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // Botones de acción inferiores
        Button(
            onClick = onClose,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = LvdColors.Navy),
            shape = LvdShapes.Medium,
        ) {
            Text(
                text = "Entendido",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }

        Spacer(Modifier.height(10.dp))

        OutlinedButton(
            onClick = onVerDetalleCompleto,
            modifier = Modifier.fillMaxWidth().height(46.dp),
            shape = LvdShapes.Medium,
        ) {
            Icon(
                imageVector = Icons.Filled.Schedule,
                contentDescription = null,
                tint = LvdColors.Blue,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "Ver detalle completo de checadas",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = LvdColors.Blue,
            )
        }

        Spacer(Modifier.height(8.dp))

        TextButton(
            onClick = onConsultarOtroPeriodo,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "Consultar otro periodo",
                fontSize = 13.sp,
                color = LvdColors.TextSecondary,
            )
        }
    }
}

@Composable
private fun QuincenaOmissionItemCard(omission: BiometricOmission) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(LvdShapes.Medium)
            .background(Color.White)
            .border(1.dp, Color(0xFFFCA5A5), LvdShapes.Medium)
            .padding(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = omission.displayDate,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = LvdColors.TextPrimary,
            )
            Box(
                modifier = Modifier
                    .clip(LvdShapes.Pill)
                    .background(Color(0xFFFEE2E2))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    text = omission.omissionType.label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFDC2626),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Checada registrada: ${omission.recordedPunch.formattedTime} (${omission.shiftDescription})",
            fontSize = 12.sp,
            color = LvdColors.TextSecondary,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = omission.explanation,
            fontSize = 11.sp,
            color = Color(0xFFB91C1C),
            lineHeight = 15.sp,
        )
    }
}

/** Estado vacío cuando la última quincena no tiene marcas en el portal. */
@Composable
fun TuPerfilBiometricQuincenaEmptyPanel(
    period: BiometricPeriod,
    onConsultarOtroPeriodo: () -> Unit,
    onClose: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LvdColors.Background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(LvdShapes.Pill)
                .background(LvdColors.SurfaceSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Info,
                contentDescription = null,
                tint = LvdColors.TextSecondary,
                modifier = Modifier.size(36.dp),
            )
        }

        Spacer(Modifier.height(16.dp))

        Text(
            text = "Sin registros para este periodo",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.TextPrimary,
        )

        Spacer(Modifier.height(6.dp))

        Text(
            text = "El portal de Tu Perfil IMSS no reporta registros de checada aún para el periodo \"${period.label}\".",
            fontSize = 13.sp,
            color = LvdColors.TextSecondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            lineHeight = 18.sp,
        )

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onConsultarOtroPeriodo,
            colors = ButtonDefaults.buttonColors(containerColor = LvdColors.Navy),
            shape = LvdShapes.Medium,
        ) {
            Text("Consultar otro periodo", color = Color.White)
        }

        Spacer(Modifier.height(12.dp))

        TextButton(onClick = onClose) {
            Text("Cerrar", color = LvdColors.TextSecondary)
        }
    }
}
