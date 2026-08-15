package com.laveintedigital.app.ui.lvd

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Botón primario LVD: fondo azul [#2462EA], texto blanco, altura 52dp, radio 14dp.
 */
@Composable
fun LvdPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingText: String = text,
    height: Dp = LvdDimens.ButtonHeight,
    fullWidth: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(height),
        enabled = enabled && !loading,
        shape = LvdShapes.Button,
        colors = ButtonDefaults.buttonColors(
            containerColor = LvdColors.Blue,
            contentColor = LvdColors.OnPrimary,
            disabledContainerColor = LvdColors.Blue.copy(alpha = 0.35f),
            disabledContentColor = LvdColors.OnPrimary.copy(alpha = 0.7f),
        ),
        elevation = null,
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = LvdColors.OnPrimary,
                strokeWidth = 2.dp,
            )
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = if (loading) loadingText else text,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = LvdColors.OnPrimary,
        )
    }
}

/**
 * Botón secundario LVD: contorno fino + texto azul. Para acciones alternas.
 */
@Composable
fun LvdSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = LvdDimens.ButtonHeightSmall,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(height),
        enabled = enabled,
        shape = LvdShapes.Button,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = LvdColors.Blue,
            disabledContentColor = LvdColors.TextMuted,
        ),
        border = BorderStroke(1.dp, LvdColors.Border),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        Text(text, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = LvdColors.Blue)
    }
}

/**
 * Campo de texto LVD: superficie suave, borde fino; al enfocar borde+icono azul.
 * NO usar bordes navy gruesos (aspecto gubernamental).
 */
@Composable
fun LvdTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    enabled: Boolean = true,
    isError: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        isError = isError,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        shape = LvdShapes.Field,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        visualTransformation = visualTransformation,
        trailingIcon = trailingIcon,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = LvdColors.Surface,
            unfocusedContainerColor = LvdColors.SurfaceSoft,
            disabledContainerColor = LvdColors.SurfaceSoft,
            focusedBorderColor = LvdColors.Blue,
            unfocusedBorderColor = LvdColors.Border,
            errorBorderColor = LvdColors.Error,
            focusedLabelColor = LvdColors.Blue,
            unfocusedLabelColor = LvdColors.TextSecondary,
            focusedPlaceholderColor = LvdColors.TextMuted,
            unfocusedPlaceholderColor = LvdColors.TextMuted,
            cursorColor = LvdColors.Blue,
            focusedTextColor = LvdColors.TextPrimary,
            unfocusedTextColor = LvdColors.TextPrimary,
            focusedTrailingIconColor = LvdColors.Blue,
            unfocusedTrailingIconColor = LvdColors.TextMuted,
        ),
    )
}

/**
 * Alias semántico de [LvdTextField] para formularios.
 */
@Composable
fun LvdFormField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    enabled: Boolean = true,
    isError: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    LvdTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        placeholder = placeholder,
        enabled = enabled,
        isError = isError,
        keyboardType = keyboardType,
        imeAction = imeAction,
        visualTransformation = visualTransformation,
        trailingIcon = trailingIcon,
    )
}

/**
 * Selector (dropdown) LVD: campo con borde fino, flecha azul, menú desplegable.
 * Reemplaza los OutlinedButton/DropdownMenu sueltos.
 */
@Composable
fun <T> LvdSelectField(
    label: String,
    value: T?,
    valueLabel: String,
    placeholder: String,
    options: List<T>,
    optionLabel: (T) -> String,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    hint: String? = null,
) {
    var expanded by remember { mutableStateOf(false) }
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = if (enabled) LvdColors.TextSecondary else LvdColors.TextMuted,
        )
        Spacer(Modifier.height(4.dp))
        OutlinedButton(
            onClick = { if (enabled) expanded = true },
            modifier = Modifier
                .fillMaxWidth()
                .height(LvdDimens.FieldHeight),
            enabled = enabled,
            shape = LvdShapes.Field,
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = LvdColors.TextPrimary,
                disabledContentColor = LvdColors.TextMuted,
                disabledContainerColor = LvdColors.SurfaceSoft,
            ),
            border = BorderStroke(1.dp, if (enabled) LvdColors.Border else LvdColors.Border.copy(alpha = 0.6f)),
            contentPadding = PaddingValues(horizontal = 16.dp),
        ) {
            Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(
                    text = valueLabel.ifBlank { placeholder },
                    fontSize = 15.sp,
                    fontWeight = if (valueLabel.isBlank()) FontWeight.Normal else FontWeight.Medium,
                    color = if (valueLabel.isBlank()) LvdColors.TextMuted else LvdColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                imageVector = Icons.Filled.ArrowDropDown,
                contentDescription = "Abrir $label",
                tint = if (enabled) LvdColors.Blue else LvdColors.TextMuted,
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.widthIn(min = 200.dp),
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            optionLabel(option),
                            fontSize = 14.sp,
                            color = LvdColors.TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    onClick = {
                        expanded = false
                        onSelected(option)
                    },
                )
            }
        }
        if (hint != null) {
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(6.dp)
                        .clip(LvdShapes.Pill)
                        .background(LvdColors.Info),
                )
                Spacer(Modifier.width(6.dp))
                Text(hint, fontSize = 12.sp, color = LvdColors.Info, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
