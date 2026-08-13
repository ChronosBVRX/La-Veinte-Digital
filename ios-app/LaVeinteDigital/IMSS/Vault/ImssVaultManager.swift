import Foundation

/// Orquesta guardar/leer/borrar credenciales (port de `ImssVaultManager.kt`).
///
/// Regla de seguridad: las credenciales IMSS NUNCA se suben a ningún servidor;
/// se cifran localmente y viven solo en el dispositivo.
enum ImssVaultManager {

    static func hasCredentials(portal: ImssPortal) -> Bool {
        ImssCredentialRepository.hasCredentials(portalId: portal.rawValue)
    }

    @discardableResult
    static func saveCredentials(portal: ImssPortal, payload: ImssCredentialPayload) -> Bool {
        do {
            _ = try ImssCredentialKeyStore.createKey(portalId: portal.rawValue)
            let data = try JSONEncoder().encode(payload)
            let combined = try ImssCredentialKeyStore.encrypt(portalId: portal.rawValue, plaintext: data)
            ImssCredentialRepository.save(portalId: portal.rawValue, combined: combined)
            return true
        } catch {
            return false
        }
    }

    static func decryptCredentials(portal: ImssPortal) -> ImssCredentialPayload? {
        guard let combined = ImssCredentialRepository.read(portalId: portal.rawValue) else {
            return nil
        }
        do {
            let data = try ImssCredentialKeyStore.decrypt(portalId: portal.rawValue, combined: combined)
            return try JSONDecoder().decode(ImssCredentialPayload.self, from: data)
        } catch {
            return nil
        }
    }

    static func deleteCredentials(portal: ImssPortal) {
        ImssCredentialKeyStore.deleteKey(portalId: portal.rawValue)
        ImssCredentialRepository.delete(portalId: portal.rawValue)
    }
}
