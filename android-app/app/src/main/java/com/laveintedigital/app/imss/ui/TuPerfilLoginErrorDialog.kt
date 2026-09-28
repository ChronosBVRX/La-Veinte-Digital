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
import com.laveintedigital.app.imss.portal.PortalLoginErrorKind
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton

/**
 * Modal de error de login de Tu Perfil IMSS (LVD).
 *
 * Presenta el mensaje detectado en el portal dentro de un modal propio de La
 * Veinte Digital, clasificado por [PortalLoginErrorKind]. "Campo obligatorio"
 * se trata como fallo interno de automatización (nunca se culpa al usuario).
 * Incluye freno preventivo contra bloqueo de cuenta IMSS y aclaración de qué
 * contraseña corresponde a cada portal.
 */
@Composable
fun TuPerfilLoginErrorDialog(
    kind: PortalLoginErrorKind,
    portalMessage: String? = null,
    failedAttempts: Int = 1,
    wasAutoLogin: Boolean = false,
    onReviewData: () -> Unit,
    onRetry: () -> Unit,
    onManualEntry: () -> Unit,
    onSwitchPortal: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
    val isPortalFault = kind == PortalLoginErrorKind.SERVICE_UNAVAILABLE ||
            kind == PortalLoginErrorKind.TIMEOUT
    val isCredentialError = kind == PortalLoginErrorKind.BAD_CREDENTIALS
    val isLockoutGuardActive = isCredentialError &&
            ImssLoginProtectionPolicy.isLockoutGuardActive(failedAttempts)

    LvdDialog(
        onDismissRequest = onDismiss,
        title = if (isLockoutGuardActive) {
            "Protección contra bloqueo activada"
        } else {
            "No pudimos iniciar sesión en Tu Perfil IMSS"
        },
        text = {
            Column {
                Text(
                    if (isPortalFault) {
                        "Tu Perfil IMSS no está disponible en este momento. Tus datos guardados no se han modificado."
                    } else {
                        "El portal oficial Tu Perfil IMSS (tuperfil.imss.gob.mx) rechazó la contraseña."
                    },
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )

                if (kind != PortalLoginErrorKind.FIELDS_REQUIRED && !portalMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        portalMessage,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                }

                if (wasAutoLogin && isCredentialError) {
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
                            "Eliminamos la contraseña guardada que fue rechazada para que la app no vuelva a intentarla sola y bloquee tu cuenta.",
                            fontSize = 12.sp,
                            color = LvdColors.TextPrimary,
                            lineHeight = 16.sp,
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                when (kind) {
                    PortalLoginErrorKind.BAD_CREDENTIALS -> {
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
                                    "Detuvimos los intentos automáticos ($failedAttempts fallos seguidos)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = LvdColors.ErrorStrong,
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Si sigues intentando una contraseña de otro sistema, Tu Perfil IMSS bloqueará tu cuenta temporalmente.\n\n" +
                                            "• Si tu contraseña es la del Tarjetón Digital clásico (con delegación), cambia a esa opción abajo.\n" +
                                            "• Si olvidaste tu contraseña de Tu Perfil IMSS, entra manualmente al portal para usar «¿Olvidaste tu contraseña?».",
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
                                    "¿Por qué suele pasar esto?",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = LvdColors.TextPrimary,
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Esta opción usa exclusivamente la cuenta de Tu Perfil IMSS. No uses la contraseña del Tarjetón Digital clásico ni la de La Veinte Digital.",
                                    fontSize = 12.sp,
                                    color = LvdColors.TextSecondary,
                                    lineHeight = 16.sp,
                                )
                            }
                        }
                    }
                    PortalLoginErrorKind.FIELDS_REQUIRED -> Text(
                        "El formulario no estaba listo al intentar iniciar sesión automáticamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED -> Text(
                        "El portal indica que la cuenta está bloqueada o aún no está registrada en Tu Perfil IMSS. Revisa el estado directamente en el portal oficial o usa la opción de Tarjetón Digital clásico.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.SERVICE_UNAVAILABLE -> Text(
                        "Intenta nuevamente en unos minutos. No hay nada que cambies en la app.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.UNKNOWN -> Text(
                        "La app detectó un mensaje en el portal. Puedes revisar tus datos o intentarlo nuevamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.TIMEOUT -> Text(
                        "El portal tardó demasiado en responder. Intenta nuevamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                }

                if (onSwitchPortal != null && (isCredentialError || kind == PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED)) {
                    Spacer(Modifier.height(6.dp))
                    TextButton(
                        onClick = onSwitchPortal,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Ir a Tarjetón Digital clásico (otra cuenta)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = LvdColors.Primary,
                        )
                    }
                }
            }
        },
        confirmButton = {
            when (kind) {
                PortalLoginErrorKind.BAD_CREDENTIALS,
                PortalLoginErrorKind.UNKNOWN -> if (isLockoutGuardActive) {
                    LvdPrimaryButton(
                        text = "Ver portal / Recuperar",
                        onClick = onManualEntry,
                        fullWidth = false,
                    )
                } else {
                    LvdPrimaryButton(
                        text = "Revisar contraseña",
                        onClick = onReviewData,
                        fullWidth = false,
                    )
                }
                PortalLoginErrorKind.FIELDS_REQUIRED,
                PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED -> LvdPrimaryButton(
                    text = "Entrar manualmente",
                    onClick = onManualEntry,
                    fullWidth = false,
                )
                PortalLoginErrorKind.SERVICE_UNAVAILABLE,
                PortalLoginErrorKind.TIMEOUT -> LvdPrimaryButton(
                    text = "Intentar nuevamente",
                    onClick = onRetry,
                    fullWidth = false,
                )
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

