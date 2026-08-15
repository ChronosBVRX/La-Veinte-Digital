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
 * al usuario); los mensajes reales del portal se muestran cuando aportan valor.
 */
@Composable
fun TarjetonDigitalLoginErrorDialog(
    error: TarjetonDigitalFlowState.LoginError,
    onReviewData: () -> Unit,
    onRetry: () -> Unit,
    onManualEntry: () -> Unit,
    onDismiss: () -> Unit,
) {
    val result = error.result
    val isPortalFault = TarjetonDigitalLoginErrorParser.isPortalFault(result)

    LvdDialog(
        onDismissRequest = onDismiss,
        title = "No pudimos iniciar sesión",
        text = {
            Column {
                Text(
                    if (isPortalFault) {
                        "Tarjetón Digital IMSS no está disponible en este momento. Tus datos guardados no se han modificado."
                    } else {
                        "Tarjetón Digital IMSS rechazó el inicio de sesión."
                    },
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )

                val portalMessage = error.portalMessage
                if (result !is TarjetonDigitalLoginResult.MissingFields && !portalMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        portalMessage,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                }

                Spacer(Modifier.height(12.dp))

                when (result) {
                    is TarjetonDigitalLoginResult.InvalidCredentials -> Text(
                        "Verifica tu usuario, contraseña y delegación e inténtalo nuevamente. Si recientemente cambiaste tu contraseña, actualiza también los datos guardados en la app.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.MissingFields -> Text(
                        "El formulario no estaba listo al intentar iniciar sesión automáticamente.",
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                    is TarjetonDigitalLoginResult.AccountLocked -> Text(
                        "Verifica el estado de tu cuenta en el portal oficial.",
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
            }
        },
        confirmButton = {
            when (result) {
                is TarjetonDigitalLoginResult.InvalidCredentials,
                is TarjetonDigitalLoginResult.PortalError,
                is TarjetonDigitalLoginResult.UnknownError -> LvdPrimaryButton(
                    text = "Revisar datos",
                    onClick = onReviewData,
                    fullWidth = false,
                )
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
            TextButton(onClick = onManualEntry) {
                Text("Entrar manualmente", color = LvdColors.TextSecondary)
            }
        },
    )
}
