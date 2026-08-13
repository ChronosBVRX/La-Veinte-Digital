import Foundation
import WebKit

/// Puente JS. Inyecta `window.LaVeinteApp` con los MISMOS nombres que define
/// `src/types/global.d.ts` (y que inyecta `LaVeinteBridgeInjector.kt`).
///
/// Los callbacks viajan al nativo por `WKScriptMessageHandler` (nombre `laveinte`)
/// en lugar de interceptar URLs `laveinte://bridge/...`.
enum LaVeinteBridge {
    static let scheme = "laveinte"
    static let messageHandlerName = "laveinte"

    static func userScript() -> WKUserScript {
        let js = """
        (function() {
          if (window.LaVeinteApp) return;
          var post = function(msg) {
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.laveinte) {
                window.webkit.messageHandlers.laveinte.postMessage(msg);
              }
            } catch (e) {}
          };
          window.LaVeinteApp = {
            appPlatform: function() { return 'ios'; },
            appVersion: function() { return '\(AppInfo.version)'; },
            sdkVersion: function() { return \(AppInfo.sdkVersion); },
            packageName: function() { return '\(AppInfo.packageName)'; },
            isNativeApp: function() { return true; },
            hasBiometrics: function() { return false; },
            isBiometricsEnabled: function() { return false; },
            openExternal: function(url) { post({ path: 'openExternal', url: url }); },
            openOfficialPayslips: function() { post({ path: 'openOfficialPayslips' }); },
            checkForUpdate: function() { post({ path: 'checkForUpdate' }); },
            hasImssCredentials: function(portalId) { post({ path: 'hasImssCredentials', portalId: portalId }); return false; },
            onAuthenticated: function() { post({ path: 'onAuthenticated' }); },
            onLoggedOut: function() { post({ path: 'onLoggedOut' }); },
            pickPdf: function(hint) { post({ path: 'pickPdf', hint: hint }); },
            share: function(title, text) { post({ path: 'share', title: title, text: text }); },
            haptic: function() { post({ path: 'haptic' }); },
            log: function(msg) { console.log('[LaVeinte] ' + msg); }
          };
          window.dispatchEvent(new Event('laveinte:native-ready'));
        })();
        """
        return WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    }
}

/// Manejador global de callbacks del bridge (equivalente a `BridgeHandler.kt`).
/// Cada fase del producto fija los closures que le corresponden.
final class BridgeHandler {
    static let shared = BridgeHandler()

    var onOpenExternal: ((String) -> Void)?
    var onOpenOfficialPayslips: (() -> Void)?
    var onCheckForUpdate: (() -> Void)?
    var onAuthenticated: (() -> Void)?
    var onLoggedOut: (() -> Void)?
    var onHasImssCredentials: ((String) -> Void)?
    var onPickPdf: ((String?) -> Void)?
    var onShare: ((String?, String?) -> Void)?
    var onHaptic: (() -> Void)?

    private init() {}

    func didReceive(_ message: [String: Any]) {
        guard let path = message["path"] as? String else { return }
        switch path {
        case "openExternal":
            onOpenExternal?(message["url"] as? String ?? "")
        case "openOfficialPayslips":
            onOpenOfficialPayslips?()
        case "checkForUpdate":
            onCheckForUpdate?()
        case "onAuthenticated":
            onAuthenticated?()
        case "onLoggedOut":
            onLoggedOut?()
        case "hasImssCredentials":
            onHasImssCredentials?(message["portalId"] as? String ?? "")
        case "pickPdf":
            onPickPdf?(message["hint"] as? String)
        case "share":
            onShare?(message["title"] as? String, message["text"] as? String)
        case "haptic":
            onHaptic?()
        default:
            break
        }
    }
}
