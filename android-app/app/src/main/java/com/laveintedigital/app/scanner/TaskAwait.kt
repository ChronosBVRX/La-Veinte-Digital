package com.laveintedigital.app.scanner

import com.google.android.gms.tasks.Task
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Puente entre `com.google.android.gms.tasks.Task` y corrutinas, sin añadir
 * `kotlinx-coroutines-play-services` (dependencia no presente en el proyecto).
 */
suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { value ->
        if (continuation.isActive) continuation.resume(value)
    }
    addOnFailureListener { error ->
        if (continuation.isActive) continuation.resumeWithException(error)
    }
    addOnCanceledListener {
        if (continuation.isActive) {
            continuation.resumeWithException(java.util.concurrent.CancellationException("Tarea cancelada"))
        }
    }
}
