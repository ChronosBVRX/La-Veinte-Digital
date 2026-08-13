import XCTest
@testable import LaVeinteDigital

final class PayslipDocumentTests: XCTestCase {

    func testDocumentCodableRoundTrip() throws {
        let doc = PayslipDocument(
            source: "TU_PERFIL",
            displayName: "tarjeton.pdf",
            localPath: "/tmp/tarjeton.pdf",
            fileSize: 1024,
            sha256: "abc123",
            mimeType: "application/pdf",
            periodLabel: "2026-07",
            conceptsPath: "/tmp/conceptos.pdf",
            sourceHost: "tuperfil.imss.gob.mx"
        )
        let data = try JSONEncoder().encode(doc)
        let decoded = try JSONDecoder().decode(PayslipDocument.self, from: data)
        XCTAssertEqual(decoded.id, doc.id)
        XCTAssertEqual(decoded.sha256, "abc123")
        XCTAssertEqual(decoded.source, "TU_PERFIL")
    }
}
