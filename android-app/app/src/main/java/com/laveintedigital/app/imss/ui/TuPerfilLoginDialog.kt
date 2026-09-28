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
import com.laveintedigital.app.ui.lvd.LvdBottomSheet
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdMotion
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField

/**
 * Diálogo de login de Tu Perfil IMSS (LVD).
 *
 * Incluye guía explícita de qué cuenta debe ingresar el trabajador (Tu Perfil IMSS vs
 * Tarjetón Digital clásico vs La Veinte Digital) y advertencia preventiva contra bloqueo
 * de cuenta por intentos fallidos.
 */
@Composable
fun TuPerfilLoginDialog(
    savedUsername: String? = null,
    title: String = "Inicia sesión en Tu Perfil IMSS",
    subtitle: String? = "Portal oficial: tuperfil.imss.gob.mx",
    description: String = "Aquí se publican primero tus tarjetones de pago y tus registros biométricos (checadas).",
    failedAttempts: Int = 0,
    onLogin: (username: String, password: String, remember: Boolean) -> Unit,
    onSwitchToTarjetonDigital: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
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
                        title,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    if (subtitle != null) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            subtitle,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = LvdColors.Blue,
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(
                        description,
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
                            "• Sí: Tu Matrícula y la contraseña de Tu Perfil IMSS (la misma que usas para ver tus checadas).\n" +
                                "• No pongas: La contraseña del portal antiguo de Tarjetón Digital (el que pide Delegación) ni la de La Veinte Digital.",
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
                                    "Llevas $failedAttempts intentos fallidos. ¡Cuidado! Si vuelves a fallar, el IMSS puede bloquear tu cuenta de Tu Perfil. Verifica tu clave o cambia a Tarjetón Digital."
                                } else {
                                    "Llevas 1 intento fallido. Confirma que sea tu contraseña de Tu Perfil IMSS antes de volver a intentar para no bloquear tu cuenta."
                                },
                                fontSize = 11.5.sp,
                                lineHeight = 15.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = LvdColors.TextPrimary,
                            )
                        }
                    }

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdTextField(
                        value = username,
                        onValueChange = { username = it; error = null },
                        label = "Matrícula (Tu Perfil IMSS)",
                        imeAction = ImeAction.Next,
                    )

                    Spacer(Modifier.height(LvdSpacing.Md))

                    LvdTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = "Contraseña de Tu Perfil IMSS",
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
                            "Recordar mi acceso de Tu Perfil IMSS",
                            fontSize = 13.5.sp,
                            color = LvdColors.TextPrimary,
                        )
                    }

                    if (error != null) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            error!!,
                            fontSize = 12.sp,
                            color = LvdColors.ErrorStrong,
                        )
                    }

                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Importante: El portal del IMSS bloquea tu cuenta tras varios intentos fallidos. Tus datos solo se guardan si el inicio de sesión es exitoso.",
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = LvdColors.TextMuted,
                    )

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdPrimaryButton(
                        text = "Iniciar sesión en Tu Perfil",
                        onClick = {
                            val u = username.trim()
                            val p = password.trim()
                            if (u.isBlank() || p.isBlank()) {
                                error = "Completa tu matrícula y contraseña de Tu Perfil IMSS"
                                return@LvdPrimaryButton
                            }
                            onLogin(u, p, rememberMe)
                        },
                    )

                    if (onSwitchToTarjetonDigital != null) {
                        Spacer(Modifier.height(4.dp))
                        TextButton(
                            onClick = onSwitchToTarjetonDigital,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "¿Tu cuenta es de Tarjetón Digital (por Delegación)? Cambiar aquí",
                                color = LvdColors.Blue,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }

                    Spacer(Modifier.height(4.dp))
                }
            }
        }
    }
}
