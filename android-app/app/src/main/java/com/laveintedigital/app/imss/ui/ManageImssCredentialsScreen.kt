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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    var credentialsMap by remember { mutableStateOf<Map<ImssPortal, Boolean>>(emptyMap()) }
    var usernamesMap by remember { mutableStateOf<Map<ImssPortal, String>>(emptyMap()) }
    var showDeleteDialog by remember { mutableStateOf<ImssPortal?>(null) }
    var showUpdateDialog by remember { mutableStateOf<ImssPortal?>(null) }
    var updateUsername by remember { mutableStateOf("") }
    var updatePassword by remember { mutableStateOf("") }
    var updateSaving by remember { mutableStateOf(false) }
    var updateError by remember { mutableStateOf<String?>(null) }

    fun refreshCredentials() {
        scope.launch {
            val cMap = mutableMapOf<ImssPortal, Boolean>()
            val uMap = mutableMapOf<ImssPortal, String>()
            for (p in portals) {
                val has = ImssVaultManager.hasCredentials(context, p)
                cMap[p] = has
                if (has) {
                    val payload = runCatching { ImssVaultManager.decryptCredentials(context, p) }.getOrNull()
                    if (payload != null && payload.username.isNotBlank()) {
                        uMap[p] = payload.username
                    }
                }
            }
            credentialsMap = cMap
            usernamesMap = uMap
        }
    }

    LaunchedEffect(Unit) {
        refreshCredentials()
    }

    Scaffold(
        topBar = {
            LvdTopBar(
                title = if (portal != null) "Acceso a ${portal.displayName}" else "Bóveda de accesos IMSS",
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

            portals.forEach { p ->
                val isSaved = credentialsMap[p] == true
                val savedUsername = usernamesMap[p]

                LvdCard(contentPadding = PaddingValues(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.Shield,
                            contentDescription = null,
                            tint = if (isSaved) Color(0xFF16A34A) else LvdColors.Blue,
                            modifier = Modifier.size(22.dp),
                        )
                        Spacer(Modifier.padding(6.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    p.displayName,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = LvdColors.TextPrimary,
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = if (isSaved) "✓ Guardado y protegido" else "○ Sin guardar",
                                    fontSize = 11.sp,
                                    fontWeight = if (isSaved) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSaved) Color(0xFF15803D) else LvdColors.TextSecondary,
                                )
                            }
                            if (isSaved && !savedUsername.isNullOrBlank()) {
                                Text(
                                    "Matrícula: $savedUsername",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = LvdColors.TextPrimary,
                                    modifier = Modifier.padding(vertical = 1.dp),
                                )
                            }
                            Text(
                                when (p) {
                                    ImssPortal.TU_PERFIL -> "Cuenta de tuperfil.imss.gob.mx (Tarjetones y Registros biométricos)."
                                    ImssPortal.TARJETON_DIGITAL -> "Cuenta de rh.imss.gob.mx (Tarjetón Digital clásico con delegación)."
                                },
                                fontSize = 11.5.sp,
                                color = LvdColors.TextSecondary,
                            )
                        }
                        if (isSaved) {
                            IconButton(onClick = {
                                showUpdateDialog = p
                                updateUsername = savedUsername ?: ""
                                updatePassword = ""
                                updateError = null
                            }) {
                                Icon(Icons.Filled.Edit, "Actualizar", tint = LvdColors.Blue)
                            }
                            IconButton(onClick = { showDeleteDialog = p }) {
                                Icon(Icons.Filled.Delete, "Olvidar", tint = LvdColors.ErrorStrong)
                            }
                        } else {
                            IconButton(onClick = {
                                showUpdateDialog = p
                                updateUsername = ""
                                updatePassword = ""
                                updateError = null
                            }) {
                                Icon(Icons.Filled.Add, "Configurar acceso", tint = LvdColors.Blue)
                            }
                        }
                    }
                }
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
                        scope.launch {
                            ImssVaultManager.deleteCredentials(context, p)
                            refreshCredentials()
                        }
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
                    Text(
                        when (p) {
                            ImssPortal.TU_PERFIL -> "Ingresa tu matrícula y la contraseña exclusiva de Tu Perfil IMSS (tuperfil.imss.gob.mx)."
                            ImssPortal.TARJETON_DIGITAL -> "Ingresa tu usuario/matrícula y la contraseña exclusiva de Tarjetón Digital clásico (rh.imss.gob.mx)."
                        },
                        fontSize = 12.sp,
                        color = LvdColors.TextSecondary,
                    )
                    Spacer(Modifier.height(LvdSpacing.Sm))
                    LvdTextField(
                        value = updateUsername,
                        onValueChange = { updateUsername = it; updateError = null },
                        label = when (p) {
                            ImssPortal.TU_PERFIL -> "Matrícula (Tu Perfil IMSS)"
                            ImssPortal.TARJETON_DIGITAL -> "Usuario / matrícula (Tarjetón Digital)"
                        },
                    )
                    Spacer(Modifier.height(LvdSpacing.Md))
                    LvdTextField(
                        value = updatePassword,
                        onValueChange = { updatePassword = it; updateError = null },
                        label = "Contraseña de ${p.displayName}",
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
                            if (ok) {
                                showUpdateDialog = null
                                refreshCredentials()
                            } else {
                                updateError = "Error al guardar"
                            }
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
