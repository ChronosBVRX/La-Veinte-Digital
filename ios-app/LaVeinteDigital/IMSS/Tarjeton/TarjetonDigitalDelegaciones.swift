import Foundation

/// Catálogo de delegaciones de Tarjetón Digital IMSS (port de
/// `TarjetonDigitalDelegaciones.kt`). El listado estático es respaldo offline;
/// el portal manda (se refresca desde `<select id="ddlDelegacion">`).
enum TarjetonDigitalDelegaciones {

    struct Delegacion: Equatable {
        let value: String
        let label: String
        var displayName: String { TarjetonDigitalDelegaciones.prettify(label) }
    }

    static let fallback: [Delegacion] = [
        Delegacion(value: "01", label: "AGUASCALIENTES"),
        Delegacion(value: "02", label: "BAJA CALIFORNIA"),
        Delegacion(value: "03", label: "BAJA CALIFORNIA SUR"),
        Delegacion(value: "04", label: "CAMPECHE"),
        Delegacion(value: "05", label: "COAHUILA"),
        Delegacion(value: "06", label: "COLIMA"),
        Delegacion(value: "07", label: "CHIAPAS"),
        Delegacion(value: "08", label: "CHIHUAHUA"),
        Delegacion(value: "09", label: "OFICINAS CENTRALES"),
        Delegacion(value: "10", label: "DURANGO"),
        Delegacion(value: "11", label: "GUANAJUATO"),
        Delegacion(value: "12", label: "GUERRERO"),
        Delegacion(value: "13", label: "HIDALGO"),
        Delegacion(value: "14", label: "JALISCO"),
        Delegacion(value: "15", label: "ESTADO DE MEXICO ORIENTE"),
        Delegacion(value: "16", label: "ESTADO DE MEXICO PONIENTE"),
        Delegacion(value: "17", label: "MICHOACAN"),
        Delegacion(value: "18", label: "MORELOS"),
        Delegacion(value: "19", label: "NAYARIT"),
        Delegacion(value: "20", label: "NUEVO LEON"),
        Delegacion(value: "21", label: "OAXACA"),
        Delegacion(value: "22", label: "PUEBLA"),
        Delegacion(value: "23", label: "QUERETARO"),
        Delegacion(value: "24", label: "QUINTANA ROO"),
        Delegacion(value: "25", label: "SAN LUIS POTOSI"),
        Delegacion(value: "26", label: "SINALOA"),
        Delegacion(value: "27", label: "SONORA"),
        Delegacion(value: "28", label: "TABASCO"),
        Delegacion(value: "29", label: "TAMAULIPAS"),
        Delegacion(value: "30", label: "TLAXCALA"),
        Delegacion(value: "31", label: "VERACRUZ NORTE"),
        Delegacion(value: "32", label: "VERACRUZ SUR"),
        Delegacion(value: "33", label: "YUCATAN"),
        Delegacion(value: "34", label: "ZACATECAS"),
        Delegacion(value: "35", label: "35 NORTE DEL DISTRITO FEDERAL"),
        Delegacion(value: "36", label: "36 NORTE DEL DISTRITO FEDERAL"),
        Delegacion(value: "37", label: "37 SUR DEL DISTRITO FEDERAL"),
        Delegacion(value: "38", label: "38 SUR DEL DISTRITO FEDERAL"),
    ]

    private static let particles: Set<String> = ["de", "del", "la", "el", "y", "los", "las"]

    /// Convierte la etiqueta en mayúsculas del portal a un nombre amigable con
    /// acentos correctos (MICHOACAN → Michoacán, NUEVO LEON → Nuevo León, etc.).
    static func prettify(_ raw: String) -> String {
        let normalized = raw
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased()
        let accented = knownAccents[normalized] ?? normalized
        let words = accented.split(separator: " ")
        return words.enumerated().map { (i, word) in
            let w = String(word)
            if w.isEmpty { return w }
            if i > 0 && particles.contains(w) { return w }
            return w.prefix(1).uppercased() + w.dropFirst()
        }.joined(separator: " ")
    }

    private static let knownAccents: [String: String] = [
        "michoacan": "michoacán",
        "nuevo leon": "nuevo león",
        "queretaro": "querétaro",
        "yucatan": "yucatán",
        "san luis potosi": "san luis potosí",
        "estado de mexico oriente": "estado de méxico oriente",
        "estado de mexico poniente": "estado de méxico poniente",
    ]
}
