package com.laveintedigital.app.imss.biometric

import com.laveintedigital.app.imss.portal.TarjetonDigitalJson
import org.json.JSONArray
import org.json.JSONObject

/**
 * Instrumentación de descubrimiento del portal "Registros biométricos".
 *
 * Antes de seguir ajustando heurísticas a ciegas, esta capa permite descubrir
 * la estructura REAL de `/app/administration/biometric/consult-period`:
 *
 *  - **Start-una-vez / poll-estado**: `startDiscoveryJs(runId)` inyecta UN
 *    solo IIFE async por intento (runId único) y `readDiscoveryStateJs()`
 *    SOLO lee `window.__LVD_BIO_DISCOVERY__`. Kotlin nunca vuelve a inyectar
 *    el trabajo async en cada poll (causa probable del fallo intermitente
 *    previo: abrir/cerrar el mat-select mientras Angular aún hidrataba las
 *    opciones).
 *  - **Contrato de estado explícito**: `{status:"working"|"success"|"error",
 *    runId, periods, control, sampleClosed, samples, reason}`. Kotlin espera
 *    `status=="success"`; `working`/`missing` NUNCA se interpretan como
 *    fallo.
 *  - **Selector por evidencia**: el control de periodo se elige por
 *    formcontrolname/texto/aria-label/placeholder ("periodo"/"quincena") +
 *    label del mat-form-field vecino + visibilidad; se registra qué evidencia
 *    lo seleccionó. Prohibido asumir que el primer mat-select es Periodo.
 *  - **Muestreo A/B/C/D**: estado de las opciones con el selector cerrado (A)
 *    y a 0/250/750ms tras abrirlo (B/C/D), con MutationObserver sobre
 *    `.cdk-overlay-container` (desconectado en success/error/orphan).
 *  - **Volcado estructural sanitizado** (`dumpJs`): select/option/mat-select/
 *    mat-option/combobox/listbox/option-role/mat-form-field/input/textarea/
 *    button/tablas/encabezados, sin contraseñas, matrículas ni tokens.
 *  - **Monitor de red v2** (`netMonitorJs`): método + pathname + status +
 *    Content-Type + tamaño + estructura JSON de nivel superior (array/object,
 *    count, keys). Nunca headers de autenticación, cookies ni valores de
 *    checadas.
 *
 * Todos los scripts empiezan con `LIB_JS` (funciones compartidas bajo
 * `window.__LVD_BIO_LIB__`); se reinyecta en cada composición porque una
 * navegación de página completa puede limpiar los globals.
 */
object BiometricDiscovery {

    /** Tag de Logcat del volcado estructural y del reporte de descubrimiento. */
    const val DIAG_TAG = "LVD_BIO_DIAG"

    /** Tag de Logcat de la actividad de red correlacionada con la consulta. */
    const val NET_TAG = "LVD_BIO_NETWORK"

    /* ── Modelos del estado de descubrimiento (parsers puros) ────────────── */

    data class DiscoveryControlInfo(
        val kind: String?,
        val tag: String?,
        val id: String?,
        val formcontrolname: String?,
        val role: String?,
        val ariaLabel: String?,
        val label: String?,
        val evidence: String?,
    )

    data class DiscoverySampleInfo(
        val where: String?,
        val count: Int?,
        val visible: Int?,
    )

    data class DiscoveryStateInfo(
        val status: String,
        val runId: String?,
        val reason: String?,
        val periods: List<BiometricPeriod>,
        val control: DiscoveryControlInfo?,
        val optionsExistWhenClosed: Boolean?,
        val closedCount: Int?,
        val samples: List<DiscoverySampleInfo>,
    )

    data class DumpedControlInfo(
        val tag: String?,
        val id: String?,
        val name: String?,
        val role: String?,
        val formcontrolname: String?,
        val ariaLabel: String?,
        val label: String?,
        val placeholder: String?,
        val cls: String?,
        val text: String?,
        val value: String?,
        val visible: Boolean?,
        val enabled: Boolean?,
        val ariaDisabled: String?,
        val rect: String?,
        val children: Int?,
        val sensitive: Boolean?,
    )

    data class DumpReportInfo(
        val path: String?,
        val url: String?,
        val title: String?,
        val controls: List<DumpedControlInfo>,
    )

    /** Resultado detallado de `applyPeriodJs` (fase APPLY). */
    data class ApplyDetailInfo(
        val ok: Boolean?,
        val reason: String?,
        val controlFound: Boolean?,
        val overlayOpened: Boolean?,
        val optionCount: Int?,
        val optionFound: Boolean?,
        val clickPerformed: Boolean?,
        val overlayClosed: Boolean?,
        val ooadVerified: Boolean?,
        val ooadText: String?,
        val availableLabels: List<String>,
        val hitLabel: String? = null,
    )

    /** Inspección independiente del control tras aplicar (fase VERIFY). */
    data class VerifyDetailInfo(
        val found: Boolean?,
        val displayText: String?,
        val expectedMatch: Boolean?,
        val overlayOpen: Boolean?,
    )

    /** Resultado de `startOoadReadJs` (lectura de OOAD disponibles). */
    data class OoadReadInfo(
        val status: String,
        val runId: String?,
        val reason: String?,
        val ooads: List<BiometricOoad>,
        val control: DiscoveryControlInfo?,
    )

    /** Estado actual del control OOAD (`ooadStatusJs`). */
    data class OoadStatusInfo(
        val found: Boolean?,
        val displayText: String?,
        val isDefault: Boolean?,
        val overlayOpen: Boolean?,
    )

    /** Resultado de `startPeriodRefreshJs` (espera de repoblación del Periodo). */
    data class PeriodRefreshInfo(
        val status: String,
        val runId: String?,
        val reason: String?,
        val count: Int?,
        val controlFound: Boolean?,
        val loading: Boolean?,
    )

    /** Un control select/mat-select clasificado (`classifyControlsJs`). */
    data class ClassifiedControlInfo(
        val index: Int,
        val tag: String?,
        val label: String?,
        val formcontrolname: String?,
        val ariaLabel: String?,
        val placeholder: String?,
        val text: String?,
        val options: Int?,
    )

    /** Clasificación de TODOS los selectores del formulario (diagnóstico). */
    data class ClassifyReportInfo(
        val controls: List<ClassifiedControlInfo>,
        val ooadFound: Boolean,
        val ooadIndex: Int?,
        val ooadEvidence: String?,
        val periodFound: Boolean,
        val periodIndex: Int?,
        val periodEvidence: String?,
    )

    /** Botón visible del formulario (diagnóstico del botón Consultar). */
    data class ButtonInfo(
        val tag: String?,
        val id: String?,
        val type: String?,
        val text: String?,
        val disabled: Boolean?,
        val ariaDisabled: String?,
        val cls: String?,
        val rect: String?,
    )

    /** Conteos estructurales del snapshot de resultados. */
    data class SnapshotCountsInfo(
        val tables: Int?,
        val matTables: Int?,
        val rows: Int?,
        val matRows: Int?,
        val roleTables: Int?,
        val roleRows: Int?,
        val cards: Int?,
        val lists: Int?,
    )

    /** Entrada del monitor de red v2 (método+path+status+timestamps). */
    data class NetEntryInfo(
        val method: String?,
        val path: String?,
        val status: Int?,
        val startedAt: Long?,
        val endedAt: Long?,
        val durationMs: Long?,
    )

    /** Mutación DOM registrada por el monitor de actividad. */
    data class ActivityInfo(
        val t: Long?,
        val added: Int?,
        val removed: Int?,
    )

    /** Coincidencias del MutationObserver de resultados (OBSERVE_RESULTS). */
    data class ResultsObserverMatchInfo(
        val localizados: Boolean?,
        val tables: Int?,
        val rows: Int?,
        val matRows: Int?,
        val roleTables: Int?,
        val roleRows: Int?,
        val download: Boolean?,
        val share: Boolean?,
        val snippets: List<String>,
    )

    /** Estado del observer de resultados (working|stopped|error). */
    data class ResultsObserverInfo(
        val status: String,
        val runId: String?,
        val reason: String?,
        val matches: ResultsObserverMatchInfo?,
    )

    /** Evento de descarga observado (diagnóstico; SOLO DEBUG). */
    data class DownloadEventInfo(
        val kind: String?,
        val url: String?,
        val download: String?,
        val mime: String?,
    )

    /** Elemento del portal relacionado con descarga/compartir (FIND_DOWNLOAD). */
    data class DownloadHintInfo(
        val tag: String?,
        val id: String?,
        val href: String?,
        val role: String?,
        val hasOnclick: Boolean?,
        val download: String?,
        val text: String?,
    )

    /** Botones/links Descargar y Compartir encontrados (diagnóstico). */
    data class DownloadHintsInfo(
        val downloads: List<DownloadHintInfo>,
        val shares: List<DownloadHintInfo>,
    )

    /** Error JS del portal (sanitizado: mensaje + archivo + línea). */
    data class JsErrorInfo(
        val type: String?,
        val message: String?,
        val file: String?,
        val line: Int?,
        val column: Int?,
    )

    /* ── Parsers puros (testables sin WebView) ───────────────────────────── */

    fun parseDiscoveryState(raw: String?): DiscoveryStateInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val status = obj.optString("status")
        if (status.isEmpty() || status == "missing") return null

        val samples = mutableListOf<DiscoverySampleInfo>()
        val samplesArr = obj.optJSONArray("samples")
        if (samplesArr != null) {
            for (i in 0 until samplesArr.length()) {
                val s = samplesArr.optJSONObject(i) ?: continue
                samples += DiscoverySampleInfo(
                    where = s.optString("where", "").ifBlank { null },
                    count = if (s.has("count")) s.optInt("count") else null,
                    visible = if (s.has("visible")) s.optInt("visible") else null,
                )
            }
        }

        val closed = obj.optJSONObject("sampleClosed")
        val control = obj.optJSONObject("control")

