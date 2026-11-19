package com.laveintedigital.app.imss.ui

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.imss.register.PasswordCriteria
import com.laveintedigital.app.imss.register.TuPerfilRegisterController
import com.laveintedigital.app.imss.register.TuPerfilRegisterFlowState
import com.laveintedigital.app.imss.register.TuPerfilRegisterInput
import com.laveintedigital.app.imss.register.TuPerfilRegisterValidator
import com.laveintedigital.app.imss.tarjeton.TarjetonDigitalDelegaciones
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSelectField
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField

/**
 * Diálogo interactivo nativo para el registro asistido en Tu Perfil IMSS.
 *
 * Facilita el proceso de alta para que los compañeros no tengan que lidiar
 * con la complejidad del portal web, prerrellenando los datos conocidos
 * y guiándolos paso a paso.
 */
@Composable
fun TuPerfilRegisterDialog(
    controller: TuPerfilRegisterController,
    onDismiss: () -> Unit,
    onSuccess: (matricula: String) -> Unit,
    onSwitchToLogin: () -> Unit,
) {
    val state by controller.state.collectAsState()

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
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(Color.White)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = {},
                )
                .padding(horizontal = 20.dp, vertical = 20.dp),
        ) {
            when (val s = state) {
                is TuPerfilRegisterFlowState.Editing -> {
                    EditingContent(
                        input = s.input,
                        error = s.validationError,
                        fromTarjeton = s.fromTarjetonPrefill,
                        onUpdateInput = { controller.updateInput(it) },
                        onSubmit = { controller.startRegistration() },
                        onDismiss = onDismiss,
                        onSwitchToLogin = onSwitchToLogin,
                    )
                }

                is TuPerfilRegisterFlowState.Submitting -> {
                    SubmittingContent(message = s.stepMessage)
                }

                is TuPerfilRegisterFlowState.AccountAlreadyExists -> {
                    AccountExistsContent(
                        matricula = s.matricula,
                        message = s.message,
                        onLogin = onSwitchToLogin,
                        onDismiss = onDismiss,
                    )
                }

                is TuPerfilRegisterFlowState.AwaitingVerificationCode -> {
                    VerificationCodeContent(
                        email = s.personalEmail,
                        error = s.codeError,
                        isResending = s.isResending,
                        onSubmitCode = { controller.submitVerificationCode(it) },
                        onResend = { controller.resendVerificationCode() },
                        onBack = { controller.backToEditing() },
                    )
                }

                is TuPerfilRegisterFlowState.VerifyingCode -> {
                    SubmittingContent(message = "Verificando tu código con el portal oficial…")
                }

                is TuPerfilRegisterFlowState.Success -> {
                    SuccessContent(
                        matricula = s.matricula,
                        onContinue = { onSuccess(s.matricula) },
                    )
                }

                is TuPerfilRegisterFlowState.Error -> {
                    ErrorContent(
                        message = s.message,
                        canRetry = s.canRetry,
                        onRetry = { controller.backToEditing() },
                        onDismiss = onDismiss,
                    )
                }
            }
        }
    }
}

