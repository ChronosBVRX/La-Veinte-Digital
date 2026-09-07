package com.laveintedigital.app.offline

/** Tags y nombres de eventos de diagnóstico del modo offline (sin datos sensibles). */
object OfflineLog {
    const val TAG = "OFFLINE_MODE"
    const val EVENT_ENTERED = "OFFLINE_MODE_ENTERED"
    const val EVENT_DOCS_OPENED = "OFFLINE_DOCUMENTS_OPENED"
    const val EVENT_FILE_MISSING = "OFFLINE_FILE_MISSING"
    const val EVENT_RECOVERED = "NETWORK_RECOVERED"
    const val EVENT_DOC_OPENED = "OFFLINE_DOC_OPENED"
    const val EVENT_DOC_SHARED = "OFFLINE_DOC_SHARED"
    const val EVENT_DOC_DELETED = "OFFLINE_DOC_DELETED"
    const val EVENT_DOC_SAVED = "OFFLINE_DOC_SAVED"
}