        return DiscoveryStateInfo(
            status = status,
            runId = obj.optString("runId", "").ifBlank { null },
            reason = obj.optString("reason", "").ifBlank { null },
            periods = BiometricJson.parsePeriodArray(obj.optJSONArray("periods")),
            control = control?.let {
                DiscoveryControlInfo(
                    kind = it.optString("kind", "").ifBlank { null },
                    tag = it.optString("tag", "").ifBlank { null },
                    id = it.optString("id", "").ifBlank { null },
                    formcontrolname = it.optString("formcontrolname", "").ifBlank { null },
                    role = it.optString("role", "").ifBlank { null },
                    ariaLabel = it.optString("ariaLabel", "").ifBlank { null },
                    label = it.optString("label", "").ifBlank { null },
                    evidence = it.optString("evidence", "").ifBlank { null },
                )
            },
            optionsExistWhenClosed = if (closed != null && closed.has("exists")) closed.optBoolean("exists") else null,
            closedCount = if (closed != null && closed.has("count")) closed.optInt("count") else null,
            samples = samples,
        )
    }

    fun parseDump(raw: String?): DumpReportInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val controls = mutableListOf<DumpedControlInfo>()
        val arr = obj.optJSONArray("controls")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val c = arr.optJSONObject(i) ?: continue
                controls += DumpedControlInfo(
                    tag = c.optString("tag", "").ifBlank { null },
                    id = c.optString("id", "").ifBlank { null },
                    name = c.optString("name", "").ifBlank { null },
                    role = c.optString("role", "").ifBlank { null },
                    formcontrolname = c.optString("formcontrolname", "").ifBlank { null },
                    ariaLabel = c.optString("ariaLabel", "").ifBlank { null },
                    label = c.optString("label", "").ifBlank { null },
                    placeholder = c.optString("placeholder", "").ifBlank { null },
                    cls = c.optString("cls", "").ifBlank { null },
                    text = c.optString("text", "").ifBlank { null },
                    value = c.optString("value", "").ifBlank { null },
                    visible = if (c.has("visible")) c.optBoolean("visible") else null,
                    enabled = if (c.has("enabled")) c.optBoolean("enabled") else null,
                    ariaDisabled = c.optString("ariaDisabled", "").ifBlank { null },
                    rect = c.optString("rect", "").ifBlank { null },
                    children = if (c.has("children")) c.optInt("children") else null,
                    sensitive = if (c.has("sensitive")) c.optBoolean("sensitive") else null,
                )
            }
        }
        return DumpReportInfo(
            path = obj.optString("path", "").ifBlank { null },
            url = obj.optString("url", "").ifBlank { null },
            title = obj.optString("title", "").ifBlank { null },
            controls = controls,
        )
    }

    /** Estructura de contenedores de resultados (snapshot) → texto de log. */
    fun structureLog(raw: String?): String? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val arr = obj.optJSONArray("structure") ?: return null
        val parts = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val s = arr.optJSONObject(i) ?: continue
            parts += "${s.optString("kind")}(rows=${s.optInt("rows", -1)},headers=${s.optInt("headers", -1)})"
        }
        return parts.joinToString(" | ").ifEmpty { "sin contenedores visibles" }
    }

    fun parseApplyDetail(raw: String?): ApplyDetailInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val labels = mutableListOf<String>()
        val arr = obj.optJSONArray("availableLabels")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val l = arr.optString(i).trim()
                if (l.isNotEmpty()) labels += l
            }
        }
        return ApplyDetailInfo(
            ok = if (obj.has("ok")) obj.optBoolean("ok") else null,
            reason = obj.optString("reason", "").ifBlank { null },
            controlFound = if (obj.has("controlFound")) obj.optBoolean("controlFound") else null,
            overlayOpened = if (obj.has("overlayOpened")) obj.optBoolean("overlayOpened") else null,
            optionCount = if (obj.has("optionCount")) obj.optInt("optionCount") else null,
            optionFound = if (obj.has("optionFound")) obj.optBoolean("optionFound") else null,
            clickPerformed = if (obj.has("clickPerformed")) obj.optBoolean("clickPerformed") else null,
            overlayClosed = if (obj.has("overlayClosed")) obj.optBoolean("overlayClosed") else null,
            ooadVerified = if (obj.has("ooadVerified")) obj.optBoolean("ooadVerified") else null,
            ooadText = obj.optString("ooadText", "").ifBlank { null },
            availableLabels = labels,
            hitLabel = obj.optString("hitLabel", "").ifBlank { null },
        )
    }

    fun parseVerifyDetail(raw: String?): VerifyDetailInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        return VerifyDetailInfo(
            found = if (obj.has("found")) obj.optBoolean("found") else null,
            displayText = obj.optString("displayText", "").ifBlank { null },
            expectedMatch = if (obj.has("expectedMatch")) obj.optBoolean("expectedMatch") else null,
            overlayOpen = if (obj.has("overlayOpen")) obj.optBoolean("overlayOpen") else null,
        )
    }

    /** Parsea `{status, runId, reason, ooads:[{value,label}], control}` de la lectura de OOAD. */
    fun parseOoadRead(raw: String?): OoadReadInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val status = obj.optString("status")
        if (status.isEmpty() || status == "missing") return null

        val ooads = mutableListOf<BiometricOoad>()
        val arr = obj.optJSONArray("ooads")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val item = arr.optJSONObject(i) ?: continue
                val value = item.optString("value").trim()
                val label = item.optString("label").trim()
                if (value.isNotEmpty() && label.isNotEmpty()) ooads += BiometricOoad(value, label)
            }
        }

        val control = obj.optJSONObject("control")
        return OoadReadInfo(
            status = status,
            runId = obj.optString("runId", "").ifBlank { null },
            reason = obj.optString("reason", "").ifBlank { null },
            ooads = ooads,
            control = control?.let {
                DiscoveryControlInfo(
                    kind = it.optString("kind", "").ifBlank { null },
                    tag = it.optString("tag", "").ifBlank { null },
                    id = it.optString("id", "").ifBlank { null },
                    formcontrolname = it.optString("formcontrolname", "").ifBlank { null },
                    role = it.optString("role", "").ifBlank { null },
                    ariaLabel = it.optString("ariaLabel", "").ifBlank { null },
                    label = it.optString("label", "").ifBlank { null },
                    evidence = it.optString("evidence", "").ifBlank { null },
                )
            },
        )
    }

    /** Parsea `{found, displayText, isDefault, overlayOpen}` del estado OOAD actual. */
    fun parseOoadStatus(raw: String?): OoadStatusInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        return OoadStatusInfo(
            found = if (obj.has("found")) obj.optBoolean("found") else null,
            displayText = obj.optString("displayText", "").ifBlank { null },
            isDefault = if (obj.has("isDefault")) obj.optBoolean("isDefault") else null,
            overlayOpen = if (obj.has("overlayOpen")) obj.optBoolean("overlayOpen") else null,
        )
    }

    /** Parsea `{status, count, controlFound, loading, reason}` del refresh de Periodo. */
    fun parsePeriodRefresh(raw: String?): PeriodRefreshInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val status = obj.optString("status")
        if (status.isEmpty() || status == "missing") return null
        return PeriodRefreshInfo(
            status = status,
            runId = obj.optString("runId", "").ifBlank { null },
            reason = obj.optString("reason", "").ifBlank { null },
            count = if (obj.has("count")) obj.optInt("count") else null,
            controlFound = if (obj.has("controlFound")) obj.optBoolean("controlFound") else null,
            loading = if (obj.has("loading")) obj.optBoolean("loading") else null,
        )
    }

    /** Parsea la clasificación de selectores `{controls, ooad, period}`. */
    fun parseClassify(raw: String?): ClassifyReportInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val controls = mutableListOf<ClassifiedControlInfo>()
        val arr = obj.optJSONArray("controls")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val c = arr.optJSONObject(i) ?: continue
                controls += ClassifiedControlInfo(
                    index = c.optInt("index"),
                    tag = c.optString("tag", "").ifBlank { null },
                    label = c.optString("label", "").ifBlank { null },
                    formcontrolname = c.optString("formcontrolname", "").ifBlank { null },
                    ariaLabel = c.optString("ariaLabel", "").ifBlank { null },
                    placeholder = c.optString("placeholder", "").ifBlank { null },
                    text = c.optString("text", "").ifBlank { null },
                    options = if (c.has("options")) c.optInt("options") else null,
                )
            }
        }
        val ooad = obj.optJSONObject("ooad")
        val period = obj.optJSONObject("period")
        return ClassifyReportInfo(
            controls = controls,
            ooadFound = ooad?.optBoolean("found") == true,
            ooadIndex = if (ooad != null && ooad.has("index") && ooad.optInt("index", -1) >= 0) ooad.optInt("index") else null,
            ooadEvidence = ooad?.optString("evidence", "")?.ifBlank { null },
            periodFound = period?.optBoolean("found") == true,
            periodIndex = if (period != null && period.has("index") && period.optInt("index", -1) >= 0) period.optInt("index") else null,
            periodEvidence = period?.optString("evidence", "")?.ifBlank { null },
        )
    }

    fun parseButtons(raw: String?): List<ButtonInfo> {
        val arr = TarjetonDigitalJson.parseArray(raw) ?: return emptyList()
        val out = mutableListOf<ButtonInfo>()
        for (i in 0 until arr.length()) {
            val b = arr.optJSONObject(i) ?: continue
            out += ButtonInfo(
                tag = b.optString("tag", "").ifBlank { null },
                id = b.optString("id", "").ifBlank { null },
                type = b.optString("type", "").ifBlank { null },
                text = b.optString("text", "").ifBlank { null },
                disabled = if (b.has("disabled")) b.optBoolean("disabled") else null,
                ariaDisabled = b.optString("ariaDisabled", "").ifBlank { null },
                cls = b.optString("cls", "").ifBlank { null },
                rect = b.optString("rect", "").ifBlank { null },
            )
        }
        return out
    }

    fun parseSnapshotCounts(raw: String?): SnapshotCountsInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val c = obj.optJSONObject("counts") ?: return null
        return SnapshotCountsInfo(
            tables = if (c.has("tables")) c.optInt("tables") else null,
            matTables = if (c.has("matTables")) c.optInt("matTables") else null,
            rows = if (c.has("rows")) c.optInt("rows") else null,
            matRows = if (c.has("matRows")) c.optInt("matRows") else null,
            roleTables = if (c.has("roleTables")) c.optInt("roleTables") else null,
            roleRows = if (c.has("roleRows")) c.optInt("roleRows") else null,
            cards = if (c.has("cards")) c.optInt("cards") else null,
            lists = if (c.has("lists")) c.optInt("lists") else null,
        )
    }

    fun snapshotCountsLog(raw: String?): String? {
        val c = parseSnapshotCounts(raw) ?: return null
        return "tables=${c.tables ?: -1} matTables=${c.matTables ?: -1} rows=${c.rows ?: -1} " +
            "matRows=${c.matRows ?: -1} roleTables=${c.roleTables ?: -1} roleRows=${c.roleRows ?: -1} " +
            "cards=${c.cards ?: -1} lists=${c.lists ?: -1}"
    }

    fun parseNet(raw: String?): List<NetEntryInfo> {
        val arr = TarjetonDigitalJson.parseArray(raw) ?: return emptyList()
        val out = mutableListOf<NetEntryInfo>()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            out += NetEntryInfo(
                method = e.optString("m", "").ifBlank { null },
                path = e.optString("p", "").ifBlank { null },
                status = if (e.has("s")) e.optInt("s") else null,
                startedAt = if (e.has("st")) e.optLong("st") else null,
                endedAt = if (e.has("t")) e.optLong("t") else null,
                durationMs = if (e.has("d")) e.optLong("d") else null,
            )
        }
        return out
    }

    fun parseActivity(raw: String?): List<ActivityInfo> {
        val arr = TarjetonDigitalJson.parseArray(raw) ?: return emptyList()
        val out = mutableListOf<ActivityInfo>()
        for (i in 0 until arr.length()) {
            val a = arr.optJSONObject(i) ?: continue
            out += ActivityInfo(
                t = if (a.has("t")) a.optLong("t") else null,
                added = if (a.has("added")) a.optInt("added") else null,
                removed = if (a.has("removed")) a.optInt("removed") else null,
            )
        }
        return out
    }

    /** Parsea `{status, runId, reason, matches}` del observer de resultados. */
    fun parseResultsObserver(raw: String?): ResultsObserverInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        val status = obj.optString("status")
        if (status.isEmpty()) return null
        val m = obj.optJSONObject("matches")
        val snippets = mutableListOf<String>()
        val arr = m?.optJSONArray("snippets")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val s = arr.optString(i)
                if (s.isNotEmpty()) snippets += s
            }
        }
        return ResultsObserverInfo(
            status = status,
            runId = obj.optString("runId", "").ifBlank { null },
            reason = obj.optString("reason", "").ifBlank { null },
            matches = m?.let {
                ResultsObserverMatchInfo(
                    localizados = if (it.has("localizados")) it.optBoolean("localizados") else null,
                    tables = if (it.has("tables")) it.optInt("tables") else null,
                    rows = if (it.has("rows")) it.optInt("rows") else null,
                    matRows = if (it.has("matRows")) it.optInt("matRows") else null,
                    roleTables = if (it.has("roleTables")) it.optInt("roleTables") else null,
                    roleRows = if (it.has("roleRows")) it.optInt("roleRows") else null,
                    download = if (it.has("download")) it.optBoolean("download") else null,
                    share = if (it.has("share")) it.optBoolean("share") else null,
                    snippets = snippets.take(5),
                )
            },
        )
    }

    /** Parsea eventos de descarga observados (SOLO método/url sanitizada/mime). */
    fun parseDownloadEvents(raw: String?): List<DownloadEventInfo> {
        val arr = TarjetonDigitalJson.parseArray(raw) ?: return emptyList()
        val out = mutableListOf<DownloadEventInfo>()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            out += DownloadEventInfo(
                kind = e.optString("kind", "").ifBlank { null },
                url = e.optString("url", "").ifBlank { null },
                download = e.optString("download", "").ifBlank { null },
                mime = e.optString("mime", "").ifBlank { null },
            )
        }
        return out
    }

    /** Parsea los hints de Descargar/Compartir del DOM. */
    fun parseDownloadHints(raw: String?): DownloadHintsInfo? {
        val obj = TarjetonDigitalJson.parseObject(raw) ?: return null
        fun hints(key: String): List<DownloadHintInfo> {
            val out = mutableListOf<DownloadHintInfo>()
            val arr = obj.optJSONArray(key) ?: return out
            for (i in 0 until arr.length()) {
                val h = arr.optJSONObject(i) ?: continue
                out += DownloadHintInfo(
                    tag = h.optString("tag", "").ifBlank { null },
                    id = h.optString("id", "").ifBlank { null },
                    href = h.optString("href", "").ifBlank { null },
                    role = h.optString("role", "").ifBlank { null },
                    hasOnclick = if (h.has("hasOnclick")) h.optBoolean("hasOnclick") else null,
                    download = h.optString("download", "").ifBlank { null },
                    text = h.optString("text", "").ifBlank { null },
                )
            }
            return out
        }
        return DownloadHintsInfo(downloads = hints("downloads"), shares = hints("shares"))
    }

    /** Parsea errores JS sanitizados (message, file, line, colonna). */
    fun parseJsErrors(raw: String?): List<JsErrorInfo> {
        val arr = TarjetonDigitalJson.parseArray(raw) ?: return emptyList()
        val out = mutableListOf<JsErrorInfo>()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            out += JsErrorInfo(
                type = e.optString("type", "").ifBlank { null },
                message = e.optString("msg", "").ifBlank { null },
                file = e.optString("file", "").ifBlank { null },
                line = if (e.has("line")) e.optInt("line") else null,
                column = if (e.has("col")) e.optInt("col") else null,
            )
        }
        return out
    }

    /**
     * Línea de tiempo de la consulta (submit +0ms, XHR start, HTTP 200, DOM,
     * ROWS). `rowsAt` solo cuando el resultado terminal es una tabla.
     */
    fun buildTimeline(
        activities: List<ActivityInfo>,
        net: List<NetEntryInfo>,
        startedAt: Long,
        rowsAt: Long?,
    ): String {
        val parts = mutableListOf("submit+0ms")
        val xhrStart = net.filter { it.startedAt != null && it.startedAt >= startedAt }.minByOrNull { it.startedAt!! }
        if (xhrStart != null) parts += "XHR_START+${xhrStart.startedAt!! - startedAt}ms"
        val http200 = net.filter { it.status == 200 && it.endedAt != null && it.endedAt >= startedAt }.minByOrNull { it.endedAt!! }
        if (http200 != null) parts += "HTTP200+${http200.endedAt!! - startedAt}ms"
        val dom = activities.filter { it.t != null && it.t >= startedAt }.minByOrNull { it.t!! }
        if (dom != null) parts += "DOM+${dom.t!! - startedAt}ms"
        if (rowsAt != null) parts += "ROWS+${rowsAt - startedAt}ms"
        if (parts.size == 1) parts += "sin actividad observable"
        return parts.joinToString(" ")
    }

    /* ── JS: librería compartida (reinyectada en cada composición) ───────── */

    private const val LIB_JS = """(function(){
if(window.__LVD_BIO_LIB__)return;
function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2010-\u2015\u2013\u2014\u00AD]/g,'-').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim().toLowerCase()}
function vis(el){if(!el)return false;if(el.offsetParent===null&&el.getClientRects().length===0)return false;var r=el.getBoundingClientRect();return r.width>0&&r.height>0}
function txt(el){return (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function waitFor(fn,timeout,interval){return new Promise(function(resolve,reject){var t0=Date.now();(function poll(){var v;try{v=fn()}catch(e){v=null}if(v){resolve(v);return}if(Date.now()-t0>timeout){reject(new Error('TIMEOUT'));return}setTimeout(poll,interval)})()})}
function isPeriodLike(x){var a=n(String(x.getAttribute&&x.getAttribute('formcontrolname')||''));var t=n(String(x.innerText||x.textContent||x.getAttribute&&x.getAttribute('aria-label')||x.getAttribute&&x.getAttribute('placeholder')||''));return a.indexOf('periodo')>=0||a.indexOf('quincena')>=0||t.indexOf('periodo')>=0||t.indexOf('quincena')>=0}
function fieldLabel(x){var ff=x.closest?x.closest('mat-form-field'):null;if(!ff)return '';var l=ff.querySelector('mat-label,label');return l?txt(l):''}
function findPeriodControl(){
  var mats=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));
  // VALIDADO contra el portal real: el de OOAD es "Selecciona un OOAD" (isOoadLike=true),
  // el de Periodo es "Selecciona un período" (isPeriodLike=true). Nunca confundirlos.
  if(mats.length===2){
    var a=isPeriodLike(mats[0])&&!isOoadLike(mats[0]);
    var b=isPeriodLike(mats[1])&&!isOoadLike(mats[1]);
    if(b&&!a) return {kind:'mat',el:mats[1],evidence:'is-period-by-text',label:fieldLabel(mats[1])};
    if(a&&!b) return {kind:'mat',el:mats[0],evidence:'is-period-by-text',label:fieldLabel(mats[0])};
    // Si ninguno se marcó como periodo pero hay uno NO-ooad, ese es el de Periodo
    var na=!isOoadLike(mats[0]), nb=!isOoadLike(mats[1]);
    if(nb&&!na) return {kind:'mat',el:mats[1],evidence:'not-ooad',label:fieldLabel(mats[1])};
    if(na&&!nb) return {kind:'mat',el:mats[0],evidence:'not-ooad',label:fieldLabel(mats[0])};
    if(na&&nb) return {kind:'mat',el:mats[1],evidence:'neither-ooad-second',label:fieldLabel(mats[1])};
  }
  // 1 control o más de 2: por texto o exclusión
  for(var i=0;i<mats.length;i++){
    var tx=n(txt(mats[i])); var lb=n(fieldLabel(mats[i]));
    if((tx.indexOf('periodo')>=0||lb.indexOf('periodo')>=0)&&!isOoadLike(mats[i])) return {kind:'mat',el:mats[i],evidence:'text-periodo',label:fieldLabel(mats[i])};
  }
  for(var i=0;i<mats.length;i++){ if(!isOoadLike(mats[i])) return {kind:'mat',el:mats[i],evidence:'only-non-ooad',label:fieldLabel(mats[i])}; }
  var sel=document.querySelector('select');
  return sel?{kind:'native',el:sel,evidence:'only-native',label:''}:null;
}
function collectOptions(c){
  var out=[];
  if(c.kind==='mat'){
    var root=document.querySelector('.cdk-overlay-container');
    var opts=root?Array.from(root.querySelectorAll('mat-option[role="option"]')):[];
    if(opts.length===0)opts=Array.from(document.querySelectorAll('mat-option[role="option"]'));
    out=opts.map(function(o){var t=txt(o);var v=o.value;var vs=v===undefined||v===null?'':String(v);var isObj=vs.toLowerCase().indexOf('object')>=0;var value=(vs.trim()===''||isObj)?t:vs;return{value:value,label:t}}).filter(function(x){return x.label.length>0});
  }else{
    out=Array.from(c.el.options||[]).map(function(o){return{value:String(o.value||''),label:String(o.textContent||o.text).replace(/\s+/g,' ').trim()}}).filter(function(x){return x.label.length>0});
  }
  return out;
}
function countOptions(c){
  if(!c)return 0;
  if(c.kind==='mat'){
    var root=document.querySelector('.cdk-overlay-container');
    var opts=root?Array.from(root.querySelectorAll('mat-option[role="option"]')):[];
    if(opts.length===0)opts=Array.from(document.querySelectorAll('mat-option[role="option"]'));
    return opts.length;
  }
  return (c.el.options||[]).length;
}
function sampleOverlay(c){
  if(c.kind==='native'){var nOpts=(c.el.options||[]).length;return{where:'inside-select',count:nOpts,visible:nOpts}}
  var root=document.querySelector('.cdk-overlay-container');
  var pane=!!document.querySelector('.cdk-overlay-pane');
  if(root){
    var opts=Array.from(root.querySelectorAll('mat-option[role="option"]'));
    if(opts.length>0)return{where:'cdk-overlay-container',count:opts.length,visible:opts.filter(vis).length,pane:pane};
  }
  var inDoc=document.querySelector('mat-option[role="option"]');
  if(inDoc)return{where:'in-document',count:document.querySelectorAll('mat-option[role="option"]').length,visible:0,pane:pane};
  return{where:'none',count:0,visible:0,pane:pane};
}
function esc(){try{var e=new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true});document.dispatchEvent(e)}catch(e){}}
function isOoadLike(x){
  var a=n(String(x.getAttribute&&x.getAttribute('formcontrolname')||''));
  var f=n(x.getAttribute&&x.getAttribute('aria-label')||'')+' '+n(x.getAttribute&&x.getAttribute('placeholder')||'')+' '+n(String(x.innerText||x.textContent||''));
  var hay=a+' '+f+' '+n(fieldLabel(x));
  return hay.indexOf('ooad')>=0||hay.indexOf('delegacion')>=0||hay.indexOf('regional')>=0||hay.indexOf('unidad medica')>=0||hay.indexOf('oficina de operacion')>=0;
}
function findOoadControl(){
  var mats=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));
  var best=null;var bestScore=-999;
  for(var i=0;i<mats.length;i++){
    var m=mats[i];var lbl=fieldLabel(m);var lb=n(lbl);var score=0;
    if(isOoadLike(m))score+=4;
    if(lb&&(lb.indexOf('ooad')>=0||lb.indexOf('delegacion')>=0||lb.indexOf('regional')>=0))score+=2;
    if(!isPeriodLike(m)&&!(lb.indexOf('periodo')>=0||lb.indexOf('quincena')>=0))score+=1;
    if(vis(m))score+=1;
    if(score>bestScore){bestScore=score;best={kind:'mat',el:m,evidence:score>=4?'text':(score>=2?'label':(score>0?'exclusion':'position')),label:lbl}}
  }
  if(best&&bestScore>=1)return best;
  var sels=Array.from(document.querySelectorAll('select'));
  var sel=sels.find(function(s){var t=n(String(s.getAttribute&&s.getAttribute('formcontrolname')||'')+' '+fieldLabel(s));return t.indexOf('ooad')>=0||t.indexOf('delegacion')>=0||t.indexOf('regional')>=0})||null;
  if(!sel)sel=sels.find(function(s){return !isPeriodLike(s)})||null;
  return sel?{kind:'native',el:sel,evidence:'only-native',label:''}:null;
}
async function openAndPick(c,targetLabel,targetValue){
  var out={optionFound:false,clickPerformed:false,overlayClosed:false,overlayOpened:false,optionCount:0,availableLabels:[],maxOptions:0,hitLabel:''};
  if(c.kind==='native'){
    var opts=Array.from(c.el.options||[]);
    out.availableLabels=opts.map(function(o){return String(o.textContent||o.text||'').replace(/\s+/g,' ').trim()}).filter(function(t){return t.length>0});
    out.maxOptions=opts.length;out.optionCount=opts.length;
    var target=opts.find(function(o){
      var ot=n(String(o.textContent||o.text||'')),ov=n(String(o.value||'')),ntv=n(targetValue),ntl=n(targetLabel);
      if(ov===ntv||ot===ntl||ot===ntv||ov===ntl)return true;
      if(ntv&&ov.indexOf(ntv)>=0)return true;
      if(ntl&&ot.indexOf(ntl)>=0)return true;
      if(ntv&&ot.indexOf(ntv)>=0)return true;
      if(ntl&&ov.indexOf(ntl)>=0)return true;
      var code=(ntl.match(/\b\d{6,7}\b/)||ntv.match(/\b\d{6,7}\b/)||[])[0];
      if(code&&(ot.indexOf(code)>=0||ov.indexOf(code)>=0))return true;
      return false});

    if(target){
      out.optionFound=true;
      var d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
      if(d&&d.set){d.set.call(c.el,target.value)}else{c.el.value=target.value}
      out.clickPerformed=true;
      c.el.dispatchEvent(new Event('change',{bubbles:true}));
      c.el.dispatchEvent(new Event('input',{bubbles:true,inputType:'select-one'}));
      c.el.dispatchEvent(new Event('blur',{bubbles:true}));
      await sleep(300);
      if(String(c.el.value||'')!==String(target.value||'')){out.optionFound=false;out.clickPerformed=false}
    }
    return out;
  }
  var triedAlt=false;
  for(var attempt=0;attempt<3&&!out.optionFound;attempt++){
    // Si la vez anterior abrió OOAD por error, cambia al otro mat-select
    if(triedAlt&&attempt===1){
      var allMatsAlt=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));
      var otherAlt=allMatsAlt.find(function(x){return x!==c.el});
      if(otherAlt){ c={kind:'mat',el:otherAlt,evidence:'fallback-other-ooad',label:fieldLabel(otherAlt)}; }
    }
    var trigger=c.el.querySelector('.mat-select-trigger')||c.el;
    try{c.el.scrollIntoView({behavior:'auto',block:'center'})}catch(e){}
    trigger.click();
    var anyAfterClick=function(){var o=Array.from(document.querySelectorAll('.cdk-overlay-pane'));return o.length>0};
    if(!out.overlayOpened)out.overlayOpened=anyAfterClick();
    try{
      var hit=await (async function(){
        var deadline=Date.now()+4500;
        var lastCount=0;
        while(Date.now()<deadline){
          var o=Array.from(document.querySelectorAll('.cdk-overlay-container mat-option[role="option"], mat-option[role="option"]'));
          if(o.length===0&&document.querySelector('.cdk-overlay-pane')){out.overlayOpened=true;await sleep(150);continue}
          if(o.length===0){await sleep(150);continue}
          out.overlayOpened=true;
          for(var i=0;i<o.length;i++){
            var x=o[i];var ot=n(txt(x)),ntl=n(targetLabel),ntv=n(targetValue);
            // DUAL (validado en portal real): el label de un PERIODO contiene un código 6-7
            // dígitos (2025001); el de una DELEGACIÓN/OOAD no (Michoacán) pero el VALUE es
            // un código corto (17). Nunca confundir: match por código de periodo cuando existe,
            // si no, match por value/label de la OOAD.
            var periodCode=ntl.match(/\b\d{6,7}\b/)?ntl.match(/\b\d{6,7}\b/)[0]:'';
            if(periodCode){
              if(ot.indexOf(periodCode)>=0)return x;
              continue; // es un periodo: solo vale el código, no "Michoacán" ni otros
            }
            // Caso OOAD/delegación: match por value (17) o label (michoacan)
            if(ntv&&ot.indexOf(ntv)>=0)return x;
            if(ntl&&ot===ntl)return x;
            if(ntl&&ntl.length>=4&&ot.indexOf(ntl)>=0)return x;
          }
          // No encontrado -> intenta scroll incremental (virtual scroll) hasta cargar más opciones
          var scroller=document.querySelector('.cdk-overlay-pane .mat-mdc-select-panel')||document.querySelector('.cdk-overlay-pane .mat-select-panel')||document.querySelector('.cdk-overlay-pane');
          // Si el panel no es el scrolleable, busca el ancestro scrolleable de la primera opción
          if(o.length>0){
            var probe=o[0].parentElement;
            while(probe&&probe!==document.body){
              if(probe.scrollHeight>probe.clientHeight+5){scroller=probe;break}
              probe=probe.parentElement;
            }
          }
          if(scroller&&scroller.scrollHeight>scroller.clientHeight+5){
            var atBottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-4;
            if(!atBottom){
              try{
                // Salta directo al fondo para forzar carga de los periodos más antiguos (virtual scroll)
                scroller.scrollTop=scroller.scrollHeight;
                try{o[o.length-1].scrollIntoView({block:'end'})}catch(e){}
                // También prueba scroll incremental por si el contenedor es otro
                var alt=document.querySelector('.cdk-overlay-container');
                if(alt&&alt.scrollHeight>alt.clientHeight) alt.scrollTop=alt.scrollHeight;
              }catch(e){}
              await sleep(500);
              // No salgas aunque el conteo no cambie (virtual scroll recicla nodos)
              lastCount=o.length;
              continue;
            }
          } else if(o.length>0){
            // No es scrolleable pero aún no se encontró -> intenta scrollIntoView del último
            try{o[o.length-1].scrollIntoView({block:'end'})}catch(e){}
            await sleep(300);
            // Si sigue sin aparecer, es realmente no encontrado
            var o2=Array.from(document.querySelectorAll('.cdk-overlay-container mat-option[role="option"], mat-option[role="option"]'));
            if(o2.length===o.length) return 'no-match';
            continue;
          }
          if(o.length>0)return 'no-match';
          await sleep(150);
        }
        return null;
      })().catch(function(){return null});
      if(hit&&hit!=='no-match'){
        out.optionFound=true;
        out.hitLabel=txt(hit);
        try{ hit.scrollIntoView({block:'center', inline:'nearest'}); }catch(e){}
        await sleep(120);
        // VALIDADO contra el portal: un solo element.click() cierra el overlay y aplica la selección.
        hit.click();
        out.clickPerformed=true;
        // Espera a que el overlay se cierre y Angular actualice el displayText
        var t0=Date.now();
        while(Date.now()-t0<1500){
          await sleep(150);
          if(!document.querySelector('.cdk-overlay-pane')) break;
        }
        out.overlayClosed=!document.querySelector('.cdk-overlay-pane');
        if(!out.overlayClosed){ try{ L.esc(); await sleep(400); out.overlayClosed=!document.querySelector('.cdk-overlay-pane'); }catch(e){} }
      }
    }catch(e){}
    // Registra los labels visibles del overlay actual (periodos u OOAD), sin filtrar por código
    var any=Array.from(document.querySelectorAll('.cdk-overlay-container mat-option[role="option"], mat-option[role="option"]'));
    var visibleLabels=any.map(function(x){return txt(x)}).filter(function(t){return t.length>0});
    if(visibleLabels.length>0){
      out.availableLabels=out.availableLabels.concat(visibleLabels);
      out.optionCount=Math.max(out.optionCount,any.length);
      out.maxOptions=Math.max(out.maxOptions,any.length);
    }
    if(!out.optionFound && visibleLabels.length>0 && !triedAlt){
      // Si el objetivo era un periodo (tiene código) y en el overlay NO aparece ese código,
      // significa que se abrió el control equivocado -> reintenta con el otro mat-select.
      var targetCode=(n(targetLabel).match(/\b\d{6,7}\b/)||[])[0];
      if(targetCode){
        var foundTarget=visibleLabels.some(function(l){ return n(l).indexOf(targetCode)>=0; });
        if(!foundTarget){ triedAlt=true; esc(); await sleep(350); continue; }
      }
    }
    if(!out.optionFound){esc();await sleep(350);}
  }
  out.availableLabels=out.availableLabels.filter(function(t,i,a){return a.indexOf(t)===i});
  return out;
}
window.__LVD_BIO_LIB__={n:n,vis:vis,txt:txt,sleep:sleep,waitFor:waitFor,isPeriodLike:isPeriodLike,fieldLabel:fieldLabel,findPeriodControl:findPeriodControl,collectOptions:collectOptions,countOptions:countOptions,sampleOverlay:sampleOverlay,esc:esc,isOoadLike:isOoadLike,findOoadControl:findOoadControl,openAndPick:openAndPick};
})();"""

    /* ── JS: DOM listo (sigue siendo el gate de arranque) ────────────────── */

    fun domReadyJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var ms=document.querySelector('mat-select[role="combobox"]');
