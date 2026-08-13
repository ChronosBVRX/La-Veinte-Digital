import XCTest
@testable import LaVeinteDigital

final class ImssVaultTests: XCTestCase {

    override func setUp() {
        super.setUp()
        for key in UserDefaults.standard.dictionaryRepresentation().keys
        where key.hasPrefix("imss_ct_") {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    func testPayloadCodableRoundTrip() throws {
        let payload = ImssCredentialPayload(
            username: "99999999",
            password: "secreto",
            delegacionValue: "17",
            delegacionLabel: "MICHOACAN"
        )
        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(ImssCredentialPayload.self, from: data)
        XCTAssertEqual(decoded, payload)
    }

    func testRepositorySaveReadDelete() {
        let data = Data("hola".utf8)
        ImssCredentialRepository.save(portalId: "tuperfil", combined: data)
        XCTAssertTrue(ImssCredentialRepository.hasCredentials(portalId: "tuperfil"))
        XCTAssertEqual(ImssCredentialRepository.read(portalId: "tuperfil"), data)

        ImssCredentialRepository.delete(portalId: "tuperfil")
        XCTAssertFalse(ImssCredentialRepository.hasCredentials(portalId: "tuperfil"))
    }
}
