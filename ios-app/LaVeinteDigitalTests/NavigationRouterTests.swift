import XCTest
@testable import LaVeinteDigital

final class NavigationRouterTests: XCTestCase {

    private func url(_ s: String) -> URL { URL(string: s)! }

    // MARK: - resolveForInternal (WebView interno)

    func testInternalHostStaysInternal() {
        for host in Domains.internalHosts {
            let target = NavigationRouter.resolveForInternal(url("https://\(host)/dashboard"))
            guard case .internalWeb = target else {
                return XCTFail("\(host) debía ser .internalWeb, fue \(target)")
            }
        }
    }

    func testExternalWebviewHostRoutesToExternal() {
        let target = NavigationRouter.resolveForInternal(url("https://www.imss.gob.mx/path"))
        guard case .externalWebview(let u) = target else {
            return XCTFail("imss.gob.mx debía ser .externalWebview")
        }
        XCTAssertEqual(u.absoluteString, "https://www.imss.gob.mx/path")
    }

    func testCustomTabHostRoutesToSafari() {
        let target = NavigationRouter.resolveForInternal(url("https://accounts.google.com/o/oauth"))
        guard case .customTab = target else {
            return XCTFail("accounts.google.com debía ser .customTab")
        }
    }

    func testIntentSchemesRouteToIntent() {
        for scheme in ["tel", "mailto", "whatsapp"] {
            let target = NavigationRouter.resolveForInternal(url("\(scheme):12345"))
            guard case .intent = target else {
                return XCTFail("\(scheme) debía ser .intent, fue \(target)")
            }
        }
    }

    func testBlockedSchemesAreBlocked() {
        for scheme in ["javascript", "file", "content", "about"] {
            let target = NavigationRouter.resolveForInternal(url("\(scheme):whatever"))
            guard case .blocked = target else {
                return XCTFail("\(scheme) debía ser .blocked, fue \(target)")
            }
        }
    }

    func testBridgeSchemeIsBlocked() {
        let target = NavigationRouter.resolveForInternal(url("laveinte://bridge/checkForUpdate"))
        guard case .blocked = target else {
            return XCTFail("laveinte:// debía ser .blocked")
        }
    }

    /// Comportamiento Android 7.3: host http(s) no listado se carga en el MISMO WebView.
    func testUnknownHostStaysInternal() {
        let target = NavigationRouter.resolveForInternal(url("https://ejemplo.com.mx/articulo"))
        guard case .internalWeb = target else {
            return XCTFail("host desconocido debía ser .internalWeb, fue \(target)")
        }
    }

    // MARK: - resolveForExternal (navegador externo integrado)

    func testExternalInternalHostReturnsToLaVeinte() {
        let target = NavigationRouter.resolveForExternal(url("https://la-veinte-digital.vercel.app/"))
        guard case .internalWeb = target else {
            return XCTFail("host interno debía devolver .internalWeb (volver a La Veinte)")
        }
    }

    func testExternalUnknownHostLoadsHere() {
        let target = NavigationRouter.resolveForExternal(url("https://www.sat.gob.mx/"))
        guard case .externalWebview = target else {
            return XCTFail("host externo debía ser .externalWebview")
        }
    }
}
