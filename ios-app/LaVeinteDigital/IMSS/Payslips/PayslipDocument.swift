import Foundation

/// Documento de tarjetón guardado (port de `PayslipDocument` en Room).
struct PayslipDocument: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var source: String // "TU_PERFIL" / "TARJETON_DIGITAL"
    var displayName: String
    var localPath: String
    var downloadedAt: Date = Date()
    var fileSize: Int64 = 0
    var sha256: String = ""
    var mimeType: String = "application/pdf"
    var periodLabel: String?
    var conceptsPath: String?
    var sourceHost: String?
}
