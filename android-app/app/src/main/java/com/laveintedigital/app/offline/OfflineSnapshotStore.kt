package com.laveintedigital.app.offline

import android.content.Context
import com.laveintedigital.app.imss.payslips.NativeDocuments
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import kotlin.math.roundToInt

/**
 * Almacén local de solo lectura para el snapshot sincronizado de la sesión del trabajador
 * (perfil laboral, último tarjetón confirmado, agenda próxima y valores base de calculadoras).
 *
 * Reglas de gobernanza:
 * - NUNCA sustituye la versión en vivo cuando hay conexión a Internet.
 * - Solo se consulta en la pantalla nativa sin conexión ([OfflineDocumentsScreen]).
 * - Aislado estrictamente por `ownerId` con la misma política de [NativeDocuments.isVisibleTo].
 * - Incluye catálogo estático de conceptos IMSS y calculadoras rápidas deterministas offline
 *   (respetando el Golden Behavior de 2ª de Julio / Fondo de Ahorro: Concepto 002 + Concepto 011).
 */
object OfflineSnapshotStore {

    private const val DIR_NAME = "offline_snapshots"
    private const val MAX_JSON_BYTES = 512 * 1024 // 512 KB máximo por snapshot

    data class OfflineConceptLine(
        val code: String,
        val description: String,
        val amount: Double,
        val kind: String, // "earning" | "deduction"
    )

    data class OfflinePayslipSummary(
        val periodLabel: String,
        val totalEarnings: Double,
        val totalDeductions: Double,
        val netPay: Double,
        val vacationDueDate: String?,
        val lines: List<OfflineConceptLine>,
    )

    data class OfflineProfileSummary(
        val fullName: String?,
        val matricula: String?,
        val categoria: String?,
        val antiguedad: String?,
        val adscripcion: String?,
        val workdayHours: Double?,
        val shift: String?,
    )

    data class OfflineCommitmentItem(
        val id: String,
        val title: String,
        val type: String,
        val typeLabel: String,
        val startAt: String,
        val status: String,
        val notes: String?,
    )

    data class OfflineCalculatorBase(
        val sueldoBaseQuincenal002: Double,
        val ayudaRentaQuincenal011: Double,
        val sueldoMensualIntegrado: Double,
        val workdayHours: Double,
    )

    data class OfflineWorkerSnapshot(
        val ownerId: String,
        val syncedAtMs: Long,
        val contextRevision: String?,
        val profile: OfflineProfileSummary,
        val latestPayslip: OfflinePayslipSummary?,
        val commitments: List<OfflineCommitmentItem>,
        val calculatorBase: OfflineCalculatorBase,
    )

    data class ImssConceptCatalogEntry(
        val code: String,
        val title: String,
        val kind: String, // "Percepción" | "Deducción"
        val explanation: String,
        val clauseRef: String,
    )