var sel=document.querySelector('select');
var tbl=document.querySelector('mat-table,table');
var btn=false;var btns=document.querySelectorAll('button');for(var i=0;i<btns.length;i++){if(L.vis(btns[i])){btn=true;break}}
return JSON.stringify({ready:!!(ms||sel||tbl||btn),path:location.pathname});
})()"""

    /* ── JS: START de descubrimiento de periodos (UNA vez por intento) ───── */

    fun startDiscoveryJs(runId: String): String = LIB_JS +
        "(function(){var RUN_ID=" + JSONObject.quote(runId) + ";" + START_DISCOVERY_TAIL + "})()"

    private const val START_DISCOVERY_TAIL = """
if(window.__LVD_BIO_DISCOVERY__&&window.__LVD_BIO_DISCOVERY__.runId===RUN_ID)return;
var L=window.__LVD_BIO_LIB__;
var state={status:"working",runId:RUN_ID,startedAt:Date.now()};
window.__LVD_BIO_DISCOVERY__=state;
function orphaned(){return !(window.__LVD_BIO_DISCOVERY__&&window.__LVD_BIO_DISCOVERY__.runId===RUN_ID)}
function commit(patch){if(orphaned())return;for(var k in patch){if(Object.prototype.hasOwnProperty.call(patch,k))window.__LVD_BIO_DISCOVERY__[k]=patch[k]}}
(async function(){
 var observer=null;
 try{
  var c=await L.waitFor(function(){return L.findPeriodControl()},5000,200);
  if(!c)throw new Error('PERIOD_CONTROL_NOT_FOUND');
  if(orphaned())return;
  commit({control:{kind:c.kind,tag:c.el.tagName.toLowerCase(),id:c.el.id||'',formcontrolname:c.el.getAttribute&&c.el.getAttribute('formcontrolname')||'',role:c.el.getAttribute&&c.el.getAttribute('role')||'',ariaLabel:c.el.getAttribute&&c.el.getAttribute('aria-label')||'',label:c.label||L.txt(c.el),evidence:c.evidence||''}});
  var closed=L.sampleOverlay(c);
  commit({sampleClosed:{count:closed.count,exists:closed.count>0},samples:[]});
  var obsRoot=document.querySelector('.cdk-overlay-container')||document.body;
  observer=new MutationObserver(function(){if(!orphaned()){window.__LVD_BIO_DISCOVERY__.samples.push(L.sampleOverlay(c))}});
  observer.observe(obsRoot,{childList:true,subtree:true});
  if(c.kind==='mat'){
    var trigger=c.el.querySelector('.mat-select-trigger')||c.el;
    c.el.scrollIntoView({behavior:'auto',block:'center'});await L.sleep(120);
    if(orphaned())return;
    trigger.click();
    if(!orphaned())window.__LVD_BIO_DISCOVERY__.samples.push(L.sampleOverlay(c));
    await L.sleep(250);
    if(!orphaned())window.__LVD_BIO_DISCOVERY__.samples.push(L.sampleOverlay(c));
    await L.sleep(500);
    if(!orphaned())window.__LVD_BIO_DISCOVERY__.samples.push(L.sampleOverlay(c));
  }else{
    if(!orphaned())window.__LVD_BIO_DISCOVERY__.samples.push(L.sampleOverlay(c));
  }
  var periods=await L.waitFor(function(){var o=L.collectOptions(c);return o.length>0?o:null},7000,150);
  if(orphaned())return;
  if(!periods||periods.length===0)throw new Error('NO_PERIOD_OPTIONS');
  commit({periods:periods});
  commit({status:"success"});
 }catch(e){
  if(!orphaned())commit({status:"error",reason:String(e&&e.message||e)});
 }finally{
  if(observer)observer.disconnect();
 }
})();
"""

    /* ── JS: POLL del estado (SOLO lee, nunca reinicia el trabajo) ───────── */

    fun readDiscoveryStateJs(): String = """(function(){
var s=window.__LVD_BIO_DISCOVERY__;
if(!s)return JSON.stringify({status:"missing"});
return JSON.stringify({status:s.status,runId:s.runId,reason:s.reason,startedAt:s.startedAt,periods:s.periods,control:s.control,sampleClosed:s.sampleClosed,samples:s.samples});
})()"""

    /** Cierra el overlay del mat-select (entre ciclos de verificación). */
    fun closeOverlayJs(): String = """(function(){
try{var esc=new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true});document.dispatchEvent(esc)}catch(e){}
return JSON.stringify({ok:true});
})()"""

    /* ── JS: etapas de preparación (ROUTE/FORM/PERIOD_CONTROL/PERIOD_DATA) ── */

    fun readinessJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var routeReady=location.pathname.indexOf('/biometric/consult-period')>=0;
var spinner=document.querySelector('mat-spinner,.mat-spinner,mat-progress-spinner,.loading,.spinner');
var loading=!!(spinner&&L.vis(spinner));
var formEls=document.querySelectorAll('mat-form-field,form,input,select,mat-select,button');
var formReady=false;
for(var i=0;i<formEls.length;i++){if(L.vis(formEls[i])){formReady=true;break}}
var c=L.findPeriodControl();
var periodControlReady=!!c;
var periodDataReady=periodControlReady&&L.countOptions(c)>0;
return JSON.stringify({routeReady:routeReady,formReady:formReady,periodControlReady:periodControlReady,periodDataReady:periodDataReady,loading:loading});
})()"""

    /* ── JS: volcado estructural sanitizado de TODOS los controles ────────── */

    fun dumpJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
