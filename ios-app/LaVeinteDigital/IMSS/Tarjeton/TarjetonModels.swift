import Foundation

struct PortalOoad: Hashable {
    let code: String
    let portalLabel: String
    let displayLabel: String

    init(code: String, portalLabel: String, displayLabel: String? = nil) {
        self.code = code
        self.portalLabel = portalLabel
        self.displayLabel = displayLabel ?? portalLabel
    }
}

struct ImssPeriodOption: Hashable {
    let code: String
    let year: Int?
    let periodNumber: Int?
    let half: Int?
    let month: String?
    let portalText: String
    let parsed: Bool

    var displayLabel: String {
        if parsed, let half, let month, let year {
            return "\(half)ª quincena de \(month) de \(year)"
        }
        return portalText
    }
}

struct TarjetonPeriod: Hashable {
    let code: String
    let fechas: String
    let observaciones: String

    init(code: String, fechas: String = "", observaciones: String = "") {
        self.code = code
        self.fechas = fechas
        self.observaciones = observaciones
    }

    var displayLabel: String {
        fechas.isEmpty ? code : "\(code) · \(fechas)"
    }
}

final class TarjetonCaptureSession {
    let id: String
    let portalId: String
    let ooadCode: String
    let ooadLabel: String
    let periodCode: String
    let periodLabel: String
    let startedAt: Date = Date()
    var pdfSequence: Int = 0
    var processedSequences: Set<Int> = []
    var tarjetonDocumentId: String?

    init(id: String, portalId: String, ooadCode: String, ooadLabel: String, periodCode: String, periodLabel: String) {
        self.id = id
        self.portalId = portalId
        self.ooadCode = ooadCode
        self.ooadLabel = ooadLabel
        self.periodCode = periodCode
        self.periodLabel = periodLabel
    }
}

enum PeriodParser {
    static func parse(_ text: String) -> ImssPeriodOption {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"^(\d{4})(\d{3})\s*\((\d)(?:ra|da)?\s*-\s*(.+)\)$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: clean, range: NSRange(clean.startIndex..., in: clean)),
              match.numberOfRanges >= 5 else {
            return ImssPeriodOption(
                code: clean, year: nil, periodNumber: nil, half: nil, month: nil,
                portalText: clean, parsed: false
            )
        }

        func group(_ i: Int) -> String {
            let r = match.range(at: i)
            guard r.location != NSNotFound else { return "" }
            return (clean as NSString).substring(with: r)
        }

        return ImssPeriodOption(
            code: group(1) + group(2),
            year: Int(group(1)),
            periodNumber: Int(group(2)),
            half: Int(group(3)),
            month: group(4).trimmingCharacters(in: .whitespaces).lowercased(),
            portalText: clean,
            parsed: true
        )
    }

    static func latestPeriod(_ options: [ImssPeriodOption]) -> ImssPeriodOption? {
        options.filter { $0.parsed }.max { (Int64($0.code) ?? 0) < (Int64($1.code) ?? 0) }
    }

    static func parseOoadCode(_ text: String) -> String? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        guard let regex = try? NSRegularExpression(pattern: #"^(\d{2})\s*-"#),
              let match = regex.firstMatch(in: clean, range: NSRange(clean.startIndex..., in: clean)),
              match.numberOfRanges >= 2,
              match.range(at: 1).location != NSNotFound else { return nil }
        return (clean as NSString).substring(with: match.range(at: 1))
    }
}
