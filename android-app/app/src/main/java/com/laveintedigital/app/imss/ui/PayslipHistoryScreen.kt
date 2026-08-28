package com.laveintedigital.app.imss.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.laveintedigital.app.imss.payslips.PayslipDatabase
import com.laveintedigital.app.imss.payslips.PayslipDocument
import com.laveintedigital.app.ui.lvd.LvdColors
import com.laveintedigital.app.ui.lvd.LvdDialog
import com.laveintedigital.app.ui.lvd.LvdPrimaryButton
import com.laveintedigital.app.ui.theme.BrandNavy
import com.laveintedigital.app.ui.theme.Primary
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayslipHistoryScreen(
    onViewPdf: (String) -> Unit,
    onBack: () -> Unit,
    onPrint: (String) -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)
    var docs by remember { mutableStateOf<List<PayslipDocument>>(emptyList()) }
    var deleteTarget by remember { mutableStateOf<PayslipDocument?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            docs = PayslipDatabase.getInstance(context).payslipDao().getAll()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mis documentos") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BrandNavy, titleContentColor = Color.White, navigationIconContentColor = Color.White),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        if (docs.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Sin documentos guardados", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(8.dp))
                Text("Los PDF que descargues desde los portales IMSS (tarjetones y checadas) aparecerán aquí.", color = Color.Gray, fontSize = 13.sp)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(docs, key = { it.id }) { doc ->
                    val df = SimpleDateFormat("dd MMM yyyy", Locale("es", "MX"))
                    var menuOpen by remember { mutableStateOf(false) }
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(doc.displayName, fontWeight = FontWeight.Medium, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "${sourceLabel(doc.source)} · ${df.format(Date(doc.downloadedAt))} · ${doc.fileSize / 1024} KB",
                                fontSize = 12.sp, color = Color.Gray,
                            )
                        }
                        IconButton(onClick = { onViewPdf(doc.localPath) }) {
                            Icon(Icons.Filled.Visibility, "Ver", tint = Primary)
                        }
                        Box {
                            IconButton(onClick = { menuOpen = true }) {
                                Text("⋮", fontSize = 20.sp, color = Color.Gray)
                            }
                            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text("Enviar a imprimir") },
                                    leadingIcon = { Icon(Icons.Filled.Print, null) },
                                    onClick = { menuOpen = false; onPrint(doc.localPath) },
                                )
                                DropdownMenuItem(
                                    text = { Text("Compartir") },
                                    leadingIcon = { Icon(Icons.Filled.Share, null) },
                                    onClick = {
                                        menuOpen = false
                                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", File(doc.localPath))
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type = "application/pdf"
                                            putExtra(Intent.EXTRA_STREAM, uri)
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        context.startActivity(Intent.createChooser(intent, "Compartir"))
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Eliminar") },
                                    leadingIcon = { Icon(Icons.Filled.Delete, null) },
                                    onClick = { menuOpen = false; deleteTarget = doc },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    deleteTarget?.let { doc ->
        LvdDialog(
            onDismissRequest = { deleteTarget = null },
            title = "Eliminar documento",
            text = {
                Text(
                    "Se eliminará únicamente de este dispositivo.",
                    fontSize = 14.sp,
                    color = LvdColors.TextSecondary,
                )
            },
            confirmButton = {
                LvdPrimaryButton(
                    text = "Eliminar",
                    onClick = {
                        scope.launch {
                            PayslipDatabase.getInstance(context).payslipDao().delete(doc)
                            File(doc.localPath).delete()
                            docs = PayslipDatabase.getInstance(context).payslipDao().getAll()
                        }
                        deleteTarget = null
                    },
                    fullWidth = false,
                )
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("Cancelar", color = LvdColors.TextSecondary)
                }
            },
        )
    }
}

/** Etiqueta de origen del documento (Tarjetón / Checadas / portal fuente). */
private fun sourceLabel(source: String): String = when (source) {
    "TU_PERFIL_BIOMETRIC" -> "Checadas · Tu Perfil IMSS"
    "TU_PERFIL" -> "Tarjetón · Tu Perfil IMSS"
    "TARJETON_DIGITAL" -> "Tarjetón · Tarjetón Digital"
    else -> source
}
