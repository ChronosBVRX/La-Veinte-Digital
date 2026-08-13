import Foundation

/// Almacena el sealed box (nonce+ciphertext+tag) por portal (port de
/// `ImssCredentialRepository.kt`, que usaba DataStore).
enum ImssCredentialRepository {
    private static let defaults = UserDefaults.standard

    private static func ctKey(_ portalId: String) -> String { "imss_ct_\(portalId)" }

    static func hasCredentials(portalId: String) -> Bool {
        defaults.data(forKey: ctKey(portalId)) != nil
    }

    static func save(portalId: String, combined: Data) {
        defaults.set(combined, forKey: ctKey(portalId))
    }

    static func read(portalId: String) -> Data? {
        defaults.data(forKey: ctKey(portalId))
    }

    static func delete(portalId: String) {
        defaults.removeObject(forKey: ctKey(portalId))
    }
}
