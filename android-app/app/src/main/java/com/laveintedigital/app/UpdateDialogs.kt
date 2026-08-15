package com.laveintedigital.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.updates.UpdateManifest
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.lvd.LvdSpacing

@Composable
fun UpdateAvailableDialog(
    manifest: UpdateManifest,
    onDownload: () -> Unit,
    onDismiss: () -> Unit,
) {
    LvdDialog(
        onDismissRequest = onDismiss,
        icon = {
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(48.dp),
            )
        },
        title = "Actualización disponible",
        text = {
            Column {
                Text(
                    "Versión ${manifest.versionName}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = LvdColors.TextPrimary,
                )
                if (manifest.apk.size > 0) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        formatSize(manifest.apk.size),
                        fontSize = 13.sp,
                        color = LvdColors.TextSecondary,
                    )
                }
                if (manifest.releaseNotes.isNotEmpty()) {
                    Spacer(Modifier.height(LvdSpacing.Md))
                    manifest.releaseNotes.forEach { note ->
                        Text(
                            "• $note",
                            fontSize = 13.sp,
                            color = LvdColors.TextSecondary,
                        )
                        Spacer(Modifier.height(2.dp))
                    }
                }
            }
        },
        confirmButton = {
            LvdPrimaryButton(text = "Actualizar", onClick = onDownload, fullWidth = false)
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Más tarde", color = LvdColors.TextSecondary) }
        },
    )
}

@Composable
fun ForceUpdateDialog(
    manifest: UpdateManifest,
    onDownload: () -> Unit,
) {
    LvdDialog(
        onDismissRequest = {},
        icon = {
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(48.dp),
            )
        },
        title = "Actualización obligatoria",
        text = {
            Column {
                Text(
                    "Debes actualizar a la versión ${manifest.versionName} para continuar usando La Veinte Digital.",
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )
                if (manifest.releaseNotes.isNotEmpty()) {
                    Spacer(Modifier.height(LvdSpacing.Md))
                    manifest.releaseNotes.forEach { note ->
                        Text(
                            "• $note",
                            fontSize = 13.sp,
                            color = LvdColors.TextSecondary,
                        )
                        Spacer(Modifier.height(2.dp))
                    }
                }
            }
        },
        confirmButton = {
            LvdPrimaryButton(text = "Descargar ahora", onClick = onDownload, fullWidth = false)
        },
    )
}

@Composable
fun DownloadingDialog(progress: Int) {
    LvdDialog(
        onDismissRequest = {},
        title = "Descargando actualización",
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth(),
                    color = LvdColors.Blue,
                    trackColor = LvdColors.Border,
                )
                Spacer(Modifier.height(LvdSpacing.Md))
                Text(
                    "$progress%",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = LvdColors.TextPrimary,
                )
            }
        },
    )
}

@Composable
fun VerifyingDialog() {
    LvdDialog(
        onDismissRequest = {},
        title = "Verificando actualización",
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = LvdColors.Blue, strokeWidth = 2.dp)
                Spacer(Modifier.width(LvdSpacing.Md))
                Text(
                    "Comprobando integridad del archivo...",
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )
            }
        },
    )
}

@Composable
fun ReadyToInstallDialog(
    manifest: UpdateManifest,
    onInstall: () -> Unit,
) {
    LvdDialog(
        onDismissRequest = {},
        icon = {
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(48.dp),
            )
        },
        title = "Actualización lista",
        text = {
            Text(
                "La versión ${manifest.versionName} se descargó y verificó correctamente. ¿Instalar ahora?",
                fontSize = 14.sp,
                color = LvdColors.TextSecondary,
            )
        },
        confirmButton = {
            LvdPrimaryButton(text = "Instalar ahora", onClick = onInstall, fullWidth = false)
        },
    )
}

private fun formatSize(bytes: Long): String {
    val mb = bytes / 1_048_576f
    return if (mb >= 1f) "${"%.1f".format(mb)} MB" else "${bytes / 1024} KB"
}