function rect(el){try{var r=el.getBoundingClientRect();return Math.round(r.top)+','+Math.round(r.width)+'x'+Math.round(r.height)}catch(e){return null}}
function cls(el){var c='';try{c=String(el.className||'')}catch(e){c=''}return c.length>120?c.slice(0,120):c}
function isSensitiveInput(el){
  var t=el.tagName?el.tagName.toLowerCase():'';
  if(t==='input'&&el.type==='password')return true;
  var idn=L.n(String(el.id||'')+' '+String(el.name||'')+' '+String(el.getAttribute&&el.getAttribute('formcontrolname')||''));
  return idn.indexOf('matricula')>=0||idn.indexOf('password')>=0||idn.indexOf('contrasena')>=0||idn.indexOf('curp')>=0||idn.indexOf('nss')>=0||idn.indexOf('rfc')>=0||idn.indexOf('cuenta')>=0||idn.indexOf('account')>=0||idn.indexOf('usuario')>=0||idn.indexOf('user')>=0;
}
var out={path:location.pathname,url:String(location.href||'').slice(0,300),title:String(document.title||'').slice(0,80),controls:[]};
var sels=['select','option','mat-select','mat-option','[role="combobox"]','[role="listbox"]','[role="option"]','mat-form-field','input','textarea','button','mat-table','table','th','mat-header-cell','mat-list'];
var nodes=Array.from(document.querySelectorAll(sels.join(',')));
if(nodes.length>500)nodes=nodes.slice(0,500);
for(var i=0;i<nodes.length;i++){
  var el=nodes[i];
  var tag=el.tagName?el.tagName.toLowerCase():'';
  var sensitive=isSensitiveInput(el);
  var text=L.txt(el);if(text.length>80)text=text.slice(0,80);
  var entry={tag:tag,id:el.id||'',name:el.name||'',role:el.getAttribute&&el.getAttribute('role')||'',formcontrolname:el.getAttribute&&el.getAttribute('formcontrolname')||'',ariaLabel:el.getAttribute&&el.getAttribute('aria-label')||'',label:L.fieldLabel(el),placeholder:el.getAttribute&&el.getAttribute('placeholder')||'',cls:cls(el),text:text,visible:L.vis(el),enabled:!el.disabled,ariaDisabled:el.getAttribute&&el.getAttribute('aria-disabled')||'',rect:rect(el),children:el.querySelectorAll?el.querySelectorAll('mat-option,option').length:0};
  if(!sensitive&&(tag==='option'||tag==='mat-option')){var v=el.value;entry.value=(v===undefined||v===null)?'':String(v).slice(0,60)}
  if(sensitive)entry.sensitive=true;
  out.controls.push(entry);
}
return JSON.stringify(out);
})()"""

    /* ── JS: monitor de red v2 (estructura JSON sanitizada, sin credenciales) ─ */

    fun netMonitorJs(): String = """(function(){
if(window.__LVD_BIO_NET_V2_HOOKED__)return;
window.__LVD_BIO_NET_V2_HOOKED__=true;
window.__LVD_BIO_NET_V2__=[];
function summarizeBody(text){
  if(typeof text!=='string')return null;
  var t=text.trim();
  if(!t)return null;
  if(t.length>200000)return{textLen:text.length};
  var obj=null;try{obj=JSON.parse(t)}catch(e){return{textLen:text.length}}
  if(Array.isArray(obj)){var keys=[];if(obj.length>0&&obj[0]&&typeof obj[0]==='object'&&obj[0]!==null&&!Array.isArray(obj[0]))keys=Object.keys(obj[0]).slice(0,10);return{json:'array',count:obj.length,keys:keys}}
  if(obj&&typeof obj==='object')return{json:'object',keys:Object.keys(obj).slice(0,10)}
  return{json:'scalar'};
}
function push(ent){var a=window.__LVD_BIO_NET_V2__;a.push(ent);if(a.length>40)a.shift();}
function normUrl(u){var p=String(u||'');try{p=new URL(p).pathname}catch(e){}return p.length>300?p.slice(0,300):p;}
var ox=window.XMLHttpRequest.prototype.open;
var os=window.XMLHttpRequest.prototype.send;
window.XMLHttpRequest.prototype.open=function(m,u){try{this.__lvd={m:String(m||''),u:u,st:Date.now()}}catch(e){}return ox.apply(this,arguments)};
window.XMLHttpRequest.prototype.send=function(body){
  var self=this;
  try{self.__lvd.st=Date.now()}catch(e){}
  try{
    this.addEventListener('load',function(){
      try{
        var now=Date.now();
        var ct='';try{ct=self.getResponseHeader&&self.getResponseHeader('content-type')||''}catch(e){}
        var txt=self.responseText;
        var shape=/json|text/i.test(ct)&&typeof txt==='string'?summarizeBody(txt):null;
        var sz=(typeof txt==='string')?txt.length:(self.response?String(self.response).length:null);
        var st=self.__lvd&&self.__lvd.st;
        push({m:self.__lvd&&self.__lvd.m||'',p:normUrl(self.responseURL||self.__lvd&&self.__lvd.u||''),s:self.status,ct:String(ct||'').slice(0,80),sz:sz,shape:shape,st:st,t:now,d:st?now-st:null});
      }catch(e){}
    });
  }catch(e){}
  return os.apply(this,arguments);
};
var of=window.fetch;
window.fetch=function(u,o){
  var st=Date.now();
  try{
    return of.apply(this,arguments).then(function(r){
      try{
        var now=Date.now();
        var ct=r.headers&&r.headers.get('content-type')||'';
        if(/json|text/i.test(ct)){
          var r2=r.clone();
          return r2.text().then(function(t){push({m:(o&&o.method)||'GET',p:normUrl(r.url||u),s:r.status,ct:String(ct||'').slice(0,80),sz:t.length,shape:summarizeBody(t),st:st,t:now,d:now-st});return r}).catch(function(){return r});
        }
        push({m:(o&&o.method)||'GET',p:normUrl(r.url||u),s:r.status,ct:String(ct||'').slice(0,80),sz:null,shape:null,st:st,t:now,d:now-st});
      }catch(e){}
      return r;
    });
  }catch(e){return of.apply(this,arguments)}
};
})()"""

    /** Lee las entradas del monitor de red (solo lectura). */
    fun readNetJs(): String = """(function(){return JSON.stringify(window.__LVD_BIO_NET_V2__||[])})()"""

    /* ── JS: monitor de actividad del DOM (mutaciones tras el submit) ─────── */

    fun activityMonitorJs(): String = """(function(){
if(window.__LVD_BIO_ACT_HOOKED__)return;
window.__LVD_BIO_ACT_HOOKED__=true;
window.__LVD_BIO_ACTIVITY__=[];
var obs=new MutationObserver(function(muts){
  var added=0;var removed=0;
  for(var i=0;i<muts.length;i++){added+=muts[i].addedNodes.length;removed+=muts[i].removedNodes.length}
  var a=window.__LVD_BIO_ACTIVITY__;
  a.push({t:Date.now(),added:added,removed:removed});
  if(a.length>80)a.shift();
});
obs.observe(document.body,{childList:true,subtree:true});
})()"""

    /** Lee las mutaciones registradas (solo lectura). */
    fun readActivityJs(): String = """(function(){return JSON.stringify(window.__LVD_BIO_ACTIVITY__||[])})()"""

    /* ── JS: aplicar periodo (start-una-vez/poll-resultado, con detalle) ──── */

    /**
     * Aplica el periodo al control REAL. REQUISITO: la OOAD actual debe ser la
     * preferida (17 — Michoacán); si no, devuelve `WRONG_OOAD` para que el
     * controlador vuelva a `ApplyingOoad` (nunca se selecciona un periodo
     * sobre un formulario con otra delegación). Tras cambiar OOAD, Angular
     * puede reconstruir el mat-select de Periodo: este script SIEMPRE vuelve
     * a localizar el control (no conserva referencias viejas). En el fallo de
     * opción incluye `availableLabels` (labels de quincenas, no sensibles)
     * para diagnosticar `PERIOD_OPTION_NOT_FOUND`.
     */
    fun applyPeriodJs(label: String, value: String, ooadValue: String, ooadLabel: String): String = LIB_JS +
        "(function(){var TARGET_LABEL=" + JSONObject.quote(label) +
        ";var TARGET_VALUE=" + JSONObject.quote(value) +
        ";var OOAD_VALUE=" + JSONObject.quote(ooadValue) +
        ";var OOAD_LABEL=" + JSONObject.quote(ooadLabel) + ";" + APPLY_TAIL + "})()"

    private const val APPLY_TAIL = """
