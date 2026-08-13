import XCTest
@testable import LaVeinteDigital

final class PortalParsersTests: XCTestCase {

    private func jsonString(_ s: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: s)
        return String(data: data, encoding: .utf8)!
    }

    // MARK: - TarjetonDigitalJson

    func testParseArrayDirect() {
        let arr = TarjetonDigitalJson.parseArray(#"[{"code":"2026015","fechas":"a","observaciones":"b"}]"#)
        XCTAssertEqual(arr?.count, 1)
        XCTAssertEqual(arr?[0]["code"] as? String, "2026015")
    }

    func testParseArrayDoubleSerialized() {
        let raw = jsonString(#"[{"code":"2026015","fechas":"a","observaciones":"b"}]"#)
        let arr = TarjetonDigitalJson.parseArray(raw)
        XCTAssertEqual(arr?.count, 1)
        XCTAssertEqual(arr?[0]["code"] as? String, "2026015")
    }

    func testParseArrayEmpty() {
        let arr = TarjetonDigitalJson.parseArray(jsonString("[]"))
        XCTAssertEqual(arr?.count, 0)
    }

    func testParseNull() {
        XCTAssertNil(TarjetonDigitalJson.parseArray(nil))
        XCTAssertNil(TarjetonDigitalJson.parseArray("null"))
        XCTAssertNil(TarjetonDigitalJson.parseObject(nil))
        XCTAssertNil(TarjetonDigitalJson.parseObject("null"))
    }

    func testParseObjectDoubleSerialized() {
        let raw = jsonString(#"{"page":"tarjeton","message":""}"#)
        let obj = TarjetonDigitalJson.parseObject(raw)
        XCTAssertEqual(obj?["page"] as? String, "tarjeton")
    }

    // MARK: - TarjetonDigitalLoginErrorParser

    func testClassifyInvalidCredentials() {
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Contraseña incorrecta, intenté nuevamente"), .invalidCredentials)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Datos del usuario incorrectos, favor de validar"), .invalidCredentials)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Trabajador no encontrado en la delegación seleccionada."), .invalidCredentials)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Usuario no encontrado es necesario realizar Nuevo Registro."), .invalidCredentials)
    }

    func testClassifyMissingFields() {
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Es necesario seleccionar la delegación."), .missingFields)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Es necesario capturar el Usuario."), .missingFields)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Es necesario capturar la Contraseña."), .missingFields)
    }

    func testClassifyAccountLocked() {
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Trabajador no activo."), .accountLocked)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Administrador no activo o no autorizado."), .accountLocked)
    }

    func testClassifySessionExpired() {
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Su sesión ha expirado, \nPara continuar debe firmarse nuevamente"), .sessionExpired)
    }

    func testClassifyServiceUnavailable() {
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("No es posible acceder a la página. Intente más tarde."), .serviceUnavailable)
        XCTAssertEqual(TarjetonDigitalLoginErrorParser.classify("Sistema ocupado, favor de intentarlo mas tarde."), .serviceUnavailable)
    }

    func testClassifyPortalError() {
        let r = TarjetonDigitalLoginErrorParser.classify("Tipo de Contratación no permitido.")
        XCTAssertEqual(r, .portalError("Tipo de Contratación no permitido."))
    }

    func testClassifyUnknown() {
        guard case .unknownError = TarjetonDigitalLoginErrorParser.classify("Cualquier mensaje raro del portal") else {
            return XCTFail("debía ser unknownError")
        }
    }

    func testClassifyNilOrEmpty() {
        XCTAssertNil(TarjetonDigitalLoginErrorParser.classify(nil))
        XCTAssertNil(TarjetonDigitalLoginErrorParser.classify(""))
        XCTAssertNil(TarjetonDigitalLoginErrorParser.classify("   "))
    }

    func testIsPortalFault() {
        XCTAssertTrue(TarjetonDigitalLoginErrorParser.isPortalFault(.serviceUnavailable))
        XCTAssertTrue(TarjetonDigitalLoginErrorParser.isPortalFault(.sessionExpired))
        XCTAssertFalse(TarjetonDigitalLoginErrorParser.isPortalFault(.invalidCredentials))
        XCTAssertFalse(TarjetonDigitalLoginErrorParser.isPortalFault(.missingFields))
    }

    func testNormalize() {
        XCTAssertEqual(
            TarjetonDigitalLoginErrorParser.normalize(" Es necesario capturar la Contraseña.  "),
            "es necesario capturar la contrasena."
        )
    }

    // MARK: - TarjetonDigitalDelegaciones

    func testPrettify() {
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("MICHOACAN"), "Michoacán")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("NUEVO LEON"), "Nuevo León")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("QUERETARO"), "Querétaro")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("ESTADO DE MEXICO ORIENTE"), "Estado de México Oriente")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("SAN LUIS POTOSI"), "San Luis Potosí")
    }

    func testPrettifyParticles() {
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("BAJA CALIFORNIA SUR"), "Baja California Sur")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("VERACRUZ NORTE"), "Veracruz Norte")
        XCTAssertEqual(TarjetonDigitalDelegaciones.prettify("OFICINAS CENTRALES"), "Oficinas Centrales")
    }

    func testFallbackCatalog() {
        let michoacan = TarjetonDigitalDelegaciones.fallback.first { $0.label == "MICHOACAN" }
        XCTAssertEqual(michoacan?.value, "17")
        XCTAssertEqual(michoacan?.displayName, "Michoacán")
        XCTAssertEqual(TarjetonDigitalDelegaciones.fallback.count, 38)
    }

    // MARK: - PeriodParser

    func testPeriodParse() {
        let p = PeriodParser.parse("2026015 (1ra - ENERO)")
        XCTAssertTrue(p.parsed)
        XCTAssertEqual(p.code, "2026015")
        XCTAssertEqual(p.year, 2026)
        XCTAssertEqual(p.half, 1)
        XCTAssertEqual(p.month, "enero")
        XCTAssertEqual(p.displayLabel, "1ª quincena de enero de 2026")
    }

    func testPeriodParseUnparsed() {
        let p = PeriodParser.parse("sin formato")
        XCTAssertFalse(p.parsed)
        XCTAssertEqual(p.code, "sin formato")
    }

    func testLatestPeriod() {
        let a = PeriodParser.parse("2026015 (1ra - ENERO)")
        let b = PeriodParser.parse("2027001 (1ra - ENERO)")
        XCTAssertEqual(PeriodParser.latestPeriod([a, b])?.code, "2027001")
    }

    func testParseOoadCode() {
        XCTAssertEqual(PeriodParser.parseOoadCode("17 - MICHOACAN"), "17")
        XCTAssertNil(PeriodParser.parseOoadCode("MICHOACAN"))
    }
}
