package com.laveintedigital.app.scanner

import android.app.Activity
import android.content.Context
import android.content.IntentSender
import android.net.Uri
import com.google.android.gms.tasks.Task

/**
 * Abstracción del motor de escaneo nativo.
 *
 * La implementación de producción es [NativeMlKitDocumentScanner] (Google ML Kit
 * Document Scanner, `play-services-mlkit-document-scanner`). La interfaz permite
 * sustituir el motor en pruebas sin arrastrar Play services.
 */
interface DocumentScannerService {

    /** true si el dispositivo puede ejecutar el scanner (Play services + RAM suficiente). */
    fun isAvailable(context: Context): Boolean

    /** Construye el IntentSender del flujo de captura de ML Kit. */
    fun startScanIntent(activity: Activity, options: ScanDocumentOptions): Task<IntentSender>

    /**
     * Decodifica y recomprime las páginas devueltas por ML Kit a JPEG listos para
     * viajar por el puente como base64.
     */
    suspend fun readPages(
        context: Context,
        imageUris: List<Uri>,
        maxDimensionPx: Int = DEFAULT_MAX_DIMENSION_PX,
    ): List<ScannedPageData>

    companion object {
        /** Lado máximo de cada página enviada a la web (suficiente para carta a ~200 DPI). */
        const val DEFAULT_MAX_DIMENSION_PX = 2200
        const val JPEG_QUALITY = 82
    }
}
