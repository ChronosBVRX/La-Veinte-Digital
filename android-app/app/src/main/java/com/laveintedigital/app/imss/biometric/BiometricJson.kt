package com.laveintedigital.app.imss.biometric

import com.laveintedigital.app.imss.portal.TarjetonDigitalJson
import org.json.JSONArray
import org.json.JSONObject

/**
 * Parsers puros de la función biométricos.
 *
 * `WebView.evaluateJavascript` devuelve JSON con DOBLE serialización cuando el
 * script hace `JSON.stringify(...)`; la solución existente
 * ([TarjetonDigitalJson]) ya resuelve ese nivel extra y se reutiliza aquí en
 * lugar de escribir un parser nuevo.
 */
object BiometricJson {

    /**
     * Parsea la lista de periodos desde `window.__LVD_BIO_PERIODS__`.
     * Acepta tanto el objeto directo como la doble serialización.
     */
    fun parsePeriods(raw: String?): List<BiometricPeriod> {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return emptyList()
        return parsePeriodArray(obj.optJSONArray("periods"))
    }

    /** Parsea el arreglo `periods` de forma tolerante (objectos {value,label}). */
    fun parsePeriodArray(arr: JSONArray?): List<BiometricPeriod> {
        if (arr == null) return emptyList()
        val out = mutableListOf<BiometricPeriod>()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val value = item.optString("value").trim()
            val label = item.optString("label").trim().ifBlank { value }
            if (value.isNotEmpty() && label.isNotEmpty()) out += BiometricPeriod(value, label)
        }
        return out
    }

    /** Parsea el arreglo `ooads` de la lectura de OOAD ({value,label}). */
    fun parseOoads(arr: JSONArray?): List<BiometricOoad> {
        if (arr == null) return emptyList()
        val out = mutableListOf<BiometricOoad>()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val value = item.optString("value").trim()
            val label = item.optString("label").trim().ifBlank { value }
            if (value.isNotEmpty() && label.isNotEmpty()) out += BiometricOoad(value, label)
        }
        return out
    }

    /**
     * Parsea el snapshot de resultados del DOM.
     *
     * El snapshot JS es `{status, columns:[{key,label}], rows:[[c0,c1,...]],
     * message}`. Las filas llegan como arreglos alineados con las columnas;
     * se convierten a `BiometricRecord.fields` indexado por clave de columna.
     * Celdas extra reciben clave `extra_i` y celdas vacías se conservan.
     */
    fun parseSnapshot(raw: String?): BiometricQuerySnapshot? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val status = when (obj.optString("status").lowercase()) {
            "rows", "results" -> BiometricQueryStatus.ROWS
            "empty" -> BiometricQueryStatus.EMPTY
            "error" -> BiometricQueryStatus.ERROR
            "loading" -> BiometricQueryStatus.LOADING
            "unauth" -> BiometricQueryStatus.UNAUTHENTICATED
            "waiting", "idle" -> BiometricQueryStatus.IDLE
            else -> BiometricQueryStatus.IDLE
        }

        val columns = parseColumns(obj.optJSONArray("columns"))
        val rows = parseRows(obj.optJSONArray("rows"), columns)
        val message = obj.optString("message").trim().ifBlank { null }

        return BiometricQuerySnapshot(
            status = status,
            columns = columns,
            rows = rows,
            emptyMessage = if (status == BiometricQueryStatus.EMPTY) message else null,
            errorMessage = if (status == BiometricQueryStatus.ERROR) message else null,
        )
    }

    fun parseColumns(arr: JSONArray?): List<BiometricColumn> {
        if (arr == null) return emptyList()
        val out = mutableListOf<BiometricColumn>()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val key = item.optString("key").ifBlank { "c$i" }
            val label = item.optString("label").trim()
            out += BiometricColumn(key, label)
        }
        return out
    }

    fun parseRows(arr: JSONArray?, columns: List<BiometricColumn>): List<BiometricRecord> {
        if (arr == null) return emptyList()
        val out = mutableListOf<BiometricRecord>()
        for (i in 0 until arr.length()) {
            val row = arr.optJSONArray(i) ?: continue
            val fields = linkedMapOf<String, String>()
            for (j in 0 until row.length()) {
                val key = columns.getOrNull(j)?.key ?: "extra_$j"
                val cell = row.optString(j).trim()
                fields[key] = cell
            }
            out += BiometricRecord(fields)
        }
        return out
    }
}