if(window.__LVD_BIO_APPLY_RUNNING__)return;
window.__LVD_BIO_APPLY_RUNNING__=true;window.__LVD_BIO_APPLY_RESULT__=null;
var L=window.__LVD_BIO_LIB__;
var flags={controlFound:false,overlayOpened:false,optionCount:0,optionFound:false,clickPerformed:false,overlayClosed:false,ooadVerified:false,ooadText:'',availableLabels:[],hitLabel:''};
(async function(){
try{
  var ooad=L.findOoadControl();
  var ooadDisplay='';
  if(ooad){ooadDisplay=ooad.kind==='mat'?L.txt(ooad.el):((ooad.el.options&&ooad.el.options[ooad.el.selectedIndex])?String(ooad.el.options[ooad.el.selectedIndex].textContent||''):String(ooad.el.value||''))}
  flags.ooadText=ooadDisplay;
  var oTxt=L.n(ooadDisplay);
  flags.ooadVerified=oTxt.indexOf(L.n(OOAD_LABEL))>=0||(L.n(OOAD_VALUE).length>=2&&oTxt.indexOf(L.n(OOAD_VALUE))>=0);
  if(!flags.ooadVerified)throw new Error('WRONG_OOAD');
  var c=await L.waitFor(function(){return L.findPeriodControl()},6000,200);
  if(!c)throw new Error('PERIOD_CONTROL_NOT_FOUND');
  flags.controlFound=true;
  var pick=await L.openAndPick(c,TARGET_LABEL,TARGET_VALUE);
  flags.optionFound=pick.optionFound;flags.clickPerformed=pick.clickPerformed;flags.overlayClosed=pick.overlayClosed;flags.overlayOpened=pick.overlayOpened;flags.optionCount=pick.optionCount;flags.availableLabels=pick.availableLabels;flags.hitLabel=pick.hitLabel||'';
  if(!pick.optionFound)throw new Error(pick.maxOptions===0?'PERIOD_OPTIONS_EMPTY':'PERIOD_OPTION_NOT_FOUND');
  window.__LVD_BIO_APPLY_RESULT__={ok:true,reason:'',controlFound:flags.controlFound,overlayOpened:flags.overlayOpened,optionCount:flags.optionCount,optionFound:flags.optionFound,clickPerformed:flags.clickPerformed,overlayClosed:flags.overlayClosed,ooadVerified:flags.ooadVerified,ooadText:flags.ooadText.slice(0,60),availableLabels:flags.availableLabels,hitLabel:flags.hitLabel.slice(0,80)};
}catch(e){
  window.__LVD_BIO_APPLY_RESULT__={ok:false,reason:String(e&&e.message||e),controlFound:flags.controlFound,overlayOpened:flags.overlayOpened,optionCount:flags.optionCount,optionFound:flags.optionFound,clickPerformed:flags.clickPerformed,overlayClosed:flags.overlayClosed,ooadVerified:flags.ooadVerified,ooadText:flags.ooadText.slice(0,60),availableLabels:flags.availableLabels,hitLabel:flags.hitLabel||''};
}
finally{window.__LVD_BIO_APPLY_RUNNING__=false}
})();
"""

    /* ── JS: VERIFICAR el periodo aplicado (inspección independiente) ─────── */

    fun verifyPeriodJs(label: String, value: String): String = LIB_JS +
        "(function(){var TARGET_LABEL=" + JSONObject.quote(label) +
        ";var TARGET_VALUE=" + JSONObject.quote(value) + ";" + VERIFY_TAIL + "})()"

    private const val VERIFY_TAIL = """
