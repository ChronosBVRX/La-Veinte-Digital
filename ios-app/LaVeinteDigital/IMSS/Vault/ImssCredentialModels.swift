import Foundation

/// Modelos de credenciales IMSS (port de `ImssCredentialModels.kt`).
enum ImssPortal: String, CaseIterable, Codable, Hashable {
    case tuPerfil = "tuperfil"
    case tarjetonDigital = "tarjetondigital"

    var displayName: String {
        switch self {
        case .tuPerfil: return "Tu Perfil IMSS"
        case .tarjetonDigital: return "Tarjetón Digital IMSS"
        }
    }

    var host: String {
        switch self {
        case .tuPerfil: return "tuperfil.imss.gob.mx"
        case .tarjetonDigital: return "rh.imss.gob.mx"
        }
    }

    var sourceValue: String {
        switch self {
        case .tuPerfil: return "TU_PERFIL"
        case .tarjetonDigital: return "TARJETON_DIGITAL"
        }
    }

    var loginURL: String {
        switch self {
        case .tuPerfil: return "https://tuperfil.imss.gob.mx/guitpei-web/login"
        case .tarjetonDigital: return "https://rh.imss.gob.mx/Personal/TarjetonDigital/"
        }
    }
}

/// Payload de credenciales cifrado en la bóveda.
/// Los nombres de campo coinciden con el JSON del shell Android.
struct ImssCredentialPayload: Codable, Equatable {
    var username: String
    var password: String
    var credentialVersion: Int = 1
    /// Tarjetón Digital: valor real del `<option>` de Delegación (ej. "17").
    var delegacionValue: String?
    /// Tarjetón Digital: nombre visible de la delegación (ej. "MICHOACAN").
    var delegacionLabel: String?
}
