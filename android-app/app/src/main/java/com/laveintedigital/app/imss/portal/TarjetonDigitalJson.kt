package com.laveintedigital.app.imss.portal

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

/**
 * Parsea el resultado de `WebView.evaluateJavascript`.
 *
 * `evaluateJavascript` serializa el valor devuelto por el script como JSON. Cuando
 * el script hace `JSON.stringify(...)`, el resultado llega con DOBLE serialización:
 *   - objeto:  "{\"a\":1}"   (JSON string que contiene el objeto)
 *   - array:   "[{\"a\":1}]" (JSON string que contiene el array)
 *
 * Estas funciones resuelven ese nivel extra de string de forma centralizada, para
 * no repetir el bug de "leer el JSONArray/JSONObject directamente y obtener null".
 */
object TarjetonDigitalJson {

    fun parseObject(raw: String?): JSONObject? {
        if (raw == null || raw == "null" || raw == "undefined") return null
        return try {
            val v = JSONTokener(raw).nextValue()
            when (v) {
                is JSONObject -> v
                is String -> JSONObject(v)
                else -> null
            }
        } catch (e: Exception) { null }
    }

    fun parseArray(raw: String?): JSONArray? {
        if (raw == null || raw == "null" || raw == "undefined") return null
        return try {
            val v = JSONTokener(raw).nextValue()
            when (v) {
                is JSONArray -> v
                is String -> JSONArray(v)
                else -> null
            }
        } catch (e: Exception) { null }
    }
}