var L=window.__LVD_BIO_LIB__;
var c=L.findPeriodControl();
if(!c)return JSON.stringify({found:false,displayText:'',expectedMatch:false,overlayOpen:false});
var overlayOpen=!!document.querySelector('.cdk-overlay-pane');
var displayText='';
if(c.kind==='mat'){displayText=L.txt(c.el)}
else{var idx=c.el.selectedIndex;var o=c.el.options&&c.el.options[idx];displayText=o?String(o.textContent||o.text||''):String(c.el.value||'')}
var t=L.n(displayText);
var expectedMatch=t.indexOf(L.n(TARGET_LABEL))>=0||t.indexOf(L.n(TARGET_VALUE))>=0;
return JSON.stringify({found:true,displayText:displayText.slice(0,80),expectedMatch:expectedMatch,overlayOpen:overlayOpen});
"""

    /* ── JS: OOAD — leer/descubrir el control real y sus opciones ─────────── */

    /** START-una-vez de la lectura de OOAD (contrato tipo discovery). */
    fun startOoadReadJs(runId: String): String = LIB_JS +
        "(function(){var RUN_ID=" + JSONObject.quote(runId) + ";" + START_OOAD_TAIL + "})()"

    private const val START_OOAD_TAIL = """
if(window.__LVD_BIO_OOAD_READ__&&window.__LVD_BIO_OOAD_READ__.runId===RUN_ID)return;
var L=window.__LVD_BIO_LIB__;
var state={status:"working",runId:RUN_ID,startedAt:Date.now()};
window.__LVD_BIO_OOAD_READ__=state;
function orphaned(){return !(window.__LVD_BIO_OOAD_READ__&&window.__LVD_BIO_OOAD_READ__.runId===RUN_ID)}
function commit(patch){if(orphaned())return;for(var k in patch){if(Object.prototype.hasOwnProperty.call(patch,k))window.__LVD_BIO_OOAD_READ__[k]=patch[k]}}
(async function(){
try{
  var c=await L.waitFor(function(){return L.findOoadControl()},6000,200);
  if(!c)throw new Error('OOAD_CONTROL_NOT_FOUND');
  commit({control:{kind:c.kind,tag:c.el.tagName.toLowerCase(),id:c.el.id||'',formcontrolname:c.el.getAttribute&&c.el.getAttribute('formcontrolname')||'',role:c.el.getAttribute&&c.el.getAttribute('role')||'',ariaLabel:c.el.getAttribute&&c.el.getAttribute('aria-label')||'',label:c.label||L.txt(c.el),evidence:c.evidence||''}});
  var ooads=null;
  if(c.kind==='mat'){
    var trigger=c.el.querySelector('.mat-select-trigger')||c.el;
    try{c.el.scrollIntoView({behavior:'auto',block:'center'})}catch(e){}
    trigger.click();
    ooads=await L.waitFor(function(){var o=L.collectOptions(c);return o.length>0?o:null},7000,150);
  }else{
    ooads=L.collectOptions(c);
  }
  if(!ooads||ooads.length===0)throw new Error('OOAD_OPTIONS_EMPTY');
  commit({ooads:ooads});
  commit({status:"success"});
}catch(e){
  if(!orphaned())commit({status:"error",reason:String(e&&e.message||e)});
}
})();
"""

    /** POLL del estado de lectura de OOAD (SOLO lectura). */
    fun readOoadStateJs(): String = """(function(){
var s=window.__LVD_BIO_OOAD_READ__;
if(!s)return JSON.stringify({status:"missing"});
return JSON.stringify({status:s.status,runId:s.runId,reason:s.reason,startedAt:s.startedAt,ooads:s.ooads,control:s.control});
})()"""

    /* ── JS: aplicar OOAD (start-una-vez/poll-resultado) ───────────────────── */

    fun applyOoadJs(value: String, label: String): String = LIB_JS +
        "(function(){var TARGET_VALUE=" + JSONObject.quote(value) +
        ";var TARGET_LABEL=" + JSONObject.quote(label) + ";" + APPLY_OOAD_TAIL + "})()"

    private const val APPLY_OOAD_TAIL = """
if(window.__LVD_BIO_OOAD_APPLY_RUNNING__)return;
window.__LVD_BIO_OOAD_APPLY_RUNNING__=true;window.__LVD_BIO_OOAD_APPLY_RESULT__=null;
var L=window.__LVD_BIO_LIB__;
var flags={controlFound:false,overlayOpened:false,optionCount:0,optionFound:false,clickPerformed:false,overlayClosed:false,availableLabels:[]};
(async function(){
try{
  var c=await L.waitFor(function(){return L.findOoadControl()},6000,200);
  if(!c)throw new Error('OOAD_CONTROL_NOT_FOUND');
  flags.controlFound=true;
  var pick=await L.openAndPick(c,TARGET_LABEL,TARGET_VALUE);
  flags.optionFound=pick.optionFound;flags.clickPerformed=pick.clickPerformed;flags.overlayClosed=pick.overlayClosed;flags.overlayOpened=pick.overlayOpened;flags.optionCount=pick.optionCount;flags.availableLabels=pick.availableLabels;
  if(!pick.optionFound)throw new Error(pick.maxOptions===0?'OOAD_OPTIONS_EMPTY':'OOAD_OPTION_NOT_FOUND');
  window.__LVD_BIO_OOAD_APPLY_RESULT__={ok:true,reason:'',controlFound:flags.controlFound,overlayOpened:flags.overlayOpened,optionCount:flags.optionCount,optionFound:flags.optionFound,clickPerformed:flags.clickPerformed,overlayClosed:flags.overlayClosed,availableLabels:flags.availableLabels};
}catch(e){
  window.__LVD_BIO_OOAD_APPLY_RESULT__={ok:false,reason:String(e&&e.message||e),controlFound:flags.controlFound,overlayOpened:flags.overlayOpened,optionCount:flags.optionCount,optionFound:flags.optionFound,clickPerformed:flags.clickPerformed,overlayClosed:flags.overlayClosed,availableLabels:flags.availableLabels};
}
finally{window.__LVD_BIO_OOAD_APPLY_RUNNING__=false}
})();
"""

    /* ── JS: verificar la OOAD aplicada (inspección independiente) ─────────── */

    fun verifyOoadJs(value: String, label: String): String = LIB_JS +
        "(function(){var TARGET_VALUE=" + JSONObject.quote(value) +
        ";var TARGET_LABEL=" + JSONObject.quote(label) + ";" + VERIFY_OOAD_TAIL + "})()"

    private const val VERIFY_OOAD_TAIL = """
var L=window.__LVD_BIO_LIB__;
var c=L.findOoadControl();
if(!c)return JSON.stringify({found:false,displayText:'',expectedMatch:false,overlayOpen:false});
var overlayOpen=!!document.querySelector('.cdk-overlay-pane');
var displayText='';
if(c.kind==='mat'){displayText=L.txt(c.el)}
else{var idx=c.el.selectedIndex;var o=c.el.options&&c.el.options[idx];displayText=o?String(o.textContent||o.text||''):String(c.el.value||'')}
var t=L.n(displayText);
var expectedMatch=t.indexOf(L.n(TARGET_LABEL))>=0||(L.n(TARGET_VALUE).length>=2&&t.indexOf(L.n(TARGET_VALUE))>=0);
return JSON.stringify({found:true,displayText:displayText.slice(0,80),expectedMatch:expectedMatch,overlayOpen:overlayOpen});
"""

    /* ── JS: estado actual del control OOAD (lectura sincrónica) ────────────── */

    fun ooadStatusJs(value: String, label: String): String = LIB_JS +
        "(function(){var TARGET_VALUE=" + JSONObject.quote(value) +
        ";var TARGET_LABEL=" + JSONObject.quote(label) + ";" + OOAD_STATUS_TAIL + "})()"

    private const val OOAD_STATUS_TAIL = """
