package com.laveintedigital.app.imss.tarjeton

enum class PortalAuthState { UNKNOWN, LOGIN_PAGE, AUTHENTICATED }

enum class PortalPageState {
    INITIALIZING,
    LOGIN,
    AUTHENTICATED,
    CARD_PAGE,
    READY,
    GENERATING,
    COMPLETED,
    ERROR
}

data class PortalOoad(
    val code: String,
    val portalLabel: String,
    val displayLabel: String = portalLabel
)

data class ImssPeriodOption(
    val code: String,
    val year: Int?,
    val periodNumber: Int?,
    val half: Int?,
    val month: String?,
    val portalText: String,
    val parsed: Boolean
) {
    val displayLabel: String
        get() = if (parsed && half != null && month != null && year != null) {
            "${half}ª quincena de $month de $year"
        } else portalText
}

data class TarjetonCaptureSession(
    val id: String,
    val portalId: String,
    val ooadCode: String,
    val ooadLabel: String,
    val periodCode: String,
    val periodLabel: String,
    val startedAt: Long = System.currentTimeMillis(),
    var pdfSequence: Int = 0,
    val processedSequences: MutableSet<Int> = mutableSetOf(),
    var tarjetonDocumentId: Long? = null,
)

object PeriodParser {
    private val regex = Regex("""^(\d{4})(\d{3})\s*\((\d)(?:ra|da)?\s*-\s*(.+)\)$""")

    fun parse(text: String): ImssPeriodOption {
        val clean = text.trim()
        val match = regex.find(clean)
        return if (match != null) {
            val year = match.groupValues[1].toIntOrNull()
            val periodNum = match.groupValues[2].toIntOrNull()
            val half = match.groupValues[3].toIntOrNull()
            val month = match.groupValues[4].trim()
            ImssPeriodOption(
                code = "${match.groupValues[1]}${match.groupValues[2]}",
                year = year,
                periodNumber = periodNum,
                half = half,
                month = month.lowercase(),
                portalText = clean,
                parsed = true,
            )
        } else {
            ImssPeriodOption(code = clean, year = null, periodNumber = null, half = null, month = null, portalText = clean, parsed = false)
        }
    }

    fun latestPeriod(options: List<ImssPeriodOption>): ImssPeriodOption? {
        return options.filter { it.parsed }.maxByOrNull { it.code.toLongOrNull() ?: 0L }
    }

    fun parseOoadCode(text: String): String? {
        val match = Regex("""^(\d{2})\s*-""").find(text.trim()) ?: return null
        return match.groupValues[1]
    }
}
