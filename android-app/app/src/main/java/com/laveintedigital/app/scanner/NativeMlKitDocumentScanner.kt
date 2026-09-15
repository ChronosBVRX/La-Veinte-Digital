package com.laveintedigital.app.scanner

import android.app.Activity
import android.content.Context
import android.content.IntentSender
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import java.io.ByteArrayOutputStream

/**
 * Implementación productiva del scanner usando Google ML Kit Document Scanner.
 *
 * - El flujo de captura (visores, detección de bordes, corrección de perspectiva y
 *   mejora de imagen) es provisto por Google Play services: 100% en dispositivo.
 * - Solo se piden páginas JPEG (no PDF) porque el PDF final se construye en la web,
 *   con el mismo pipeline multipágina/INE para ambos motores.
 * - No se extrae texto ni datos personales: las imágenes se reencoden localmente.
 */
class NativeMlKitDocumentScanner : DocumentScannerService {

    override fun isAvailable(context: Context): Boolean {
        // Play services debe estar presente; ML Kit además valida RAM/versión internamente.
        return try {
            context.packageManager.getPackageInfo(GOOGLE_PLAY_SERVICES_PACKAGE, 0)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Play services no disponible", e)
            false
        }
    }

    override fun startScanIntent(activity: Activity, options: ScanDocumentOptions): Task<IntentSender> {
        val scannerOptions = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(options.allowGallery)
            .setPageLimit(options.pageLimit)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()
        return GmsDocumentScanning.getClient(scannerOptions).getStartScanIntent(activity)
    }

    override suspend fun readPages(
        context: Context,
        imageUris: List<Uri>,
        maxDimensionPx: Int,
    ): List<ScannedPageData> {
        val pages = mutableListOf<ScannedPageData>()
        for (uri in imageUris) {
            val decoded = decodeScaledBitmap(context, uri, maxDimensionPx) ?: continue
            val output = ByteArrayOutputStream()
            decoded.bitmap.compress(Bitmap.CompressFormat.JPEG, DocumentScannerService.JPEG_QUALITY, output)
            val bytes = output.toByteArray()
            if (decoded.bitmap !== decoded.original) decoded.original.recycle()
            decoded.bitmap.recycle()
            pages.add(
                ScannedPageData(
                    base64 = Base64.encodeToString(bytes, Base64.NO_WRAP),
                    mimeType = "image/jpeg",
                    width = decoded.bitmapWidth,
                    height = decoded.bitmapHeight,
                )
            )
        }
        return pages
    }

    private class DecodedBitmap(
        val bitmap: Bitmap,
        val original: Bitmap,
        val bitmapWidth: Int,
        val bitmapHeight: Int,
    )

    private fun decodeScaledBitmap(context: Context, uri: Uri, maxDimensionPx: Int): DecodedBitmap? {
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, bounds)
            } ?: return null
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

            var sampleSize = 1
            while ((bounds.outWidth / sampleSize) > maxDimensionPx * 2 || (bounds.outHeight / sampleSize) > maxDimensionPx * 2) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val decoded = context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, decodeOptions)
            } ?: return null

            val longest = maxOf(decoded.width, decoded.height)
            val scaled = if (longest > maxDimensionPx) {
                val ratio = maxDimensionPx.toFloat() / longest.toFloat()
                Bitmap.createScaledBitmap(
                    decoded,
                    (decoded.width * ratio).toInt().coerceAtLeast(1),
                    (decoded.height * ratio).toInt().coerceAtLeast(1),
                    true,
                )
            } else {
                decoded
            }
            DecodedBitmap(bitmap = scaled, original = decoded, bitmapWidth = scaled.width, bitmapHeight = scaled.height)
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo decodificar la página escaneada", e)
            null
        } catch (e: OutOfMemoryError) {
            Log.e(TAG, "OOM decodificando página escaneada", e)
            null
        }
    }

    companion object {
        private const val TAG = "MlKitDocScanner"
        private const val GOOGLE_PLAY_SERVICES_PACKAGE = "com.google.android.gms"
    }
}
