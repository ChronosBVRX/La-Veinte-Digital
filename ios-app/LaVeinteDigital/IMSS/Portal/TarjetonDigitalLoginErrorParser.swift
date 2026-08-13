import Foundation

enum TarjetonDigitalLoginResult: Equatable {
    case success
    case invalidCredentials
    case missingFields
    case accountLocked
    case sessionExpired
    case serviceUnavailable
    case portalError(String)
    case unknownError(String?)
}

/// Parser puro de mensajes de error de Tarjetón Digital IMSS (port de
/// `TarjetonDigitalLoginErrorParser.kt`).
enum TarjetonDigitalLoginErrorParser {

    static func isPortalFault(_ result: TarjetonDigitalLoginResult) -> Bool {
        switch result {
        case .serviceUnavailable, .sessionExpired: return true
        default: return false
        }
    }

    static func classify(_ message: String?) -> TarjetonDigitalLoginResult? {
        guard let message, !message.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        let m = normalize(message)
        func has(_ keys: String...) -> Bool { keys.contains { m.contains(normalize($0)) } }

        if has("contraseña incorrecta", "contraseña incorrecta, intenté nuevamente", "intente nuevamente") { return .invalidCredentials }
        if has("datos del usuario incorrectos", "trabajador no encontrado", "administrador no pertenece") { return .invalidCredentials }
        if has("usuario no encontrado", "nuevo registro") { return .invalidCredentials }
        if has("es necesario seleccionar la delegación", "es necesario capturar el usuario", "es necesario capturar la contraseña") { return .missingFields }
        if has("trabajador no activo", "no autorizado", "administrador no activo", "cuenta desactivada", "bloqueada", "bloqueado") { return .accountLocked }
        if has("sesión ha expirado", "sesion ha expirado", "sesión expirada", "sesion expirada", "firmarse nuevamente") { return .sessionExpired }
        if has("no es posible acceder a la página", "intente más tarde", "sistema ocupado", "intentarlo mas tarde", "servicio no disponible", "no disponible") { return .serviceUnavailable }
        if has("tipo de contratación no permitido", "tipo de contratacion no permitido", "aun no cuenta con algun tarjeton", "tarjeton digital para consultar") { return .portalError(message) }
        return .unknownError(message)
    }

    static func normalize(_ message: String) -> String {
        message
            .lowercased()
            .replacingOccurrences(of: "á", with: "a")
            .replacingOccurrences(of: "é", with: "e")
            .replacingOccurrences(of: "í", with: "i")
            .replacingOccurrences(of: "ó", with: "o")
            .replacingOccurrences(of: "ú", with: "u")
            .replacingOccurrences(of: "ü", with: "u")
            .replacingOccurrences(of: "ñ", with: "n")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
}
