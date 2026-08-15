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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.laveintedigital.app.imss.credentials.ImssCredentialPayload
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import com.laveintedigital.app.ui.lvd.LvdCard
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSpacing
import com.laveintedigital.app.ui.lvd.LvdTextField
import com.laveintedigital.app.ui.lvd.LvdTopBar
import kotlinx.coroutines.launch

/**
 * Gestión de accesos guardados (LVD): lista de portales, editar y olvidar.
 * La lógica funcional no cambia.
 */
@Composable
fun ManageImssCredentialsScreen(
    portal: ImssPortal? = null,
    onBack: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)
    val portals = if (portal != null) listOf(portal) else ImssPortal.entries.toList()
    var savedPortals by remember { mutableStateOf(portals) }
    var showDeleteDialog by remember { mutableStateOf<ImssPortal?>(null) }
    var showUpdateDialog by remember { mutableStateOf<ImssPortal?>(null) }
    var updateUsername by remember { mutableStateOf("") }
    var updatePassword by remember { mutableStateOf("") }
    var updateSaving by remember { mutableStateOf(false) }
    var updateError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            LvdTopBar(
                title = if (portal != null) "Acceso a ${portal.displayName}" else "Accesos guardados",
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
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(LvdSpacing.Sm))

            savedPortals.forEach { p ->
                LvdCard(contentPadding = PaddingValues(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.Shield,
                            contentDescription = null,
                            tint = LvdColors.Blue,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.padding(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                p.displayName,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = LvdColors.TextPrimary,
                            )
                            Text(
                                when (p) {
                                    ImssPortal.TU_PERFIL -> "Se usa para Tarjetones y Registros biométricos."
                                    else -> "Protegido con biometría"
                                },
                                fontSize = 12.sp,
                                color = LvdColors.TextSecondary,
                            )
                        }
                        IconButton(onClick = {
                            showUpdateDialog = p
                            updateUsername = ""
                            updatePassword = ""
                            updateError = null
                        }) {
                            Icon(Icons.Filled.Edit, "Actualizar", tint = LvdColors.Blue)
                        }
                        IconButton(onClick = { showDeleteDialog = p }) {
                            Icon(Icons.Filled.Delete, "Olvidar", tint = LvdColors.ErrorStrong)
                        }
                    }
                }
            }

            if (savedPortals.isEmpty()) {
                Text(
                    "No hay accesos guardados.",
                    color = LvdColors.TextSecondary,
                    modifier = Modifier.padding(top = LvdSpacing.Xxl),
                )
            }

            Spacer(Modifier.height(LvdSpacing.Sm))
        }
    }

    // ── Olvidar acceso ─────────────────────────────────────────────────────
    showDeleteDialog?.let { p ->
        LvdDialog(
            onDismissRequest = { showDeleteDialog = null },
            title = "¿Olvidar el acceso a ${p.displayName}?",
            text = {
                Column {
                    Text(
                        "La Veinte eliminará los datos guardados en este dispositivo. Tendrás que escribirlos nuevamente la próxima vez.",
                        fontSize = 14.sp,
                        color = LvdColors.TextSecondary,
                    )
                }
            },
            confirmButton = {
                LvdPrimaryButton(
                    text = "Olvidar",
                    onClick = {
                        scope.launch { ImssVaultManager.deleteCredentials(context, p) }
                        savedPortals = savedPortals.filter { it != p }
                        showDeleteDialog = null
                    },
                    fullWidth = false,
                )
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }) {
                    Text("Cancelar", color = LvdColors.TextSecondary)
                }
            },
        )
    }

    // ── Actualizar acceso ──────────────────────────────────────────────────
    showUpdateDialog?.let { p ->
        LvdDialog(
            onDismissRequest = { showUpdateDialog = null },
            title = "Actualizar acceso a ${p.displayName}",
            text = {
                Column {
                    LvdTextField(
                        value = updateUsername,
                        onValueChange = { updateUsername = it; updateError = null },
                        label = "Usuario / matrícula",
                    )
                    Spacer(Modifier.height(LvdSpacing.Md))
                    LvdTextField(
                        value = updatePassword,
                        onValueChange = { updatePassword = it; updateError = null },
                        label = "Contraseña",
                    )
                    if (updateError != null) {
                        Spacer(Modifier.height(LvdSpacing.Sm))
                        Text(updateError!!, color = LvdColors.ErrorStrong, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                LvdPrimaryButton(
                    text = "Guardar",
                    onClick = {
                        if (updateUsername.isBlank() || updatePassword.isBlank()) {
                            updateError = "Completa todos los campos"
                            return@LvdPrimaryButton
                        }
                        updateSaving = true
                        val payload = ImssCredentialPayload(updateUsername.trim(), updatePassword.trim())
                        scope.launch {
                            val ok = ImssVaultManager.saveCredentials(context, p, payload)
                            updateSaving = false
                            if (ok) showUpdateDialog = null else { updateError = "Error al guardar" }
                        }
                    },
                    enabled = !updateSaving,
                    loading = updateSaving,
                    loadingText = "Guardando…",
                    fullWidth = false,
                )
            },
            dismissButton = {
                TextButton(onClick = { showUpdateDialog = null }) {
                    Text("Cancelar", color = LvdColors.TextSecondary)
                }
            },
        )
    }
}