@Composable
private fun EditingContent(
    input: TuPerfilRegisterInput,
    error: String?,
    fromTarjeton: Boolean,
    onUpdateInput: (TuPerfilRegisterInput) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
    onSwitchToLogin: () -> Unit,
) {
    val scrollState = rememberScrollState()
    var showPass by remember { mutableStateOf(false) }
    var showPassR by remember { mutableStateOf(false) }
    val passCriteria = remember(input.password) {
        TuPerfilRegisterValidator.checkPasswordCriteria(input.password)
    }

    val delegaciones = remember { TarjetonDigitalDelegaciones.FALLBACK }
    val selectedDelegacion = remember(input.ooadCode) {
        delegaciones.find { it.value == input.ooadCode }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scrollState),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Crear cuenta en Tu Perfil IMSS",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = LvdColors.Navy,
                )
                Text(
                    "Portal oficial: tuperfil.imss.gob.mx",
                    fontSize = 12.sp,
                    color = LvdColors.TextSecondary,
                )
            }
            IconButton(onClick = onDismiss) {
                Icon(Icons.Filled.Close, contentDescription = "Cerrar", tint = LvdColors.TextMuted)
            }
        }

        Spacer(Modifier.height(10.dp))

        if (fromTarjeton) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(LvdColors.Blue.copy(alpha = 0.08f))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = LvdColors.Blue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Datos laborales sugeridos de tu cuenta o tarjetón.",
                    fontSize = 12.sp,
                    color = LvdColors.Navy,
                    fontWeight = FontWeight.Medium,
                )
            }
            Spacer(Modifier.height(12.dp))
        }

        // 1. OOAD
        LvdSelectField(
            label = "OOAD / Delegación*",
            value = selectedDelegacion,
            valueLabel = selectedDelegacion?.let { "${it.value} - ${it.displayName}" } ?: "",
            placeholder = "Selecciona tu OOAD",
            options = delegaciones,
            optionLabel = { "${it.value} - ${it.displayName}" },
            onSelected = { onUpdateInput(input.copy(ooadCode = it.value)) },
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 2. Matrícula
        LvdTextField(
            value = input.matricula,
            onValueChange = { onUpdateInput(input.copy(matricula = it.filter { ch -> ch.isDigit() })) },
            label = "Matrícula*",
            placeholder = "Ej. 99123456",
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 3. CURP
        LvdTextField(
            value = input.curp,
            onValueChange = { onUpdateInput(input.copy(curp = it.uppercase().take(18))) },
            label = "CURP*",
            placeholder = "18 caracteres",
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 4. RFC
        LvdTextField(
            value = input.rfc,
            onValueChange = { onUpdateInput(input.copy(rfc = it.uppercase().take(13))) },
            label = "RFC con homoclave*",
            placeholder = "13 caracteres (ej. ABCD900101XYZ)",
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 5. NSS
        LvdTextField(
            value = input.nss,
            onValueChange = { onUpdateInput(input.copy(nss = it.filter { ch -> ch.isDigit() }.take(11))) },
            label = "Número de Seguro Social (NSS)*",
            placeholder = "11 dígitos",
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 6. Fecha de Ingreso
        LvdTextField(
            value = input.fechaIngreso,
            onValueChange = { onUpdateInput(input.copy(fechaIngreso = it.take(10))) },
            label = "Fecha de ingreso al IMSS (AAAA-MM-DD)*",
            placeholder = "Ej. 2015-08-16 (como en tu tarjetón)",
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 7. Teléfono de contacto
        LvdTextField(
            value = input.telefono,
            onValueChange = { onUpdateInput(input.copy(telefono = it.filter { ch -> ch.isDigit() }.take(10))) },
            label = "Teléfono celular (10 dígitos)*",
            placeholder = "Ej. 7771234567",
            keyboardType = KeyboardType.Phone,
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 8. Correo personal
        LvdTextField(
            value = input.correoPersonal,
            onValueChange = { onUpdateInput(input.copy(correoPersonal = it.trim())) },
            label = "Correo electrónico personal*",
            placeholder = "tucorreo@ejemplo.com (para tu código)",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 9. Contraseña nueva
        LvdTextField(
            value = input.password,
            onValueChange = { onUpdateInput(input.copy(password = it.replace(" ", ""))) },
            label = "Contraseña nueva para Tu Perfil IMSS*",
            placeholder = "8 a 15 caracteres",
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Next,
            visualTransformation = if (showPass) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showPass = !showPass }) {
                    Icon(
                        if (showPass) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = null,
                        tint = LvdColors.TextSecondary,
                    )
                }
            },
        )

        // Criterios visuales de contraseña
        PasswordCriteriaBar(criteria = passCriteria)

        Spacer(Modifier.height(LvdSpacing.Sm))

        // 10. Confirmación de contraseña
        LvdTextField(
            value = input.confirmPassword,
            onValueChange = { onUpdateInput(input.copy(confirmPassword = it.replace(" ", ""))) },
            label = "Confirma tu contraseña*",
            placeholder = "Repite tu contraseña",
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done,
            visualTransformation = if (showPassR) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showPassR = !showPassR }) {
                    Icon(
                        if (showPassR) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = null,
                        tint = LvdColors.TextSecondary,
                    )
                }
            },
        )

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(LvdColors.Error.copy(alpha = 0.1f))
                    .padding(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = LvdColors.ErrorStrong, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(error, fontSize = 12.5.sp, color = LvdColors.ErrorStrong)
            }
        }

        Spacer(Modifier.height(16.dp))

        LvdPrimaryButton(
            text = "Registrarme en Tu Perfil IMSS",
            onClick = onSubmit,
        )

        Spacer(Modifier.height(8.dp))

        LvdGhostButton(
            text = "¿Ya tienes cuenta? Inicia sesión aquí",
            onClick = onSwitchToLogin,
        )
    }
}

@Composable
private fun PasswordCriteriaBar(criteria: PasswordCriteria) {
    Column(modifier = Modifier.padding(top = 4.dp, start = 4.dp, end = 4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CriteriaBadge("8-15 letras", criteria.lengthOk)
            CriteriaBadge("Mayúscula", criteria.hasUpper)
            CriteriaBadge("Minúscula", criteria.hasLower)
        }
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CriteriaBadge("Número", criteria.hasNumber)
            CriteriaBadge("Símbolo (@-+$!%*?&#)", criteria.hasSpecial)
        }
    }
}

@Composable
private fun CriteriaBadge(label: String, met: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(if (met) LvdColors.Success else LvdColors.BorderStrong),
            contentAlignment = Alignment.Center,
        ) {
            if (met) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(8.dp))
            }
        }
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            fontSize = 11.sp,
            color = if (met) LvdColors.SuccessStrong else LvdColors.TextMuted,
            fontWeight = if (met) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
