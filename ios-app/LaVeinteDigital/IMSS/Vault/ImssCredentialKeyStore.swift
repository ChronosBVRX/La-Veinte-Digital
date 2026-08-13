import CryptoKit
import Foundation
import Security

enum VaultError: Error {
    case keyNotFound
    case keySaveFailed(OSStatus)
    case keyReadFailed(OSStatus)
}

/// AES-256/GCM con una llave independiente por portal (port de
/// `ImssCredentialKeyStore.kt`). Las llaves viven en Keychain (no exportables).
enum ImssCredentialKeyStore {
    private static let service = "com.laveintedigital.app.imss"

    private static func keyAccount(_ portalId: String) -> String {
        "laveinte_imss_\(portalId)_v1"
    }

    static func createKey(portalId: String) throws -> SymmetricKey {
        let key = SymmetricKey(size: .bits256)
        let data = key.withUnsafeBytes { Data($0) }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: keyAccount(portalId),
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemDelete(query as CFDictionary) // reemplaza si ya existe
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw VaultError.keySaveFailed(status) }
        return key
    }

    static func getKey(portalId: String) -> SymmetricKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: keyAccount(portalId),
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return SymmetricKey(data: data)
    }

    static func deleteKey(portalId: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: keyAccount(portalId),
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func encrypt(portalId: String, plaintext: Data) throws -> Data {
        guard let key = getKey(portalId: portalId) else { throw VaultError.keyNotFound }
        return try AES.GCM.seal(plaintext, using: key).combined
    }

    static func decrypt(portalId: String, combined: Data) throws -> Data {
        guard let key = getKey(portalId: portalId) else { throw VaultError.keyNotFound }
        let sealed = try AES.GCM.SealedBox(combined: combined)
        return try AES.GCM.open(sealed, using: key)
    }
}
