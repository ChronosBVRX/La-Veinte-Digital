package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
 * Lo usan TANTO Tarjetones como Registros biométricos.
 */
@Composable
fun TuPerfilLoginErrorDialog(
    kind: PortalLoginErrorKind,
    portalMessage: String? = null,
    onReviewData: () -> Unit,
    onRetry: () -> Unit,
    onManualEntry: () -> Unit,
    onDismiss: () -> Unit,
) {
    val isPortalFault = kind == PortalLoginErrorKind.SERVICE_UNAVAILABLE ||
            kind == PortalLoginErrorKind.TIMEOUT

    LvdDialog(
        onDismissRequest = onDismiss,
        title = "No pudimos iniciar sesión",
        text = {
            Column {
                Text(
                    if (isPortalFault) {
                        "Tu Perfil IMSS no está disponible en este momento. Tus datos guardados no se han modificado."
                    } else {
                        "Tu Perfil IMSS rechazó el inicio de sesión."
                    },
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )

                if (kind != PortalLoginErrorKind.FIELDS_REQUIRED && !portalMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        portalMessage,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                }

                Spacer(Modifier.height(12.dp))

                when (kind) {
                    PortalLoginErrorKind.BAD_CREDENTIALS -> Text(
                        "Verifica tu matrícula y contraseña e inténtalo nuevamente. Si recientemente cambiaste tu contraseña, actualiza también los datos guardados en la app.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.FIELDS_REQUIRED -> Text(
                        "El formulario no estaba listo al intentar iniciar sesión automáticamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED -> Text(
                        "Verifica el estado de tu cuenta en el portal oficial.",
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
            }
        },
        confirmButton = {
            when (kind) {
                PortalLoginErrorKind.BAD_CREDENTIALS,
                PortalLoginErrorKind.UNKNOWN -> LvdPrimaryButton(
                    text = "Revisar datos",
                    onClick = onReviewData,
                    fullWidth = false,
                )
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
            TextButton(onClick = onManualEntry) {
                Text("Entrar manualmente", color = LvdColors.TextSecondary)
            }
        },
    )
}