private fun SubmittingContent(message: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = LvdColors.Blue, strokeWidth = 3.dp, modifier = Modifier.size(44.dp))
        Spacer(Modifier.height(20.dp))
        Text(
            message,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = LvdColors.Navy,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Por favor no cierres la aplicación mientras nos comunicamos con el IMSS.",
            fontSize = 12.sp,
            color = LvdColors.TextMuted,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun VerificationCodeContent(
    email: String,
    error: String?,
    isResending: Boolean,
    onSubmitCode: (String) -> Unit,
    onResend: () -> Unit,
    onBack: () -> Unit,
) {
    var code by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = LvdColors.Blue,
            modifier = Modifier.size(48.dp),
        )

        Spacer(Modifier.height(12.dp))

        Text(
            "Confirma tu cuenta",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.Navy,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            "El IMSS envió un código de 5 dígitos a tu correo:",
            fontSize = 13.5.sp,
            color = LvdColors.TextSecondary,
            textAlign = TextAlign.Center,
        )

        Text(
            email,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.Navy,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(16.dp))

        // Campo centrado para el código de 5 dígitos
        LvdTextField(
            value = code,
            onValueChange = { code = it.filter { ch -> ch.isDigit() }.take(5) },
            label = "Código de verificación (5 dígitos)",
            placeholder = "00000",
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Done,
            modifier = Modifier.fillMaxWidth(0.7f),
        )

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                error,
                fontSize = 12.5.sp,
                color = LvdColors.ErrorStrong,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(Modifier.height(20.dp))

        LvdPrimaryButton(
            text = "Validar y activar cuenta",
            onClick = { onSubmitCode(code) },
            enabled = code.length == 5,
        )

        Spacer(Modifier.height(10.dp))

        LvdGhostButton(
            text = if (isResending) "Reenviando código…" else "¿No te llegó? Reenviar código",
            onClick = onResend,
            enabled = !isResending,
        )

        Spacer(Modifier.height(4.dp))

        LvdGhostButton(
            text = "← Corregir mis datos",
            onClick = onBack,
        )
    }
}

@Composable
private fun AccountExistsContent(
    matricula: String,
    message: String,
    onLogin: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.Info,
            contentDescription = null,
            tint = LvdColors.Blue,
            modifier = Modifier.size(48.dp),
        )

        Spacer(Modifier.height(12.dp))

        Text(
            "Cuenta ya registrada",
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.Navy,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            message,
            fontSize = 14.sp,
            color = LvdColors.TextSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            "La matrícula $matricula ya tiene un usuario en Tu Perfil IMSS. Puedes ingresar directamente con tu contraseña.",
            fontSize = 12.5.sp,
            color = LvdColors.TextMuted,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(20.dp))

        LvdPrimaryButton(
            text = "Iniciar sesión en Tu Perfil",
            onClick = onLogin,
        )

        Spacer(Modifier.height(8.dp))

        LvdGhostButton(
            text = "Volver",
            onClick = onDismiss,
        )
    }
}

@Composable
private fun SuccessContent(
    matricula: String,
    onContinue: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = LvdColors.Success,
            modifier = Modifier.size(54.dp),
        )

        Spacer(Modifier.height(14.dp))

        Text(
            "¡Cuenta creada con éxito!",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.Navy,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            "Tu cuenta de Tu Perfil IMSS para la matrícula $matricula ha sido activada.",
            fontSize = 14.sp,
            color = LvdColors.TextSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            "Guardamos tu acceso de forma segura en la bóveda de tu teléfono. Ya no tendrás que volver a escribir tu contraseña para consultar tus tarjetones y checadas.",
            fontSize = 12.sp,
            color = LvdColors.TextMuted,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(24.dp))

        LvdPrimaryButton(
            text = "Continuar",
            onClick = onContinue,
        )
    }
}

@Composable
private fun ErrorContent(
    message: String,
    canRetry: Boolean,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.Warning,
            contentDescription = null,
            tint = LvdColors.Error,
            modifier = Modifier.size(48.dp),
        )

        Spacer(Modifier.height(12.dp))

        Text(
            "No pudimos completar el registro",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = LvdColors.Navy,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            message,
            fontSize = 13.5.sp,
            color = LvdColors.TextSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(20.dp))

        if (canRetry) {
            LvdPrimaryButton(
                text = "Revisar datos e intentar de nuevo",
                onClick = onRetry,
            )
            Spacer(Modifier.height(8.dp))
        }

        LvdGhostButton(
            text = "Cerrar",
            onClick = onDismiss,
        )
    }
}

@Composable
private fun LvdGhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    androidx.compose.material3.TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(
            text = text,
            color = if (enabled) LvdColors.Navy else LvdColors.TextMuted,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}
