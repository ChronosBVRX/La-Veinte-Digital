package com.laveintedigital.app.offline

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.collectAsState
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
import com.laveintedigital.app.imss.payslips.NativeDocuments
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

private enum class OfflineFilter(val label: String) {
    TODOS("Todos"),
    TARJETONES("Tarjetones"),
    CHECADAS("Checadas"),
    ESCRITOS("Escritos"),
}

/**
 * Pantalla Compose 100% nativa de documentos guardados (modo offline).
 *
 * Sin WebView y sin llamadas de red: lee Room + archivos físicos de filesDir vía
 * [NativeDocuments]. Reutiliza el visor local ([onViewPdf]) y el compartir por FileProvider.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfflineDocumentsScreen(
    onBack: () -> Unit,
    onViewPdf: (filePath: String, title: String) -> Unit,
    onReturnOnline: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)

    var loading by remember { mutableStateOf(true) }
    var docs by remember { mutableStateOf<List<PayslipDocument>>(emptyList()) }
    var filter by remember { mutableStateOf(OfflineFilter.TODOS) }
    var deleteTarget by remember { mutableStateOf<PayslipDocument?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }
    val backOnline by NetworkMonitor.validatedInternet.collectAsState()

    fun reload() {
        scope.launch {
            loading = true
            feedback = null
            try {
                // Limpieza conservadora de huérfanos (archivo ausente) antes de listar.
                val pruned = NativeDocuments.pruneMissingFiles(context)
                if (pruned.isNotEmpty()) {
                    android.util.Log.i(
                        OfflineLog.TAG,
                        "${OfflineLog.EVENT_FILE_MISSING} pruned=${pruned.size}",
                    )
                }
                val db = com.laveintedigital.app.imss.payslips.PayslipDatabase
                    .getInstance(context).payslipDao().getAll()
                val owner = NativeSessionOwner.current(context)
                docs = db.filter { NativeDocuments.isVisibleTo(it.ownerId, owner) }
                    .filter { runCatching { File(it.localPath).exists() }.getOrDefault(false) }
            } catch (e: Exception) {
                android.util.Log.w(OfflineLog.TAG, "offline_docs_load_failed", e)
                feedback = "No se pudieron cargar los documentos."
                docs = emptyList()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        android.util.Log.i(OfflineLog.TAG, OfflineLog.EVENT_DOCS_OPENED)
        reload()
    }

    val visible = remember(docs, filter) {
        docs.filter { d ->
            when (filter) {
                OfflineFilter.TODOS -> true
                OfflineFilter.TARJETONES ->
                    OfflineDetection.bucketFor(d.source) == OfflineDetection.DocBucket.TARJETON
                OfflineFilter.CHECADAS ->
                    OfflineDetection.bucketFor(d.source) == OfflineDetection.DocBucket.CHECADAS
                OfflineFilter.ESCRITOS ->
                    OfflineDetection.bucketFor(d.source) == OfflineDetection.DocBucket.ESCRITO
            }
        }
    }

    fun shareDoc(doc: PayslipDocument) {
        runCatching {
            val base = context.filesDir.canonicalFile
            val file = runCatching { File(doc.localPath).canonicalFile }.getOrNull()
            if (file == null || !file.path.startsWith(base.path) || !file.exists()) {
                feedback = "Archivo no disponible."
                return
            }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TITLE, doc.displayName)
                clipData = android.content.ClipData.newRawUri(doc.displayName, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, doc.displayName))
            android.util.Log.i(OfflineLog.TAG, "${OfflineLog.EVENT_DOC_SHARED} id=${doc.id} source=${doc.source}")
        }.onFailure {
            feedback = "No se pudo compartir el archivo."
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
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BrandNavy,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (backOnline == true) {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Conexión recuperada",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Primary,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onReturnOnline) {
                        Text("Volver a La Veinte Digital", fontSize = 13.sp)
                    }
                }
            }

            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Text(
                    "Estás sin conexión.",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Puedes consultar los archivos guardados en este dispositivo.",
                    fontSize = 13.sp,
                    color = Color.Gray,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OfflineFilter.entries.forEach { f ->
                    FilterChip(
                        selected = filter == f,
                        onClick = { filter = f },
                        label = { Text(f.label, fontSize = 13.sp) },
                    )
                }
            }

            feedback?.let { msg ->
                Text(
                    msg,
                    fontSize = 13.sp,
                    color = Color(0xFFB91C1C),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            when {
                loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text("Cargando documentos…", fontSize = 14.sp, color = Color.Gray)
                    }
                }
                visible.isEmpty() -> {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text("No tienes documentos guardados en este dispositivo", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Los tarjetones, checadas y escritos que guardes aparecerán aquí y podrás abrirlos sin conexión.",
                            color = Color.Gray,
                            fontSize = 13.sp,
                        )
                    }
                }
                else -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(visible, key = { it.id }) { doc ->
                            val df = remember {
                                SimpleDateFormat("dd MMM yyyy", Locale("es", "MX"))
                            }
                            val bucket = OfflineDetection.bucketFor(doc.source)
                            Row(
                                modifier = Modifier.fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        doc.displayName,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        "${OfflineDetection.bucketLabel(bucket)} · ${df.format(Date(doc.downloadedAt))} · ${formatSize(doc.fileSize)}",
                                        fontSize = 12.sp,
                                        color = Color.Gray,
                                    )
                                }
                                IconButton(onClick = {
                                    android.util.Log.i(OfflineLog.TAG, "${OfflineLog.EVENT_DOC_OPENED} id=${doc.id} source=${doc.source}")
                                    onViewPdf(doc.localPath, viewerTitle(doc))
                                }) {
                                    Icon(Icons.Filled.Visibility, "Abrir", tint = Primary)
                                }
                                IconButton(onClick = { shareDoc(doc) }) {
                                    Icon(Icons.Filled.Share, "Compartir", tint = Color.Gray)
                                }
                                IconButton(onClick = { deleteTarget = doc }) {
                                    Icon(Icons.Filled.Delete, "Eliminar", tint = Color.Gray)
                                }
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
                        val target = doc
                        deleteTarget = null
                        scope.launch {
                            val res = NativeDocuments.deleteById(context, target.id, target.localPath)
                            val ok = runCatching { res.getBoolean("ok") }.getOrDefault(false)
                            if (ok) {
                                android.util.Log.i(OfflineLog.TAG, "${OfflineLog.EVENT_DOC_DELETED} id=${target.id}")
                            } else {
                                feedback = "No se pudo eliminar el documento."
                            }
                            reload()
                        }
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

private fun viewerTitle(doc: PayslipDocument): String = when (
    OfflineDetection.bucketFor(doc.source)
) {
    OfflineDetection.DocBucket.CHECADAS -> "Checadas"
    OfflineDetection.DocBucket.ESCRITO -> "Escrito"
    else -> "Tarjetón"
}

private fun formatSize(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return "${bytes / 1024} KB"
    return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
}