    /** Catálogo estático offline de los conceptos principales del tarjetón IMSS. */
    val OFFLINE_IMSS_CONCEPTS: List<ImssConceptCatalogEntry> = listOf(
        ImssConceptCatalogEntry(
            code = "002",
            title = "Sueldo Base Tabular",
            kind = "Percepción",
            explanation = "Sueldo tabular quincenal según tu categoría y jornada en el Tabulador Base del CCT.",
            clauseRef = "Tabulador CCT",
        ),
        ImssConceptCatalogEntry(
            code = "011",
            title = "Ayuda para Pago de Renta (Cláusula 63 Bis B)",
            kind = "Percepción",
            explanation = "Prestación fija e integrante salarial; se suma al Concepto 002 para el cálculo del Fondo de Ahorro (2ª de Julio).",
            clauseRef = "Cláusula 63 Bis B y 144 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "020",
            title = "Ayuda para Renta (Antigüedad / Cláusula 63 Bis A)",
            kind = "Percepción",
            explanation = "Porcentaje progresivo según años de servicio efectivos en el Instituto.",
            clauseRef = "Cláusula 63 Bis A CCT",
        ),
        ImssConceptCatalogEntry(
            code = "022",
            title = "Tiempo Extraordinario",
            kind = "Percepción",
            explanation = "Pago por horas laboradas adicionales a la jornada ordinaria autorizada.",
            clauseRef = "Cláusula 39 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "029",
            title = "Prima Vacacional",
            kind = "Percepción",
            explanation = "Pago adicional correspondiente al disfrute de periodos vacacionales ordinarios o cuatrimestrales.",
            clauseRef = "Cláusula 47 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "032",
            title = "Estímulo de Asistencia",
            kind = "Percepción",
            explanation = "Estímulo generado por no registrar faltas ni licencias sin goce en el periodo evaluado.",
            clauseRef = "Reglamento de Infectocontagiosidad / Asistencia",
        ),
        ImssConceptCatalogEntry(
            code = "033",
            title = "Estímulo de Puntualidad",
            kind = "Percepción",
            explanation = "Estímulo quincenal por registro puntual de entrada y salida en checador biométrico.",
            clauseRef = "Reglamento Interior / Asistencia",
        ),
        ImssConceptCatalogEntry(
            code = "048",
            title = "Ayuda para Actividades Culturales y Recreativas",
            kind = "Percepción",
            explanation = "Pago vinculado a periodos vacacionales conforme a la antigüedad y días disfrutados.",
            clauseRef = "Cláusula 47 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "049",
            title = "Aguinaldo",
            kind = "Percepción",
            explanation = "Prestación anual equivalente a 3 meses (90 días) de sueldo nominal proporcional a días laborados.",
            clauseRef = "Cláusula 107 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "050",
            title = "Ayuda de Despensa",
            kind = "Percepción",
            explanation = "Apoyo quincenal fijo para adquisición de despensa básica.",
            clauseRef = "Cláusula 142 Bis CCT",
        ),
        ImssConceptCatalogEntry(
            code = "055",
            title = "Fondo de Ahorro (Segunda Quincena de Julio)",
            kind = "Percepción",
            explanation = "Entrega anual de 45 días de sueldo tabular (002) más ayuda de renta (011), libre de impuestos.",
            clauseRef = "Cláusula 144 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "107",
            title = "Proporción de Aguinaldo / Anticipo",
            kind = "Percepción",
            explanation = "Pago proporcional o anticipo de aguinaldo conforme al calendario institucional.",
            clauseRef = "Cláusula 107 CCT",
        ),
        ImssConceptCatalogEntry(
            code = "151",
            title = "Impuesto Sobre la Renta (ISR)",
            kind = "Deducción",
            explanation = "Retención fiscal federal calculada sobre las percepciones gravables de la quincena.",
            clauseRef = "Ley del ISR",
        ),
        ImssConceptCatalogEntry(
            code = "152",
            title = "Fondo de Jubilaciones y Pensiones (RJP)",
            kind = "Deducción",
            explanation = "Aportación del trabajador al Régimen de Jubilaciones y Pensiones cuando aplica según fecha de ingreso.",
            clauseRef = "RJP / CCT",
        ),
        ImssConceptCatalogEntry(
            code = "180",
            title = "Cuota Sindical Ordinaria SNTSS",
            kind = "Deducción",
            explanation = "Cuota estatutaria del Sindicato Nacional de Trabajadores del Seguro Social.",
            clauseRef = "Estatutos SNTSS",
        ),
    )

