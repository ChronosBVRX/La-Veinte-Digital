import Foundation

/// Persistencia del estado de biometría (port de `BiometricPreferences.kt`).
enum BiometricPreferences {
    private static let key = "biometric_enabled"

    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}
