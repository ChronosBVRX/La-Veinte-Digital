package com.laveintedigital.app.imss.tarjeton

/**
 * Catálogo de delegaciones de Tarjetón Digital IMSS.
 *
 * Los valores (`value` / `label`) provienen del portal real: la lista la entrega
 * `wsRegistroUsuario.asmx/wsConsultaDelegaciones` y la APK la refresca en vivo desde
 * el `<select id="ddlDelegacion">` cuando el WebView carga el formulario. Este listado
 * estático es únicamente un respaldo offline para que el formulario nativo muestre
 * nombres amigables desde el primer frame.
 *
 * `value` = el `Valor` real del portal (texto del atributo value del `<option>`).
 * `label` = el `Texto` real del portal (en mayúsculas, sin acentos).
 */
object TarjetonDigitalDelegaciones {

    data class Delegacion(val value: String, val label: String) {
        /** Nombre amigable para la interfaz: "Estado de México Oriente", "Michoacán". */
        val displayName: String get() = prettify(label)
    }

    /** Respaldo offline — NO es autoritativo; el portal manda. */
    val FALLBACK: List<Delegacion> = listOf(
        Delegacion("01", "AGUASCALIENTES"),
        Delegacion("02", "BAJA CALIFORNIA"),
        Delegacion("03", "BAJA CALIFORNIA SUR"),
        Delegacion("04", "CAMPECHE"),
        Delegacion("05", "COAHUILA"),
        Delegacion("06", "COLIMA"),
        Delegacion("07", "CHIAPAS"),
        Delegacion("08", "CHIHUAHUA"),
        Delegacion("09", "OFICINAS CENTRALES"),
        Delegacion("10", "DURANGO"),
        Delegacion("11", "GUANAJUATO"),
        Delegacion("12", "GUERRERO"),
        Delegacion("13", "HIDALGO"),
        Delegacion("14", "JALISCO"),
        Delegacion("15", "ESTADO DE MEXICO ORIENTE"),
        Delegacion("16", "ESTADO DE MEXICO PONIENTE"),
        Delegacion("17", "MICHOACAN"),
        Delegacion("18", "MORELOS"),
        Delegacion("19", "NAYARIT"),
        Delegacion("20", "NUEVO LEON"),
        Delegacion("21", "OAXACA"),
        Delegacion("22", "PUEBLA"),
        Delegacion("23", "QUERETARO"),
        Delegacion("24", "QUINTANA ROO"),
        Delegacion("25", "SAN LUIS POTOSI"),
        Delegacion("26", "SINALOA"),
        Delegacion("27", "SONORA"),
        Delegacion("28", "TABASCO"),
        Delegacion("29", "TAMAULIPAS"),
        Delegacion("30", "TLAXCALA"),
        Delegacion("31", "VERACRUZ NORTE"),
        Delegacion("32", "VERACRUZ SUR"),
        Delegacion("33", "YUCATAN"),
        Delegacion("34", "ZACATECAS"),
        Delegacion("35", "35 NORTE DEL DISTRITO FEDERAL"),
        Delegacion("36", "36 NORTE DEL DISTRITO FEDERAL"),
        Delegacion("37", "37 SUR DEL DISTRITO FEDERAL"),
        Delegacion("38", "38 SUR DEL DISTRITO FEDERAL"),
    )

    /** Partículas que van en minúscula dentro del nombre (título en español). */
    private val particles = setOf("de", "del", "la", "el", "y", "los", "las")

    /**
     * Convierte la etiqueta en mayúsculas del portal a un nombre amigable con
     * acentos correctos en español. Maneja casos conocidos donde el portal omite
     * tildes (MICHOACAN → Michoacán, NUEVO LEON → Nuevo León, etc.).
     */
    fun prettify(raw: String): String {
        val normalized = raw.trim().replace(Regex("""\s+"""), " ").lowercase()
        val accented = knownAccents[normalized] ?: normalized
        val words = accented.split(" ")
        return words.mapIndexed { i, word ->
            if (word.isEmpty()) word
            else {
                val cased = word.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
                // Primera palabra siempre con mayúscula; las partículas intermedias en minúscula.
                if (i > 0 && word in particles) word else cased
            }
        }.joinToString(" ")
    }

    /** Acentos conocidos que el portal escribe sin tilde (clave en minúsculas). */
    private val knownAccents: Map<String, String> = mapOf(
        "michoacan" to "michoacán",
        "nuevo leon" to "nuevo león",
        "queretaro" to "querétaro",
        "yucatan" to "yucatán",
        "san luis potosi" to "san luis potosí",
        "estado de mexico oriente" to "estado de méxico oriente",
        "estado de mexico poniente" to "estado de méxico poniente",
    )
}
