package com.laveintedigital.app.offline

import android.content.Intent
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class OfflineSection(val label: String, val icon: ImageVector) {
    DOCUMENTOS("Documentos", Icons.Filled.Description),
    QUINCENA("Mi Quincena", Icons.Filled.Payments),
    AGENDA("Mi Agenda", Icons.Filled.CalendarMonth),
    HERRAMIENTAS("Calculadoras", Icons.Filled.Calculate),
}

private enum class OfflineFilter(val label: String) {
    TODOS("Todos"),
    TARJETONES("Tarjetones"),
    CHECADAS("Checadas"),
    ESCRITOS("Escritos"),
    NORMATIVA("Normativa"),
}

/**
 * Pantalla Compose 100% nativa para el Modo Sin Conexión.
 *
 * Sin WebView y sin llamadas de red:
 * - Lee Room + archivos físicos de filesDir vía [NativeDocuments] (vista predeterminada "Documentos PDF").
 * - Lee el snapshot sincronizado de solo lectura vía [OfflineSnapshotStore] ("Mi Quincena", "Mi Agenda").
 * - Ofrece buscador offline de conceptos IMSS y calculadoras rápidas deterministas ("Calculadoras y Guía").
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

    var section by remember { mutableStateOf(OfflineSection.DOCUMENTOS) }
    var loading by remember { mutableStateOf(true) }
    var docs by remember { mutableStateOf<List<PayslipDocument>>(emptyList()) }
    var snapshot by remember { mutableStateOf<OfflineSnapshotStore.OfflineWorkerSnapshot?>(null) }
    var filter by remember { mutableStateOf(OfflineFilter.TODOS) }
    var deleteTarget by remember { mutableStateOf<PayslipDocument?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }
    val backOnline by NetworkMonitor.validatedInternet.collectAsState()

    fun reload() {
        scope.launch {
            loading = true
            feedback = null
            try {
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
                snapshot = withContext(Dispatchers.IO) {
                    OfflineSnapshotStore.loadForCurrentOwner(context)
                }
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
                OfflineFilter.NORMATIVA ->
                    OfflineDetection.bucketFor(d.source) == OfflineDetection.DocBucket.NORMATIVA
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
                title = { Text("Mis documentos y consulta offline") },
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        if (backOnline == true) "Modo consulta local" else "Estás sin conexión.",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    if (backOnline != true) {
                        TextButton(onClick = onReturnOnline) {
                            Text("Reintentar conexión", fontSize = 13.sp)
                        }
                    }
                }
                val syncLabel = remember(snapshot) {
                    snapshot?.syncedAtMs?.takeIf { it > 0L }?.let { ms ->
                        val fmt = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("es", "MX"))
                        "Última sincronización con servidor: ${fmt.format(Date(ms))}"
                    } ?: "Puedes consultar los archivos y herramientas disponibles en este dispositivo."
                }
                Text(
                    syncLabel,
                    fontSize = 12.sp,
                    color = Color.Gray,
                )
            }

            // Selector de sección offline (Pestañas nativas claras con iconos)
            TabRow(
                selectedTabIndex = section.ordinal,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = Primary,
                indicator = { tabPositions ->
                    if (section.ordinal < tabPositions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[section.ordinal]),
                            color = Primary,
                        )
                    }
                },
                divider = { HorizontalDivider(color = Color.LightGray.copy(alpha = 0.35f)) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                OfflineSection.entries.forEach { sec ->
                    val selected = section == sec
                    Tab(
                        selected = selected,
                        onClick = { section = sec },
                        text = {
                            Text(
                                text = sec.label,
                                fontSize = 11.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                        icon = {
                            Icon(
                                imageVector = sec.icon,
                                contentDescription = sec.label,
                                modifier = Modifier.size(20.dp),
                            )
                        },
                        selectedContentColor = Primary,
                        unselectedContentColor = Color.Gray,
                    )
                }
            }

            when (section) {
                OfflineSection.DOCUMENTOS -> {
                    LazyRow(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(OfflineFilter.entries) { f ->
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

                OfflineSection.QUINCENA -> {
                    OfflineQuincenaTab(snapshot = snapshot)
                }

                OfflineSection.AGENDA -> {
                    OfflineAgendaTab(snapshot = snapshot)
                }

                OfflineSection.HERRAMIENTAS -> {
                    OfflineToolsTab(snapshot = snapshot)
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

@Composable
private fun OfflineQuincenaTab(snapshot: OfflineSnapshotStore.OfflineWorkerSnapshot?) {
    val currency = remember { NumberFormat.getCurrencyInstance(Locale("es", "MX")) }
    if (snapshot == null || (snapshot.profile.fullName == null && snapshot.latestPayslip == null)) {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "Aún no hay resumen laboral sincronizado",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "En cuanto abras La Veinte Digital con conexión a Internet, tu perfil laboral y el desglose de tu último tarjetón se guardarán automáticamente aquí.\n\nNota: Si tienes tarjetones PDF guardados en este dispositivo, puedes consultarlos directamente en la pestaña «Documentos».",
                color = Color.Gray,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Mi Perfil Laboral", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = BrandNavy)
                    Spacer(Modifier.height(8.dp))
                    ProfileRow("Nombre", snapshot.profile.fullName ?: "—")
                    ProfileRow("Matrícula", snapshot.profile.matricula ?: "—")
                    ProfileRow("Categoría", snapshot.profile.categoria ?: "—")
                    ProfileRow("Antigüedad", snapshot.profile.antiguedad ?: "—")
                    ProfileRow("Adscripción", snapshot.profile.adscripcion ?: "—")
                    snapshot.latestPayslip?.vacationDueDate?.let { due ->
                        ProfileRow("Próximo vencimiento vacacional", due)
                    }
                }
            }
        }

        val payslip = snapshot.latestPayslip
        if (payslip != null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F9FF)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Resumen · ${payslip.periodLabel}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = BrandNavy,
                        )
                        Spacer(Modifier.height(8.dp))
                        ProfileRow("Total Percepciones", currency.format(payslip.totalEarnings))
                        ProfileRow("Total Deducciones", currency.format(payslip.totalDeductions))
                        ProfileRow("Neto Líquido", currency.format(payslip.netPay), highlight = true)
                    }
                }
            }

            if (payslip.lines.isNotEmpty()) {
                item {
                    Text(
                        "Conceptos del último tarjetón (${payslip.lines.size})",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                items(payslip.lines) { line ->
                    val isDeduction = line.kind.equals("deduction", ignoreCase = true)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text(
                                "${line.code} · ${line.description}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                if (isDeduction) "Deducción" else "Percepción",
                                fontSize = 11.sp,
                                color = Color.Gray,
                            )
                        }
                        Text(
                            currency.format(line.amount),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isDeduction) Color(0xFFB91C1C) else Color(0xFF047857),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OfflineAgendaTab(snapshot: OfflineSnapshotStore.OfflineWorkerSnapshot?) {
    val commitments = snapshot?.commitments.orEmpty()
    if (commitments.isEmpty()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "Sin registros de agenda sincronizados",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Tus registros de Tiempo Extra, TxT, Faltas y Recordatorios guardados en el calendario online se sincronizan automáticamente para consulta sin conexión.",
                color = Color.Gray,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(commitments, key = { it.id }) { item ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            item.typeLabel,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                        )
                        Text(
                            item.startAt.take(10),
                            fontSize = 12.sp,
                            color = Color.Gray,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(item.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    item.notes?.let { notes ->
                        Spacer(Modifier.height(4.dp))
                        Text(notes, fontSize = 12.sp, color = Color.DarkGray)
                    }
                }
            }
        }
    }
}

@Composable
private fun OfflineToolsTab(snapshot: OfflineSnapshotStore.OfflineWorkerSnapshot?) {
    val currency = remember { NumberFormat.getCurrencyInstance(Locale("es", "MX")) }
    val base = snapshot?.calculatorBase

    var sueldo002Text by remember(base) {
        mutableStateOf(
            if ((base?.sueldoBaseQuincenal002 ?: 0.0) > 0.0) base!!.sueldoBaseQuincenal002.toString() else ""
        )
    }
    var renta011Text by remember(base) {
        mutableStateOf(
            if ((base?.ayudaRentaQuincenal011 ?: 0.0) > 0.0) base!!.ayudaRentaQuincenal011.toString() else ""
        )
    }
    var extraHoursText by remember { mutableStateOf("8") }
    var searchQuery by remember { mutableStateOf("") }

    val sueldo002 = sueldo002Text.replace(",", "").toDoubleOrNull() ?: 0.0
    val renta011 = renta011Text.replace(",", "").toDoubleOrNull() ?: 0.0
    val extraHours = extraHoursText.replace(",", "").toDoubleOrNull() ?: 0.0
    val workdayHours = base?.workdayHours ?: 8.0

    val fondoJulio = remember(sueldo002, renta011) {
        OfflineSnapshotStore.calculateOfflineSegundaJulio(sueldo002, renta011, 365)
    }
    val aguinaldoEst = remember(sueldo002, renta011, base) {
        val monthly = if (sueldo002 > 0.0) (sueldo002 + renta011) * 2.0 else (base?.sueldoMensualIntegrado ?: 0.0)
        OfflineSnapshotStore.calculateOfflineAguinaldo(monthly, 365)
    }
    val tiempoExtraEst = remember(sueldo002, workdayHours, extraHours) {
        OfflineSnapshotStore.calculateOfflineTiempoExtra(sueldo002, workdayHours, extraHours)
    }
    val catalogResults = remember(searchQuery) {
        OfflineSnapshotStore.searchCatalog(searchQuery)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Calculadoras Rápidas Sin Conexión",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = BrandNavy,
                    )
                    Text(
                        "Simula tus prestaciones clave al instante. Si aún no tienes un tarjetón sincronizado, ingresa los montos quincenales para calcular:",
                        fontSize = 12.sp,
                        color = Color.Gray,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = sueldo002Text,
                            onValueChange = { sueldo002Text = it },
                            label = { Text("Concepto 002 (Sueldo Base Qnal)", fontSize = 12.sp) },
                            placeholder = { Text("Ej. 6500.00", fontSize = 12.sp, color = Color.Gray) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = renta011Text,
                            onValueChange = { renta011Text = it },
                            label = { Text("Concepto 011 (Ayuda Renta Qnal)", fontSize = 12.sp) },
                            placeholder = { Text("Ej. 2900.00", fontSize = 12.sp, color = Color.Gray) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = extraHoursText,
                        onValueChange = { extraHoursText = it },
                        label = { Text("Horas de Tiempo Extra a simular (Jornada ${workdayHours}h)", fontSize = 12.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(12.dp))
                    ProfileRow("2ª de Julio / Fondo de Ahorro (002 + 011, 45 días)", currency.format(fondoJulio), highlight = true)
                    ProfileRow("Aguinaldo Anual Estimado (90 días)", currency.format(aguinaldoEst))
                    ProfileRow("Tiempo Extra Estimado (${extraHours}h)", currency.format(tiempoExtraEst))
                }
            }
        }

        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Buscar concepto del tarjetón (ej. 002, 011, 055, ISR…)", fontSize = 13.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        items(catalogResults, key = { it.code }) { concept ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                    .padding(12.dp),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Concepto ${concept.code} · ${concept.title}",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = BrandNavy,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            concept.kind,
                            fontSize = 11.sp,
                            color = if (concept.kind == "Deducción") Color(0xFFB91C1C) else Color(0xFF047857),
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(concept.explanation, fontSize = 12.sp, color = Color.DarkGray)
                    Spacer(Modifier.height(2.dp))
                    Text(concept.clauseRef, fontSize = 11.sp, color = Color.Gray)
                }
            }
        }
    }
}

@Composable
private fun ProfileRow(label: String, value: String, highlight: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 12.sp, color = Color.Gray, modifier = Modifier.weight(1f))
        Text(
            value,
            fontSize = if (highlight) 14.sp else 13.sp,
            fontWeight = if (highlight) FontWeight.Bold else FontWeight.Medium,
            color = if (highlight) Primary else Color.Black,
        )
    }
}

private fun viewerTitle(doc: PayslipDocument): String = when (
    OfflineDetection.bucketFor(doc.source)
) {
    OfflineDetection.DocBucket.CHECADAS -> "Checadas"
    OfflineDetection.DocBucket.ESCRITO -> "Escrito"
    OfflineDetection.DocBucket.NORMATIVA -> if (doc.displayName.contains("Estatuto", ignoreCase = true)) "Estatutos SNTSS" else "Contrato Colectivo"
    else -> "Tarjetón"
}

private fun formatSize(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return "${bytes / 1024} KB"
    return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
}
