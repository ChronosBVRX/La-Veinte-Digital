package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.portal.ImssLoginProtectionPolicy
import com.laveintedigital.app.imss.portal.TarjetonDigitalFlowState
import com.laveintedigital.app.imss.portal.TarjetonDigitalLoginErrorParser
import com.laveintedigital.app.imss.portal.TarjetonDigitalLoginResult
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton

/**
 * Modal de error de login de Tarjetón Digital IMSS (LVD).
 *
 * Transforma el resultado clasificado del portal en un modal propio. Un
 * `MissingFields` se trata como fallo interno de automatización (no se culpa
 * al usuario); incluye protección contra bloqueo de cuenta y cambio rápido
 * a Tu Perfil IMSS si el usuario confundió sus credenciales.
 */
@Composable
fun TarjetonDigitalLoginErrorDialog(
    error: TarjetonDigitalFlowState.LoginError,
    onReviewData: () -> Unit,
    onRetry: () -> Unit,
    onManualEntry: () -> Unit,
    onSwitchPortal: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
    val result = error.result
    val isPortalFault = TarjetonDigitalLoginErrorParser.isPortalFault(result)
    val isCredentialError = result is TarjetonDigitalLoginResult.InvalidCredentials
    val isLockoutGuardActive = isCredentialError &&
            ImssLoginProtectionPolicy.isLockoutGuardActive(error.failedAttempts)

    LvdDialog(
        onDismissRequest = onDismiss,
        title = if (isLockoutGuardActive) {
            "Protección contra bloqueo activada"
        } else {
            "No pudimos iniciar sesión en Tarjetón Digital"
        },
        text = {
            Column {
                Text(
                    if (isPortalFault) {
                        "Tarjetón Digital IMSS no está disponible en este momento. Tus datos guardados no se han modificado."
                    } else {
                        "El portal de Tarjetón Digital rechazó los datos de acceso."
                    },
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )

                val portalMessage = error.portalMessage
                if (result !is TarjetonDigitalLoginResult.MissingFields && !portalMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        portalMessage,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                }

                if (error.wasAutoLogin && isCredentialError) {
                    Spacer(Modifier.height(10.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(LvdColors.Warning.copy(alpha = 0.16f))
                            .border(1.dp, LvdColors.Warning.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                    ) {
                        Text(
                            "Ingreso automático pausado por seguridad",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = LvdColors.TextPrimary,
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            "Eliminamos los datos guardados rechazados para evitar que la app siga intentando sola y bloquee tu cuenta.",
                            fontSize = 12.sp,
                            color = LvdColors.TextPrimary,
                            lineHeight = 16.sp,
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                when (result) {
                    is TarjetonDigitalLoginResult.InvalidCredentials -> {
                        if (isLockoutGuardActive) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(LvdColors.Error.copy(alpha = 0.25f))
                                    .border(1.dp, LvdColors.ErrorStrong.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                                    .padding(12.dp),
                            ) {
                                Text(
                                    "Detuvimos los intentos automáticos (${error.failedAttempts} fallos seguidos)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = LvdColors.ErrorStrong,
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Si continúas intentando una contraseña equivocada, el portal del Tarjetón Digital puede bloquear tu cuenta.\n\n" +
                                            "• Verifica que tu delegación sea la correcta.\n" +
                                            "• Si tu contraseña es la de Tu Perfil IMSS (biométrico), cambia a esa opción abajo.",
                                    fontSize = 12.sp,
                                    color = LvdColors.TextPrimary,
                                    lineHeight = 16.sp,
                                )
                            }
                        } else {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(LvdColors.SurfaceSoft)
                                    .border(1.dp, LvdColors.Border, RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                            ) {
                                Text(
                                    "¿Qué cuenta debes usar aquí?",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = LvdColors.TextPrimary,
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Verifica tu delegación, usuario/matrícula y la contraseña exclusiva del Tarjetón Digital clásico (no es la de Tu Perfil IMSS ni la de La Veinte Digital).",
                                    fontSize = 12.sp,
                                    color = LvdColors.TextSecondary,
                                    lineHeight = 16.sp,
                                )
                            }
                        }
                    }
                    is TarjetonDigitalLoginResult.MissingFields -> Text(
                        "El formulario no estaba listo al intentar iniciar sesión automáticamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.AccountLocked -> Text(
                        "El portal indica que tu cuenta de Tarjetón Digital está bloqueada. Puedes recuperar tu contraseña directamente en el portal o consultar tu tarjetón desde Tu Perfil IMSS.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.ServiceUnavailable -> Text(
                        "Intenta nuevamente en unos minutos. No hay nada que cambies en la app.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.SessionExpired -> Text(
                        "Tu sesión en el portal expiró. Intenta nuevamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.PortalError -> Text(
                        "La app detectó un mensaje en el portal. Puedes revisar tus datos o intentarlo nuevamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.UnknownError -> Text(
                        "La app detectó un mensaje en el portal. Puedes revisar tus datos o intentarlo nuevamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.Success -> {}
                }

                if (onSwitchPortal != null && (isCredentialError || result is TarjetonDigitalLoginResult.AccountLocked)) {
                    Spacer(Modifier.height(6.dp))
                    TextButton(
                        onClick = onSwitchPortal,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Ir a Tu Perfil IMSS (otra cuenta)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = LvdColors.Primary,
                        )
                    }
                }
            }
        },
        confirmButton = {
            when (result) {
                is TarjetonDigitalLoginResult.InvalidCredentials,
                is TarjetonDigitalLoginResult.PortalError,
                is TarjetonDigitalLoginResult.UnknownError -> if (isLockoutGuardActive) {
                    LvdPrimaryButton(
                        text = "Ver portal / Recuperar",
                        onClick = onManualEntry,
                        fullWidth = false,
                    )
                } else {
                    LvdPrimaryButton(
                        text = "Revisar datos",
                        onClick = onReviewData,
                        fullWidth = false,
                    )
                }
                is TarjetonDigitalLoginResult.MissingFields,
                is TarjetonDigitalLoginResult.AccountLocked -> LvdPrimaryButton(
                    text = "Entrar manualmente",
                    onClick = onManualEntry,
                    fullWidth = false,
                )
                is TarjetonDigitalLoginResult.ServiceUnavailable,
                is TarjetonDigitalLoginResult.SessionExpired -> LvdPrimaryButton(
                    text = "Intentar nuevamente",
                    onClick = onRetry,
                    fullWidth = false,
                )
                is TarjetonDigitalLoginResult.Success -> {}
            }
        },
        dismissButton = {
            if (isLockoutGuardActive) {
                TextButton(onClick = onReviewData) {
                    Text("Corregir contraseña", color = LvdColors.TextSecondary)
                }
            } else {
                TextButton(onClick = onManualEntry) {
                    Text("Entrar manualmente", color = LvdColors.TextSecondary)
                }
            }
        },
    )
}

