import SwiftUI
import UIKit
import WebKit

/// WebView del portal IMSS (port de la vista WebView de `ImssPortalScreen.kt`).
/// Comparte cookies, inyecta el monitor de PDFs y el bridge de reporte.
struct PortalWebView: UIViewRepresentable {
    let portal: ImssPortal
    let onReady: (WKWebView) -> Void
    let onReport: (String) -> Void
    let onAlert: (String) -> Void

    @EnvironmentObject var router: AppRouter

    func makeCoordinator() -> Coordinator {
        Coordinator(portal: portal, onReady: onReady, onReport: onReport, onAlert: onAlert, router: router)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let userContent = configuration.userContentController
        userContent.addUserScript(reportBridgeScript)
        userContent.addUserScript(
            WKUserScript(source: PortalScripts.pdfMonitor, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        userContent.add(context.coordinator, name: "portal")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.webView = webView

        webView.load(URLRequest(url: URL(string: portal.loginURL)!))
        onReady(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    private var reportBridgeScript: WKUserScript {
        let js = """
        (function(){
          window.TarjetonDigitalBridge = {
            onReport: function(url) {
              try { window.webkit.messageHandlers.portal.postMessage({path:'report', url: url}); } catch(e) {}
            }
          };
        })();
        """
        return WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let portal: ImssPortal
        let onReady: (WKWebView) -> Void
        let onReport: (String) -> Void
        let onAlert: (String) -> Void
        let router: AppRouter
        weak var webView: WKWebView?

        init(
            portal: ImssPortal,
            onReady: @escaping (WKWebView) -> Void,
            onReport: @escaping (String) -> Void,
            onAlert: @escaping (String) -> Void,
            router: AppRouter
        ) {
            self.portal = portal
            self.onReady = onReady
            self.onReport = onReport
            self.onAlert = onAlert
            self.router = router
        }

        deinit {
            webView?.configuration.userContentController.removeScriptMessageHandler(forName: "portal")
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "portal", let dict = message.body as? [String: Any] else { return }
            if dict["path"] as? String == "report", let url = dict["url"] as? String {
                onReport(url)
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            guard let host = url.host?.lowercased() else {
                decisionHandler(.allow)
                return
            }
            if host == portal.host || host.hasSuffix(".imss.gob.mx") || host.hasSuffix(".gob.mx") {
                decisionHandler(.allow)
                return
            }
            switch NavigationRouter.resolveForExternal(url) {
            case .customTab(let u): router.safariRoute = SafariRoute(url: u)
            case .externalWebview(let u): router.path.append(.external(u))
            case .intent(let u): UIApplication.shared.open(u)
            default: break
            }
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            onAlert(message)
            completionHandler()
        }
    }
}
