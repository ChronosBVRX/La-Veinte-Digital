import Foundation
import WebKit

/// Soporte compartido de los controladores de flujo (async sobre WKWebView).
@MainActor
enum PortalFlowSupport {

    static func evalJs(_ wv: WKWebView, _ script: String) async -> String? {
        await withCheckedContinuation { cont in
            wv.evaluateJavaScript(script) { result, _ in
                cont.resume(returning: result as? String)
            }
        }
    }

    static func pollUntil(
        ms: Int,
        intervalNs: UInt64 = 500_000_000,
        _ check: @escaping () async -> Bool
    ) async -> Bool {
        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < Double(ms) {
            if await check() { return true }
            try? await Task.sleep(nanoseconds: intervalNs)
        }
        return false
    }
}