    fun searchCatalog(query: String): List<ImssConceptCatalogEntry> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return OFFLINE_IMSS_CONCEPTS
        return OFFLINE_IMSS_CONCEPTS.filter {
            it.code.lowercase().contains(q) ||
                it.title.lowercase().contains(q) ||
                it.explanation.lowercase().contains(q) ||
                it.clauseRef.lowercase().contains(q)
        }
    }

    /**
     * Cálculo rápido offline de Fondo de Ahorro (2ª Quincena de Julio).
     * GOLDEN BEHAVIOR: Integra estrictamente Concepto 002 (Sueldo Base) + Concepto 011 (Ayuda Renta).
     * Base quincenal = 002 + 011 -> Sueldo diario base = (002 + 011) / 15 -> 45 días = 3 quincenas.
     */
    fun calculateOfflineSegundaJulio(
        sueldoQuincenal002: Double,
        ayudaRentaQuincenal011: Double,
        diasLaboradosAnio: Int = 365,
    ): Double {
        if (sueldoQuincenal002 <= 0.0 && ayudaRentaQuincenal011 <= 0.0) return 0.0
        val safeDays = diasLaboradosAnio.coerceIn(0, 365)
        val baseQuincenal = sueldoQuincenal002.coerceAtLeast(0.0) + ayudaRentaQuincenal011.coerceAtLeast(0.0)
        val montoAnualCompleto = baseQuincenal * 3.0 // 45 días = 3 quincenas
        val proporcional = montoAnualCompleto * (safeDays.toDouble() / 365.0)
        return (proporcional * 100.0).roundToInt() / 100.0
    }

    /**
     * Cálculo rápido offline de Aguinaldo (Cláusula 107 CCT: 90 días = 6 quincenas de sueldo nominal/integrado).
     */
    fun calculateOfflineAguinaldo(
        sueldoMensualBase: Double,
        diasLaboradosAnio: Int = 365,
    ): Double {
        if (sueldoMensualBase <= 0.0) return 0.0
        val safeDays = diasLaboradosAnio.coerceIn(0, 365)
        val montoCompleto = sueldoMensualBase * 3.0 // 3 meses (90 días)
        val proporcional = montoCompleto * (safeDays.toDouble() / 365.0)
        return (proporcional * 100.0).roundToInt() / 100.0
    }

    /**
     * Cálculo rápido offline de Tiempo Extra (doble las primeras 9h semanales, triple las excedentes).
     */
    fun calculateOfflineTiempoExtra(
        sueldoQuincenalBase: Double,
        workdayHours: Double,
        extraHours: Double,
    ): Double {
        if (sueldoQuincenalBase <= 0.0 || extraHours <= 0.0) return 0.0
        val safeWorkday = if (workdayHours > 0.0) workdayHours else 8.0
        val dailyPay = sueldoQuincenalBase / 15.0
        val hourlyPay = dailyPay / safeWorkday
        val doubleHours = extraHours.coerceAtMost(9.0)
        val tripleHours = (extraHours - 9.0).coerceAtLeast(0.0)
        val total = (doubleHours * hourlyPay * 2.0) + (tripleHours * hourlyPay * 3.0)
        return (total * 100.0).roundToInt() / 100.0
    }

    /** Parsea el JSON recibido del bridge en un [OfflineWorkerSnapshot] puro (testeable en JVM). */
    fun parseSnapshot(rawJson: String): OfflineWorkerSnapshot? {
        if (rawJson.isBlank() || rawJson.toByteArray(Charsets.UTF_8).size > MAX_JSON_BYTES) return null
        return runCatching {
            val root = JSONObject(rawJson)
            val snapshotObj = root.optJSONObject("snapshot") ?: root
            val ownerId = snapshotObj.optString("ownerId", root.optString("userId", "")).trim()
            if (!NativeSessionOwner.isValidOwnerId(ownerId)) return null

            val syncedAtMs = snapshotObj.optLong("syncedAtMs", System.currentTimeMillis())
            val contextRevision = snapshotObj.optString("contextRevision").trim().ifBlank { null }

            val profObj = snapshotObj.optJSONObject("profile")
            val profile = OfflineProfileSummary(
                fullName = profObj?.optString("fullName")?.trim()?.ifBlank { null },
                matricula = profObj?.optString("matricula")?.trim()?.ifBlank { null },
                categoria = profObj?.optString("categoria")?.trim()?.ifBlank { null },
                antiguedad = profObj?.optString("antiguedad")?.trim()?.ifBlank { null },
                adscripcion = profObj?.optString("adscripcion")?.trim()?.ifBlank { null },
                workdayHours = profObj?.optDouble("workdayHours")?.takeIf { !it.isNaN() && it > 0.0 },
                shift = profObj?.optString("shift")?.trim()?.ifBlank { null },
            )

            val payObj = snapshotObj.optJSONObject("latestPayslip")
            val latestPayslip = if (payObj != null) {
                val linesArr = payObj.optJSONArray("lines") ?: JSONArray()
                val lines = mutableListOf<OfflineConceptLine>()
                for (i in 0 until minOf(linesArr.length(), 80)) {
                    val item = linesArr.optJSONObject(i) ?: continue
                    val code = item.optString("code").trim()
                    val desc = item.optString("description").trim()
                    val amount = item.optDouble("amount", 0.0).let { if (it.isNaN()) 0.0 else it }
                    val kind = item.optString("kind", "earning").trim()
                    if (code.isNotEmpty() || desc.isNotEmpty()) {
                        lines += OfflineConceptLine(code = code, description = desc, amount = amount, kind = kind)
                    }
                }
                OfflinePayslipSummary(
                    periodLabel = payObj.optString("periodLabel", "Última quincena").trim().ifBlank { "Última quincena" },
                    totalEarnings = payObj.optDouble("totalEarnings", 0.0).let { if (it.isNaN()) 0.0 else it },
                    totalDeductions = payObj.optDouble("totalDeductions", 0.0).let { if (it.isNaN()) 0.0 else it },
                    netPay = payObj.optDouble("netPay", 0.0).let { if (it.isNaN()) 0.0 else it },
                    vacationDueDate = payObj.optString("vacationDueDate").trim().ifBlank { null },
                    lines = lines,
                )
            } else {
                null
            }

            val commArr = snapshotObj.optJSONArray("commitments") ?: JSONArray()
            val commitments = mutableListOf<OfflineCommitmentItem>()
            for (i in 0 until minOf(commArr.length(), 50)) {
                val c = commArr.optJSONObject(i) ?: continue
                val id = c.optString("id").trim()
                val title = c.optString("title").trim()
                if (id.isEmpty() || title.isEmpty()) continue
                commitments += OfflineCommitmentItem(
                    id = id,
                    title = title,
                    type = c.optString("type", "general_reminder").trim(),
                    typeLabel = c.optString("typeLabel", "Compromiso").trim().ifBlank { "Compromiso" },
                    startAt = c.optString("startAt").trim(),
                    status = c.optString("status", "pending").trim(),
                    notes = c.optString("notes").trim().ifBlank { null },
                )
            }

            val calcObj = snapshotObj.optJSONObject("calculatorBase")
            val line002 = latestPayslip?.lines?.firstOrNull { it.code == "002" || it.code == "2" }?.amount ?: 0.0
            val line011 = latestPayslip?.lines?.firstOrNull { it.code == "011" || it.code == "11" }?.amount ?: 0.0
            val base002 = calcObj?.optDouble("sueldoBaseQuincenal002")?.takeIf { !it.isNaN() && it > 0.0 } ?: line002
            val base011 = calcObj?.optDouble("ayudaRentaQuincenal011")?.takeIf { !it.isNaN() && it > 0.0 } ?: line011
            val integratedMonthly = calcObj?.optDouble("sueldoMensualIntegrado")?.takeIf { !it.isNaN() && it > 0.0 }
                ?: ((base002 + base011) * 2.0)
            val workday = calcObj?.optDouble("workdayHours")?.takeIf { !it.isNaN() && it > 0.0 }
                ?: profile.workdayHours
                ?: 8.0

            OfflineWorkerSnapshot(
                ownerId = ownerId,
                syncedAtMs = syncedAtMs,
                contextRevision = contextRevision,
                profile = profile,
                latestPayslip = latestPayslip,
                commitments = commitments,
                calculatorBase = OfflineCalculatorBase(
                    sueldoBaseQuincenal002 = base002,
                    ayudaRentaQuincenal011 = base011,
                    sueldoMensualIntegrado = integratedMonthly,
                    workdayHours = workday,
                ),
            )
        }.getOrNull()
    }

    internal fun fileKeyForOwner(ownerId: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(ownerId.trim().toByteArray(Charsets.UTF_8))
            .take(16)
            .joinToString("") { "%02x".format(it) }
        return "snapshot_$hash.json"
    }

    /** Guarda de forma atómica el snapshot validado en almacenamiento privado de la app. */
    fun save(context: Context, rawJson: String): Boolean {
        val parsed = parseSnapshot(rawJson) ?: return false
        return runCatching {
            val dir = File(context.applicationContext.filesDir, DIR_NAME).apply { mkdirs() }
            val target = File(dir, fileKeyForOwner(parsed.ownerId))
            val tmp = File(dir, "${target.name}.tmp")
            // Persistimos solo el objeto snapshot normalizado
            val normalizedObj = JSONObject(rawJson).let { root ->
                root.optJSONObject("snapshot") ?: root
            }
            tmp.writeText(normalizedObj.toString(), Charsets.UTF_8)
            if (!tmp.renameTo(target)) {
                tmp.copyTo(target, overwrite = true)
                tmp.delete()
            }
            android.util.Log.i(
                OfflineLog.TAG,
                "${OfflineLog.EVENT_SNAPSHOT_SAVED} hasPayslip=${parsed.latestPayslip != null} commitments=${parsed.commitments.size}",
            )
            true
        }.getOrDefault(false)
    }

    /**
     * Lee el snapshot visible para el propietario de sesión actual ([NativeSessionOwner.current]).
     * Si hay propietario activo, carga exclusivamente su archivo; si no hay propietario conocido,
     * carga el snapshot más reciente siguiendo la política conservadora de [NativeDocuments.isVisibleTo].
     */
    fun loadForCurrentOwner(context: Context): OfflineWorkerSnapshot? {
        return runCatching {
            val dir = File(context.applicationContext.filesDir, DIR_NAME)
            if (!dir.exists() || !dir.isDirectory) return null
            val currentOwner = NativeSessionOwner.current(context)
            if (!currentOwner.isNullOrBlank()) {
                val target = File(dir, fileKeyForOwner(currentOwner))
                if (!target.exists()) return null
                val parsed = parseSnapshot(target.readText(Charsets.UTF_8)) ?: return null
                return if (NativeDocuments.isVisibleTo(parsed.ownerId, currentOwner)) parsed else null
            }
            val latestFile = dir.listFiles()
                ?.filter { it.isFile && it.name.startsWith("snapshot_") && it.name.endsWith(".json") }
                ?.maxByOrNull { it.lastModified() }
                ?: return null
            val parsed = parseSnapshot(latestFile.readText(Charsets.UTF_8)) ?: return null
            if (NativeDocuments.isVisibleTo(parsed.ownerId, null)) parsed else null
        }.getOrNull()
    }
}