var L=window.__LVD_BIO_LIB__;
var c=L.findOoadControl();
if(!c)return JSON.stringify({found:false,displayText:'',isDefault:false,overlayOpen:false});
var overlayOpen=!!document.querySelector('.cdk-overlay-pane');
var displayText='';
if(c.kind==='mat'){displayText=L.txt(c.el)}
else{var idx=c.el.selectedIndex;var o=c.el.options&&c.el.options[idx];displayText=o?String(o.textContent||o.text||''):String(c.el.value||'')}
var t=L.n(displayText);
var isDefault=t.indexOf(L.n(TARGET_LABEL))>=0||(L.n(TARGET_VALUE).length>=2&&t.indexOf(L.n(TARGET_VALUE))>=0);
return JSON.stringify({found:true,displayText:displayText.slice(0,80),isDefault:isDefault,overlayOpen:overlayOpen});
"""

    /* ── JS: esperar la repoblación del Periodo tras aplicar OOAD ──────────── */

    /**
     * START-una-vez que espera a que Angular repueble el selector de Periodo
     * tras cambiar la OOAD: abre el control, espera condiciones
     * `control encontrado AND options > 0 AND loading == false` (sin
     * `delay(1000)` fijos) y cierra con Escape. Nunca conserva referencias
     * viejas: localiza el control de nuevo en cada corrida.
     */
    fun startPeriodRefreshJs(runId: String): String = LIB_JS +
        "(function(){var RUN_ID=" + JSONObject.quote(runId) + ";" + PERIOD_REFRESH_TAIL + "})()"

    private const val PERIOD_REFRESH_TAIL = """
if(window.__LVD_BIO_PERIOD_REFRESH__&&window.__LVD_BIO_PERIOD_REFRESH__.runId===RUN_ID)return;
var L=window.__LVD_BIO_LIB__;
var state={status:"working",runId:RUN_ID,startedAt:Date.now(),loading:false};
window.__LVD_BIO_PERIOD_REFRESH__=state;
function orphaned(){return !(window.__LVD_BIO_PERIOD_REFRESH__&&window.__LVD_BIO_PERIOD_REFRESH__.runId===RUN_ID)}
function commit(patch){if(orphaned())return;for(var k in patch){if(Object.prototype.hasOwnProperty.call(patch,k))window.__LVD_BIO_PERIOD_REFRESH__[k]=patch[k]}}
function spinnerVisible(){var s=document.querySelector('mat-spinner,.mat-spinner,mat-progress-spinner,.loading,.spinner');return !!(s&&L.vis(s))}
(async function(){
try{
  var c=await L.waitFor(function(){return L.findPeriodControl()},6000,200);
  if(!c)throw new Error('PERIOD_CONTROL_NOT_FOUND');
  commit({controlFound:true});
  var count=0;
  if(c.kind==='mat'){
    if(document.querySelector('.cdk-overlay-pane')){L.esc();await L.sleep(200);}
    var trigger=c.el.querySelector('.mat-select-trigger')||c.el;
    try{c.el.scrollIntoView({behavior:'auto',block:'center'})}catch(e){}
    trigger.click();
    var opts=await L.waitFor(function(){var o=L.collectOptions(c);return o.length>0?o:null},8000,150);
    count=opts?opts.length:0;
    L.esc();
    await L.sleep(200);
  }else{
    count=(c.el.options||[]).length;
  }
  if(count===0)throw new Error('PERIOD_OPTIONS_EMPTY');
  var loading=spinnerVisible();
  commit({count:count,loading:loading,status:"success"});
}catch(e){
  if(!orphaned())commit({status:"error",reason:String(e&&e.message||e),loading:spinnerVisible()});
}
})();
"""

    /** POLL del estado del refresh de Periodo (SOLO lectura). */
    fun readPeriodRefreshStateJs(): String = """(function(){
var s=window.__LVD_BIO_PERIOD_REFRESH__;
if(!s)return JSON.stringify({status:"missing"});
return JSON.stringify({status:s.status,runId:s.runId,reason:s.reason,startedAt:s.startedAt,count:s.count,controlFound:s.controlFound,loading:s.loading});
})()"""

    /* ── JS: clasificar TODOS los selectores del formulario (diagnóstico) ──── */

    fun classifyControlsJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var sels=Array.from(document.querySelectorAll('mat-select[role="combobox"],select'));
var controls=sels.map(function(el){
  var isMat=el.tagName==='MAT-SELECT';
  var opts=isMat?0:(el.options||[]).length;
  return{tag:el.tagName.toLowerCase(),label:L.fieldLabel(el),formcontrolname:el.getAttribute&&el.getAttribute('formcontrolname')||'',ariaLabel:el.getAttribute&&el.getAttribute('aria-label')||'',placeholder:el.getAttribute&&el.getAttribute('placeholder')||'',text:isMat?L.txt(el).slice(0,60):'',options:opts};
});
controls.forEach(function(c,i){c.index=i});
var ooad=L.findOoadControl();
var period=L.findPeriodControl();
var ooadIdx=-1;var periodIdx=-1;
for(var i=0;i<sels.length;i++){if(ooad&&sels[i]===ooad.el)ooadIdx=i;if(period&&sels[i]===period.el)periodIdx=i;}
return JSON.stringify({controls:controls,ooad:{found:!!ooad,index:ooadIdx,evidence:ooad?ooad.evidence||'':''},period:{found:!!period,index:periodIdx,evidence:period?period.evidence||'':''}});
})()"""

    /* ── JS: diagnóstico de TODOS los botones visibles ────────────────────── */

    fun dumpButtonsJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var out=[];
var bs=document.querySelectorAll('button,input[type="submit"],input[type="button"]');
for(var i=0;i<bs.length;i++){
  var b=bs[i];
  if(!L.vis(b))continue;
  var r=null;try{var rect=b.getBoundingClientRect();r=Math.round(rect.top)+','+Math.round(rect.width)+'x'+Math.round(rect.height)}catch(e){}
  var text=L.txt(b);if(text.length>60)text=text.slice(0,60);
  var cls=String(b.className||'');if(cls.length>80)cls=cls.slice(0,80);
  out.push({tag:b.tagName.toLowerCase(),id:b.id||'',type:b.type||'',text:text,disabled:!!b.disabled,ariaDisabled:b.getAttribute&&b.getAttribute('aria-disabled')||'',cls:cls,rect:r});
}
return JSON.stringify(out);
})()"""

    /* ── JS: botón de consulta (identificado y reportado, no solo clickeado) ─ */

    fun clickConsultJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var texts=['consultar','buscar','aceptar','generar','enviar'];
function isHit(t){return texts.indexOf(L.n(t))>=0}
var b=Array.from(document.querySelectorAll('button.primary,button[type="submit"],input[type="submit"]')).find(function(x){return isHit(x.textContent||x.value||'')});
if(!b)b=Array.from(document.querySelectorAll('button')).find(function(x){return isHit(x.textContent||'')});
if(!b)return JSON.stringify({ok:false,reason:'CONSULT_BUTTON_NOT_FOUND'});
if(b.disabled)return JSON.stringify({ok:false,reason:'CONSULT_BUTTON_DISABLED',text:L.txt(b).slice(0,60),tag:b.tagName.toLowerCase()});
var text=L.txt(b);if(text.length>60)text=text.slice(0,60);
var cls=String(b.className||'');if(cls.length>80)cls=cls.slice(0,80);
b.click();
return JSON.stringify({ok:true,text:text,tag:b.tagName.toLowerCase(),cls:cls,enabled:true});
})()"""

    /* ── JS: snapshot de resultados v3 (waiting|loading|results|empty|error|unauth + counts) ─ */

    fun resultSnapshotJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
function visCount(sel){var n=0;var els=document.querySelectorAll(sel);for(var i=0;i<els.length;i++){if(L.vis(els[i]))n++}return n}
function counts(){
  return {
    tables: visCount('table'),
    matTables: visCount('mat-table,.mat-table'),
    rows: visCount('table tbody tr,table tr'),
    matRows: visCount('mat-row,.mat-row'),
    roleTables: visCount('[role="table"]'),
    roleRows: visCount('[role="row"]'),
    cards: visCount('mat-card,.card'),
    lists: visCount('mat-list,ul,ol,.list')
  };
}
function structure(){
  var containers=[];
  var kinds=['mat-table','.mat-table','table','mat-list','ul','ol','.mat-card'];
  for(var ki=0;ki<kinds.length;ki++){
    var list=Array.from(document.querySelectorAll(kinds[ki]));
    for(var li=0;li<list.length;li++){
      var el=list[li];
      if(!L.vis(el))continue;
      var rows=el.querySelectorAll('mat-row,tbody tr,tr').length;
      var headers=el.querySelectorAll('mat-header-cell,thead th,th').length;
      containers.push({kind:kinds[ki],cls:String(el.className||'').slice(0,60),rows:rows,headers:headers});
    }
  }
  return containers;
}
var m=document.querySelector('#matricula');var p=document.querySelector('#password');
if(m&&p&&L.vis(m))return JSON.stringify({status:'unauth',counts:counts()});
var spinner=document.querySelector('mat-spinner,.mat-spinner,mat-progress-spinner,.loading,.spinner');
if(spinner&&L.vis(spinner))return JSON.stringify({status:'loading',counts:counts(),structure:structure()});
var errSels=['mat-error','.mat-mdc-form-field-error','.alert-danger','.alert','[role="alert"]','.error-message','.invalid-feedback','.mat-mdc-snack-bar-container','.snackbar','.toast-error'];
for(var i=0;i<errSels.length;i++){
  var els=document.querySelectorAll(errSels[i]);
  for(var j=0;j<els.length;j++){
    var el=els[j];
    if(!L.vis(el))continue;
    var t=L.txt(el);
    if(t&&t.length>2&&t.length<300)return JSON.stringify({status:'error',message:t,counts:counts(),structure:structure()});
  }
}
var emptyKeys=['no se encontraron','no se encontro','sin registros','sin resultados','no hay registros','no existen registros','sin informacion','sin información','ningun registro','no cuenta con registros','cero registros','sin checadas','no existen checadas','no tiene registros'];
function findVisibleEmpty(){
  var nodes=document.querySelectorAll('p,div,span,td,mat-card-content,mat-list-item');
  for(var k=0;k<nodes.length;k++){
    var el=nodes[k];if(!L.vis(el))continue;
    var t=L.txt(el);if(t.length>300||t.length<2)continue;
    var tn=L.n(t);
    for(var ke=0;ke<emptyKeys.length;ke++){if(tn.indexOf(emptyKeys[ke])>=0)return el}
  }
  return null;
}
var table=document.querySelector('mat-table')||document.querySelector('.mat-table')||document.querySelector('table');
if(table&&L.vis(table)){
  var rows=Array.from(table.querySelectorAll('mat-row,tbody tr,tr'));
  var dataRows=rows.filter(function(r){return L.vis(r)&&!r.classList.contains('mat-header-row')});
  var headCells=Array.from(table.querySelectorAll('mat-header-cell,thead th,th'));
  var heads=headCells.map(function(h){return L.txt(h)}).filter(function(t){return t.length>0});
  if(dataRows.length===0){
    var ve=findVisibleEmpty();
    if(ve)return JSON.stringify({status:'empty',counts:counts(),structure:structure()});
    return JSON.stringify({status:'waiting',counts:counts(),structure:structure()});
  }
  var cellCount=0;var first=dataRows[0].querySelectorAll('mat-cell,td');if(first)cellCount=first.length;
  var columns=heads.map(function(c,ci){return{key:'c'+ci,label:c}});
  if(columns.length===0){for(var ci=0;ci<cellCount;ci++){columns.push({key:'c'+ci,label:'Columna '+(ci+1)})}}
  var rowsOut=dataRows.map(function(r){var cells=Array.from(r.querySelectorAll('mat-cell,td'));return cells.map(function(c){return L.txt(c)})});
  return JSON.stringify({status:'results',columns:columns,rows:rowsOut,counts:counts(),structure:structure()});
}
var ve2=findVisibleEmpty();
if(ve2)return JSON.stringify({status:'empty',counts:counts(),structure:structure()});
return JSON.stringify({status:'waiting',counts:counts(),structure:structure()});
})()"""

    /* ── JS: OBSERVE_RESULTS — MutationObserver de resultados y descargas ─── */

    /**
     * START-una-vez de un MutationObserver dedicado a resultados: detecta la
     * aparición de "Registros localizados", tablas (table/tbody/tr,
     * mat-table/mat-row, [role=table]/[role=row]) y de los controles
     * Descargar/Compartir. Almacena coincidencias en
     * `window.__LVD_BIO_RESULTS_OBS__`; se desconecta explícitamente con
     * [stopResultsObserverJs] (success/empty/error/timeout/cancel).
     */
    fun startResultsObserverJs(runId: String): String = LIB_JS +
        "(function(){var RUN_ID=" + JSONObject.quote(runId) + ";" + RESULTS_OBSERVER_TAIL + "})()"

    private const val RESULTS_OBSERVER_TAIL = """
