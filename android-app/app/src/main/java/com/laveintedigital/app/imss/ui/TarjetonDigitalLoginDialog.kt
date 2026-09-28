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
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.portal.ImssLoginProtectionPolicy
import com.laveintedigital.app.imss.tarjeton.TarjetonDigitalDelegaciones
import com.laveintedigital.app.ui.lvd.LvdBottomSheet
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdMotion
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSelectField
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField

/**
 * Formulario nativo de acceso a Tarjetón Digital IMSS (LVD).
 *
 * Delegación + Usuario + Contraseña, con guía explícita de qué cuenta corresponde
 * (Tarjetón Digital clásico vs Tu Perfil IMSS) y advertencia anti-bloqueo.
 */
@Composable
fun TarjetonDigitalLoginDialog(
    delegaciones: List<TarjetonDigitalDelegaciones.Delegacion>,
    savedDelegacion: TarjetonDigitalDelegaciones.Delegacion? = null,
    savedUsername: String? = null,
    failedAttempts: Int = 0,
    onLogin: (delegacion: TarjetonDigitalDelegaciones.Delegacion, username: String, password: String, remember: Boolean) -> Unit,
    onManualEntry: () -> Unit,
    onSwitchToTuPerfil: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
    var delegacion by remember { mutableStateOf(savedDelegacion) }
    var username by remember { mutableStateOf(savedUsername ?: "") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(true) }
    var showPassword by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

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
        AnimatedVisibility(
            visible = true,
            enter = fadeIn(LvdMotion.StateTransition) +
                slideInVertically(initialOffsetY = { it / 4 }, animationSpec = tween(220)),
            exit = fadeOut(LvdMotion.StateTransition) +
                slideOutVertically(targetOffsetY = { it / 4 }, animationSpec = tween(220)),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            LvdBottomSheet(
                onClose = onDismiss,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 4.dp),
                ) {
                    Text(
                        "Inicia sesión en Tarjetón Digital",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Portal clásico: rh.imss.gob.mx/Personal/TarjetonDigital",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.Blue,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Consulta tus tarjetones por Delegación. Suelen publicarse aquí después que en Tu Perfil IMSS.",
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )

                    Spacer(Modifier.height(LvdSpacing.Md))

                    // Recuadro explicativo de qué cuenta corresponde
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(LvdColors.SurfaceSoft)
                            .border(1.dp, LvdColors.Border, RoundedCornerShape(12.dp))
                            .padding(11.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.Key,
                                contentDescription = null,
                                tint = LvdColors.Blue,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "¿Qué cuenta debes poner aquí?",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = LvdColors.TextPrimary,
                            )
                        }
                        Text(
                            "• Sí: Tu Delegación (OOAD), Usuario/Matrícula y tu contraseña exclusiva de Tarjetón Digital.\n" +
                                "• No pongas: La contraseña de Tu Perfil IMSS (suele ser diferente) ni la de La Veinte Digital.",
                            fontSize = 11.5.sp,
                            lineHeight = 16.sp,
                            color = LvdColors.TextPrimary,
                        )
                    }

                    if (failedAttempts > 0) {
                        val guardActive = ImssLoginProtectionPolicy.isLockoutGuardActive(failedAttempts)
                        Spacer(Modifier.height(LvdSpacing.Sm))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (guardActive) LvdColors.Error.copy(alpha = 0.22f)
                                    else LvdColors.Warning.copy(alpha = 0.18f),
                                )
                                .border(
                                    1.dp,
                                    if (guardActive) LvdColors.ErrorStrong else Color(0xFFD97706),
                                    RoundedCornerShape(12.dp),
                                )
                                .padding(10.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Icon(
                                Icons.Filled.Warning,
                                contentDescription = null,
                                tint = if (guardActive) LvdColors.ErrorStrong else Color(0xFFB45309),
                                modifier = Modifier.size(16.dp).padding(top = 1.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = if (guardActive) {
                                    "Llevas $failedAttempts intentos fallidos. ¡Cuidado! No sigas intentando la misma contraseña o el IMSS puede bloquear tu cuenta."
                                } else {
                                    "Llevas 1 intento fallido. Verifica que sea tu contraseña de Tarjetón Digital (no la de Tu Perfil IMSS) antes de reintentar."
                                },
                                fontSize = 11.5.sp,
                                lineHeight = 15.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = LvdColors.TextPrimary,
                            )
                        }
                    }

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdSelectField(
                        label = "Delegación",
                        value = delegacion,
                        valueLabel = delegacion?.displayName ?: "",
                        placeholder = "Selecciona tu delegación",
                        options = delegaciones,
                        optionLabel = { it.displayName },
                        onSelected = { delegacion = it; error = null },
                    )

                    Spacer(Modifier.height(LvdSpacing.Md))

                    LvdTextField(
                        value = username,
                        onValueChange = { username = it; error = null },
                        label = "Usuario / Matrícula (Tarjetón Digital)",
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Next,
                    )

                    Spacer(Modifier.height(LvdSpacing.Md))

                    LvdTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = "Contraseña de Tarjetón Digital",
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                    contentDescription = if (showPassword) "Ocultar contraseña" else "Mostrar contraseña",
                                    tint = LvdColors.TextSecondary,
                                )
                            }
                        },
                    )

                    Spacer(Modifier.height(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = rememberMe,
                            onCheckedChange = { rememberMe = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = LvdColors.Blue,
                                uncheckedColor = LvdColors.BorderStrong,
                            ),
                        )
                        Text(
                            "Guardar mi acceso de Tarjetón Digital",
                            fontSize = 13.5.sp,
                            color = LvdColors.TextPrimary,
                        )
                    }

                    if (error != null) {
                        Spacer(Modifier.height(4.dp))
                        Text(error!!, fontSize = 12.sp, color = LvdColors.ErrorStrong)
                    }

                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Importante: Tus datos solo se guardan cifrados en este dispositivo si el inicio de sesión es exitoso.",
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = LvdColors.TextMuted,
                    )

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdPrimaryButton(
                        text = "Iniciar sesión en Tarjetón Digital",
                        onClick = {
                            val d = delegacion
                            val u = username.trim()
                            val p = password.trim()
                            when {
                                d == null -> error = "Selecciona tu delegación"
                                u.isBlank() || p.isBlank() -> error = "Completa tu usuario y contraseña de Tarjetón Digital"
                                else -> onLogin(d, u, p, rememberMe)
                            }
                        },
                    )

                    if (onSwitchToTuPerfil != null) {
                        Spacer(Modifier.height(4.dp))
                        TextButton(
                            onClick = onSwitchToTuPerfil,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "¿Prefieres entrar con tu cuenta de Tu Perfil IMSS? Cambiar aquí",
                                color = LvdColors.Blue,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }

                    TextButton(onClick = onManualEntry, modifier = Modifier.fillMaxWidth()) {
                        Text("Entrar manualmente en el portal", color = LvdColors.TextSecondary, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}
