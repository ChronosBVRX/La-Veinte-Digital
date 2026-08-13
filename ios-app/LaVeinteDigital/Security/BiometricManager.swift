import LocalAuthentication

/// Disponibilidad biométrica (port de `LaveinteBiometricManager.kt`).
enum BiometricManager {
    static func canAuthenticateStrong() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    static func unavailableReason() -> String? {
        let context = LAContext()
        var error: NSError?
        guard !context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error),
              let code = error.map({ LAError.Code(rawValue: $0.code) }) else { return nil }
        switch code {
        case .biometryNotEnrolled:
            return "No hay Face ID ni Touch ID registrado en este dispositivo."
        case .biometryNotAvailable:
            return "Este dispositivo no tiene sensor biométrico."
        default:
            return nil
        }
    }

    static var biometryLabel: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        default: return "biometría"
        }
    }
}