if(window.__LVD_BIO_RESULTS_OBS__&&window.__LVD_BIO_RESULTS_OBS__.runId===RUN_ID)return;
var L=window.__LVD_BIO_LIB__;
var state={status:"working",runId:RUN_ID,matches:{localizados:false,tables:0,rows:0,matRows:0,roleTables:0,roleRows:0,download:false,share:false,snippets:[]}};
window.__LVD_BIO_RESULTS_OBS__=state;
function vis(el){return L.vis(el)}
function pushSnippet(t){var s=String(t||'').replace(/\s+/g,' ').trim().slice(0,60);if(s&&state.matches.snippets.indexOf(s)<0)state.matches.snippets.push(s)}
var scanning=false;
function scan(){
  if(scanning)return;scanning=true;
  try{
    var m=state.matches;
    var nodes=document.querySelectorAll('p,div,span,td,strong,h1,h2,h3,mat-cell');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];if(!vis(el))continue;
      var t=L.txt(el);if(!t)continue;
      var tn=L.n(t);
      if(tn.indexOf('registros localizados')>=0){m.localizados=true;pushSnippet(t)}
      if(tn.indexOf('descargar')>=0||tn.indexOf('compartir')>=0){if(tn.indexOf('descargar')>=0)m.download=true;if(tn.indexOf('compartir')>=0)m.share=true;pushSnippet(t)}
      if(m.localizados){break}
    }
    var count=function(sel){var n=0;var els=document.querySelectorAll(sel);for(var k=0;k<els.length;k++){if(vis(els[k]))n++}return n};
    m.tables=count('table');m.rows=count('table tbody tr')+count('table tr');m.matRows=count('mat-row,.mat-row');
    m.roleTables=count('[role="table"]');m.roleRows=count('[role="row"]');
    var dl=null;
    var texts=['descargar','compartir'];
    var cands=document.querySelectorAll('button,a,[role="button"],mat-icon,mat-icon-button,.mat-icon-button');
    for(var j=0;j<cands.length;j++){
      var c=cands[j];if(!vis(c))continue;
      var ct=L.n(L.txt(c));
      for(var ti=0;ti<texts.length;ti++){
        if(ct===texts[ti]||ct.indexOf(texts[ti])>=0){
          if(texts[ti]==='descargar'){m.download=true}else{m.share=true}
          break;
        }
      }
    }
  }catch(e){}finally{scanning=false}
}
var obs=new MutationObserver(function(){scan()});
obs.observe(document.body,{childList:true,subtree:true,characterData:true});
scan();
state.observer=obs;
"""

    /** POLL del estado del observer de resultados (SOLO lectura). */
    fun readResultsObserverStateJs(): String = """(function(){
var s=window.__LVD_BIO_RESULTS_OBS__;
if(!s)return JSON.stringify({status:"missing"});
return JSON.stringify({status:s.status,runId:s.runId,reason:s.reason,matches:s.matches});
})()"""

    /** Desconecta el observer (success/empty/error/timeout/cancel). */
    fun stopResultsObserverJs(): String = """(function(){
var s=window.__LVD_BIO_RESULTS_OBS__;
if(!s)return JSON.stringify({status:"missing"});
if(s.observer){try{s.observer.disconnect()}catch(e){}s.observer=null}
s.status="stopped";
return JSON.stringify({status:s.status,runId:s.runId,matches:s.matches});
})()"""

    /* ── JS: monitor de descargas (window.open / blob / anchor / fetch) ───── */

    /**
     * Observa mecanismos de descarga SIN alterar el comportamiento original:
     * window.open, URL.createObjectURL y HTMLAnchorElement.click. Las URLs se
     * SANITIZAN a scheme+host+pathname (nunca query ni fragmentos). Registra
     * kind=http|blob|windowOpen|anchor, mime y filename (solo del atributo
     * download del anchor).
     */
    fun downloadMonitorJs(): String = """(function(){
if(window.__LVD_BIO_DL_HOOKED__)return;
window.__LVD_BIO_DL_HOOKED__=true;
window.__LVD_BIO_DL_EVENTS__=[];
function push(e){var a=window.__LVD_BIO_DL_EVENTS__;a.push(e);if(a.length>20)a.shift();}
function sanitizeUrl(u){
  try{var x=new URL(String(u||''));return (x.protocol||'')+'//'+(x.host||'')+(x.pathname||'').slice(0,200)}
  catch(e){var s=String(u||'');return s.length>60?s.slice(0,60):s}
}
var oo=window.open;
window.open=function(u,t,f){try{push({kind:'windowOpen',url:sanitizeUrl(u),download:'',mime:''})}catch(e){}try{return oo.apply(this,arguments)}catch(e){return null}};
var co=URL.createObjectURL;
URL.createObjectURL=function(blob){
  try{
    var u=co.apply(this,arguments);
    push({kind:'blob',url:String(u||'').slice(0,40),download:'',mime:blob&&blob.type?String(blob.type).slice(0,60):''});
    return u;
  }catch(e){try{return co.apply(this,arguments)}catch(e2){return ''}}
};
var ac=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
  try{push({kind:'anchor',url:sanitizeUrl(this.href),download:String(this.download||'').slice(0,80),mime:''})}catch(e){}
  return ac.apply(this,arguments);
};
})()"""

    /** Lee los eventos de descarga observados (solo lectura). */
    fun readDownloadEventsJs(): String = """(function(){return JSON.stringify(window.__LVD_BIO_DL_EVENTS__||[])})()"""

    /* ── JS: DISCOVER_DOWNLOAD — inspección de Descargar/Compartir ────────── */

    fun discoverDownloadJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
function hint(el){
  var href=el.href||el.getAttribute&&el.getAttribute('href')||'';
  if(href.length>200)href=href.slice(0,200);
  var t=L.txt(el);if(t.length>40)t=t.slice(0,40);
  return{tag:el.tagName?el.tagName.toLowerCase():'',id:el.id||'',href:href,role:el.getAttribute&&el.getAttribute('role')||'',hasOnclick:!!el.getAttribute&&!!el.getAttribute('onclick'),download:String(el.getAttribute&&el.getAttribute('download')||'').slice(0,60),text:t};
}
var downloads=[];var shares=[];
var cands=document.querySelectorAll('button,a,[role="button"],mat-icon,mat-icon-button,.mat-icon-button,[data-cy]');
for(var i=0;i<cands.length;i++){
  var c=cands[i];
  if(!L.vis(c))continue;
  var t=L.n(L.txt(c));var cls=L.n(String(c.className||''));
  var isDl=t.indexOf('descargar')>=0||cls.indexOf('descargar')>=0||c.id.toLowerCase().indexOf('descargar')>=0;
  var isSh=t.indexOf('compartir')>=0||cls.indexOf('compartir')>=0;
  if(isDl)downloads.push(hint(c));
  else if(isSh)shares.push(hint(c));
}
return JSON.stringify({downloads:downloads.slice(0,10),shares:shares.slice(0,10)});
})()"""

    /* ── JS: errores JS del portal (sanitizados) ───────────────────────────── */

    /**
     * Captura errores JS del portal en DEBUG: window.onerror,
     * unhandledrejection y console.error. SOLO mensaje (200 chars), archivo
     * (basename), línea y columna. Nunca dumps de objetos.
     */
    fun jsErrorMonitorJs(): String = """(function(){
if(window.__LVD_BIO_JSERR_HOOKED__)return;
window.__LVD_BIO_JSERR_HOOKED__=true;
window.__LVD_BIO_JSERR__=[];
function push(e){var a=window.__LVD_BIO_JSERR__;var last=a[a.length-1];if(last&&last.type===e.type&&last.msg===e.msg)return;a.push(e);if(a.length>20)a.shift();}
window.addEventListener('error',function(e){
  var f=String(e.filename||'');f=f.slice(f.lastIndexOf('/')+1).slice(0,80);
  push({type:'error',msg:String(e.message||'').slice(0,200),file:f,line:e.lineno||0,col:e.colno||0});
});
window.addEventListener('unhandledrejection',function(e){
  var r=e.reason;var msg=(r&&r.message)?String(r.message):(typeof r==='string'?r:'(rejection no string)');
  push({type:'rejection',msg:msg.slice(0,200),file:'',line:0,col:0});
});
var ce=console.error;
console.error=function(){
  var msg='';
  try{msg=Array.prototype.slice.call(arguments).map(function(a){return typeof a==='string'?a:''}).join(' ')}catch(e){}
  push({type:'console',msg:String(msg||'(error sin mensaje)').slice(0,200),file:'',line:0,col:0});
  try{ce.apply(console,arguments)}catch(e){}
};
})()"""

    /** Lee los errores JS capturados (solo lectura). */
    fun readJsErrorsJs(): String = """(function(){return JSON.stringify(window.__LVD_BIO_JSERR__||[])})()"""

    /** Vacía el buffer de errores JS (tras volcarlos a la traza). */
    fun resetJsErrorsJs(): String = """(function(){window.__LVD_BIO_JSERR__=[];return '1'})()"""

    /* ── JS: click en el control "Descargar" del reporte de checadas ──────── */

    /**
     * Pulsa el control "Descargar" del reporte en el panel de resultados de
     * biométricos. Validado contra el portal real: es un `span` con
     * `cursor:pointer` (sin href) cuyo click dispara `POST
     * /mstpei-biometricos/v1/biometricos/recuperar`, devolviendo un Blob PDF
     * (~`URL.createObjectURL`). Devuelve el texto del control pulsado o '' si
     * no se encontró.
     */
    fun clickDownloadJs(): String = LIB_JS + """(function(){
var L=window.__LVD_BIO_LIB__;
var spans=Array.from(document.querySelectorAll('span,div,a,button'));
var target=null;
for(var i=0;i<spans.length;i++){
  var el=spans[i];
  if(!L.vis(el))continue;
  var t=L.n(L.txt(el));
  var cls=L.n(String(el.className||''));
  if(t==='descargar'||t==='descargar pdf'||cls.indexOf('download')>=0){target=el;break;}
}
if(!target)return JSON.stringify({ok:false,reason:'DOWNLOAD_CONTROL_NOT_FOUND'});
try{target.scrollIntoView({block:'center'});}catch(e){}
target.click();
return JSON.stringify({ok:true,text:L.txt(target).slice(0,40)});
})()"""
}
