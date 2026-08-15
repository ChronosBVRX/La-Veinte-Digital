package com.laveintedigital.app.imss.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.laveintedigital.app.imss.credentials.ImssCredentialPayload
import com.laveintedigital.app.imss.credentials.ImssCredentialUnlock
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import com.laveintedigital.app.ui.lvd.LvdCard
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSectionHeader
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField
import com.laveintedigital.app.ui.lvd.LvdTopBar
import kotlinx.coroutines.launch

/**
 * Pantalla para guardar credenciales de un portal IMSS (LVD).
 * La lógica funcional no cambia: guarda vía [ImssVaultManager] solo si hay
 * biometría fuerte disponible.
 */
@Composable
fun SaveImssCredentialsScreen(
    portal: ImssPortal,
    onSaved: (ImssCredentialPayload) -> Unit,
    onSkip: () -> Unit,
    onBack: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val activity = context as FragmentActivity
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var autoLogin by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val canBio = remember { ImssCredentialUnlock.canUseBiometric(context) }

    Scaffold(
        topBar = {
            LvdTopBar(
                title = "Guardar acceso",
                subtitle = portal.displayName,
                onBack = onBack,
            )
        },
        containerColor = LvdColors.Background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = LvdSpacing.Lg),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.height(LvdSpacing.Sm))

            LvdSectionHeader(
                title = "Acceso a ${portal.displayName}",
                subtitle = "Guarda tu usuario y contraseña cifrados en este dispositivo.",
            )

            if (!canBio) {
                LvdCard(
                    contentPadding = PaddingValues(16.dp),
                    containerColor = LvdColors.Warning.copy(alpha = 0.15f),
                ) {
                    Text(
                        "Este dispositivo no tiene biometría fuerte. Las credenciales no pueden guardarse de forma segura.",
                        fontSize = 13.sp,
                        color = LvdColors.TextPrimary,
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            LvdTextField(
                value = username,
                onValueChange = { username = it; error = null },
                label = "Usuario / matrícula",
                enabled = canBio,
            )

            LvdTextField(
                value = password,
                onValueChange = { password = it; error = null },
                label = "Contraseña",
                enabled = canBio,
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = autoLogin,
                    onCheckedChange = { autoLogin = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = LvdColors.Blue,
                        uncheckedColor = LvdColors.BorderStrong,
                    ),
                )
                Text(
                    "Iniciar automáticamente",
                    fontSize = 14.sp,
                    color = LvdColors.TextPrimary,
                )
            }

            if (error != null) {
                Text(error!!, color = LvdColors.ErrorStrong, fontSize = 13.sp)
            }

            Spacer(Modifier.height(4.dp))

            LvdPrimaryButton(
                text = "Guardar de forma segura",
                onClick = {
                    if (username.isBlank() || password.isBlank()) {
                        error = "Completa todos los campos"
                        return@LvdPrimaryButton
                    }
                    saving = true
                    val payload = ImssCredentialPayload(username.trim(), password.trim())
                    scope.launch {
                        val ok = ImssVaultManager.saveCredentials(context, portal, payload)
                        saving = false
                        if (ok) onSaved(payload) else { error = "Error al guardar. Intenta de nuevo." }
                    }
                },
                enabled = canBio && !saving,
                loading = saving,
                loadingText = "Guardando…",
            )

            TextButton(onClick = onSkip, modifier = Modifier.fillMaxWidth()) {
                Text("Continuar sin guardar", color = LvdColors.Blue, fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.height(LvdSpacing.Sm))
        }
    }
}
