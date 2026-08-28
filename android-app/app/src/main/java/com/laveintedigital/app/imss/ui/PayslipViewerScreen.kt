package com.laveintedigital.app.imss.ui

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.laveintedigital.app.ui.theme.BrandNavy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.roundToInt

private const val MIN_SCALE = 1f
private const val MAX_SCALE = 5f
private const val DOUBLE_TAP_SCALE = 2.25f

// Inertia/fling is DISABLED until direct 1:1 pan is validated (see PDF_PAN_DEBUG).
private const val FLING_ENABLED = false

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayslipViewerScreen(
    filePath: String,
    title: String = "Tarjetón",
    onBack: () -> Unit,
    onPrint: (String) -> Unit = {},
) {
    val context = LocalContext.current
    val file = remember(filePath) { File(filePath) }
    com.laveintedigital.app.ui.theme.StatusBarAppearance(lightIcons = false)

    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    var viewportW by remember { mutableFloatStateOf(0f) }
    var viewportH by remember { mutableFloatStateOf(0f) }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var flingJob by remember { mutableStateOf<Job?>(null) }

    // Decoupled from `scale` so the LazyColumn does NOT recompose on every gesture frame.
    var listScrollEnabled by remember { mutableStateOf(true) }
    LaunchedEffect(scale) { listScrollEnabled = scale <= 1f }

    // Render each page once, off the main thread, at ~2x for crisp zoom.
    val pages by produceState<List<Bitmap>?>(initialValue = null, file, context) {
        value = if (file.exists()) {
            withContext(Dispatchers.IO) {
                try { renderPages(file, context.resources.displayMetrics) }
                catch (e: Exception) { null }
            }
        } else null
    }
    val renderedPages = pages.orEmpty()
    val pageCount = renderedPages.size

    LaunchedEffect(pages) {
        if (com.laveintedigital.app.BuildConfig.DEBUG) {
            android.util.Log.i("PayslipViewer", "LOCAL_PDF_VIEWER_OPEN pageCount=$pageCount size=${file.length()}")
        }
    }
    val currentPage by remember(pageCount) {
        derivedStateOf {
            if (pageCount == 0) 0 else (listState.firstVisibleItemIndex + 1).coerceIn(1, pageCount)
        }
    }

    fun clampOffsets() {
        val maxX = ((viewportW * scale - viewportW) / 2f).coerceAtLeast(0f)
        val maxY = ((viewportH * scale - viewportH) / 2f).coerceAtLeast(0f)
        offsetX = offsetX.coerceIn(-maxX, maxX)
        offsetY = offsetY.coerceIn(-maxY, maxY)
    }

    fun resetZoom() {
        scale = 1f
        offsetX = 0f
        offsetY = 0f
    }

    fun toggleZoom(tapPos: Offset) {
        if (scale > 1f) {
            resetZoom()
        } else {
            val cx = viewportW / 2f
            val cy = viewportH / 2f
            scale = DOUBLE_TAP_SCALE
            offsetX = (tapPos.x - cx) * (1f - scale)
            offsetY = (tapPos.y - cy) * (1f - scale)
            clampOffsets()
        }
    }

    fun sharePdf() {
        if (!file.exists()) return
        try {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            // Share sheet causes onPause — do NOT close the viewer or this screen.
            context.startActivity(Intent.createChooser(intent, "Compartir tarjetón"))
        } catch (e: Exception) {
            Toast.makeText(context, "No se pudo compartir el tarjetón", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { sharePdf() }) {
                        Icon(Icons.Filled.Share, "Compartir", tint = Color.White)
                    }
                    IconButton(onClick = { onPrint(filePath) }) {
                        Icon(Icons.Filled.Print, "Enviar a imprimir", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BrandNavy, titleContentColor = Color.White, navigationIconContentColor = Color.White),
            )
        },
        containerColor = Color.DarkGray,
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .onSizeChanged { viewportW = it.width.toFloat(); viewportH = it.height.toFloat() },
        ) {
            if (renderedPages.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                            translationX = offsetX
                            translationY = offsetY
                        }
                        .clipToBounds()
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onDoubleTap = { pos -> toggleZoom(pos) },
                            )
                        }
                        .pointerInput(Unit) {
                            val tracker = VelocityTracker()
                            var lastSampleMs = 0L
                            awaitEachGesture {
                                flingJob?.cancel()
                                tracker.resetTracking()
                                var panning = false
                                awaitFirstDown(requireUnconsumed = false)
                                do {
                                    val event = awaitPointerEvent()
                                    val pressed = event.changes.filter { it.pressed }
                                    val count = pressed.size
                                    // The zoomable layer owns the gesture when zoomed in, or with two fingers.
                                    if (count >= 2 || (count == 1 && scale > 1f)) {
                                        val centroid =
                                            pressed.fold(Offset.Zero) { acc, c -> acc + c.position } / count.toFloat()
                                        val pan = event.calculatePan()
                                        val zoom = event.calculateZoom()
                                        // Consume everything this layer uses so the LazyColumn never competes.
                                        event.changes.forEach { it.consume() }

                                        val oldScale = scale
                                        val newScale = (oldScale * zoom).coerceIn(MIN_SCALE, MAX_SCALE)
                                        val ratio = newScale / oldScale
                                        val cx = viewportW / 2f
                                        val cy = viewportH / 2f
                                        // Fingers' centroid BEFORE this event applies (screen px).
                                        val centroidOld = centroid - pan

                                        val beforeX = offsetX
                                        val beforeY = offsetY
                                        // DIRECT 1:1 pan in viewport px, plus zoom anchored to the centroid.
                                        // When ratio == 1 this collapses to exactly offset += pan.
                                        val appliedX = pan.x + (1f - ratio) * (centroidOld.x - beforeX - cx)
                                        val appliedY = pan.y + (1f - ratio) * (centroidOld.y - beforeY - cy)
                                        if (ratio != 1f || pan != Offset.Zero) {
                                            offsetX = beforeX + appliedX
                                            offsetY = beforeY + appliedY
                                            scale = newScale
                                            if (scale <= 1f) resetZoom() else clampOffsets()
                                            panning = scale > 1f
                                        }
                                        tracker.addPosition(SystemClock.uptimeMillis(), centroid)

                                        if (com.laveintedigital.app.BuildConfig.DEBUG) {
                                            val now = SystemClock.uptimeMillis()
                                            if (now - lastSampleMs >= 100L) {
                                                lastSampleMs = now
                                                val clamped =
                                                    offsetX != beforeX + appliedX || offsetY != beforeY + appliedY
                                                android.util.Log.i(
                                                    "PDF_PAN_DEBUG",
                                                    "scale=${"%.2f".format(scale)} " +
                                                        "rawPanX=${"%.1f".format(pan.x)} rawPanY=${"%.1f".format(pan.y)} " +
                                                        "appliedX=${"%.1f".format(appliedX)} appliedY=${"%.1f".format(appliedY)} " +
                                                        "offsetX=${"%.1f".format(offsetX)} offsetY=${"%.1f".format(offsetY)} " +
                                                        "clamped=$clamped fingers=$count"
                                                )
                                            }
                                        }
                                    }
                                } while (event.changes.any { it.pressed })

                                if (FLING_ENABLED && panning && scale > 1f) {
                                    val velocity = tracker.calculateVelocity()
                                    if (abs(velocity.x) >= 60f || abs(velocity.y) >= 60f) {
                                        flingJob = scope.launch {
                                            var vx = velocity.x
                                            var vy = velocity.y
                                            var lastFrame = withFrameNanos { it }
                                            while (abs(vx) > 24f || abs(vy) > 24f) {
                                                val frame = withFrameNanos { it }
                                                val dt = ((frame - lastFrame) / 1_000_000_000f).coerceIn(0f, 0.05f)
                                                lastFrame = frame
                                                if (dt <= 0f) continue
                                                val decay = exp(-4.8f * dt)
                                                offsetX += vx * dt
                                                offsetY += vy * dt
                                                vx *= decay
                                                vy *= decay
                                                if (scale > 1f) clampOffsets()
                                            }
                                            if (scale > 1f) clampOffsets()
                                        }
                                    }
                                }
                            }
                        },
                ) {
                    LazyColumn(
                        state = listState,
                        userScrollEnabled = listScrollEnabled,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(vertical = 8.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        itemsIndexed(renderedPages) { index, bmp ->
                            val aspect = bmp.width.toFloat() / bmp.height.toFloat()
                            Image(
                                bitmap = bmp.asImageBitmap(),
                                contentDescription = "Página ${index + 1}",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp)
                                    .background(Color.White)
                                    .aspectRatio(aspect),
                                contentScale = ContentScale.FillWidth,
                            )
                        }
                    }
                }
            } else {
                Text(
                    "No se puede abrir el PDF",
                    color = Color.White,
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            // Discrete page indicator
            if (pageCount > 0) {
                Text(
                    "$currentPage / $pageCount",
                    color = Color.White,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 14.dp)
                        .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }
    }
}

/** Renders all pages of the PDF as white-background bitmaps at ~2x for zoom legibility. */
private fun renderPages(file: File, metrics: android.util.DisplayMetrics): List<Bitmap> {
    val renderer = PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))
    try {
        val pages = ArrayList<Bitmap>(renderer.pageCount)
        val fitPx = (metrics.widthPixels - 64f).coerceAtLeast(120f)
        for (i in 0 until renderer.pageCount) {
            val page = renderer.openPage(i)
            val factor = (fitPx / page.width.toFloat()).coerceIn(1.5f, 2.5f)
            val w = (page.width * factor).roundToInt().coerceAtLeast(1)
            val h = (page.height * factor).roundToInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bmp.eraseColor(android.graphics.Color.WHITE)
            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            pages += bmp
            if (com.laveintedigital.app.BuildConfig.DEBUG) {
                android.util.Log.i("PayslipViewer", "LOCAL_PDF_PAGE_RENDERED page=${i + 1} width=$w height=$h")
            }
        }
        return pages
    } finally {
        renderer.close()
    }
}