import Foundation
import LocalAuthentication
import Security

/// Canario biométrico (port de `BiometricKeyStore.kt`).
///
/// En iOS el equivalente de "AES/GCM en Keystore + CryptoObject" es un secreto
/// aleatorio guardado en Keychain con control de acceso `.biometryCurrentSet`:
/// solo puede leerse tras autenticación biométrica y se invalida si cambia la
/// biometría del dispositivo.
enum BiometricKeyStore {
    private static let service = "com.laveintedigital.app.biometric"
    private static let account = "enrollment"

    enum KeyStoreError: Error {
        case randomFailed
        case accessControl
        case saveFailed(OSStatus)
    }

    static func enroll() throws {
        var secret = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, secret.count, &secret) == errSecSuccess else {
            throw KeyStoreError.randomFailed
        }

        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &error
        ) else {
            if let error { throw error.takeRetainedValue() as Error }
            throw KeyStoreError.accessControl
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(secret),
            kSecAttrAccessControl as String: access,
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeyStoreError.saveFailed(status) }
    }

    /// Lee el canario con un `LAContext` ya autenticado (no re-pide biometría).
    static func readAuthenticated(context: LAContext) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecUseAuthenticationContext as String: context,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
