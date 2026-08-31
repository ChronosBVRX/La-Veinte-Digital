package com.laveintedigital.app.imss.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.lvd.LvdBottomSheet
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdMotion
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField

/**
 * Diálogo de login de Tu Perfil IMSS (LVD). Reemplaza el AlertDialog genérico
 * por un bottom sheet 28dp con los tokens del sistema.
 *
 * La lógica funcional NO cambia: sube (username, password, remember) vía [onLogin].
 * Tarjetones y Registros biométricos usan ESTE mismo diálogo (mismo acceso).
 */
@Composable
fun TuPerfilLoginDialog(
    savedUsername: String? = null,
    title: String = "Inicia sesión",
    subtitle: String? = "Tu Perfil IMSS",
    description: String = "Datos obtenidos directamente del portal oficial del IMSS.",
    onLogin: (username: String, password: String, remember: Boolean) -> Unit,
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
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LvdColors.TextPrimary,
                    )
                    if (subtitle != null) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            subtitle,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = LvdColors.Blue,
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(
                        description,
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )

                    Spacer(Modifier.height(LvdSpacing.Xxl))

                    LvdTextField(
                        value = username,
                        onValueChange = { username = it; error = null },
                        label = "Usuario / matrícula",
                        imeAction = ImeAction.Next,
                    )

                    Spacer(Modifier.height(LvdSpacing.Lg))

                    LvdTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = "Contraseña",
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
                            "Recordar mis datos",
                            fontSize = 14.sp,
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
                        "Tus datos se utilizan únicamente para iniciar sesión en el portal oficial de Tu Perfil IMSS.",
                        fontSize = 11.sp,
                        color = LvdColors.TextMuted,
                    )

                    Spacer(Modifier.height(LvdSpacing.Xxl))

                    LvdPrimaryButton(
                        text = "Iniciar sesión",
                        onClick = {
                            val u = username.trim()
                            val p = password.trim()
                            if (u.isBlank() || p.isBlank()) {
                                error = "Completa todos los campos"
                                return@LvdPrimaryButton
                            }
                            onLogin(u, p, rememberMe)
                        },
                    )

                    Spacer(Modifier.height(4.dp))
                }
            }
        }
    }
}
