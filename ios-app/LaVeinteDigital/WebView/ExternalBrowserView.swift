import SwiftUI
import UIKit
import WebKit

/// Navegador externo integrado (equivalente a `ExternalBrowserScreen.kt`).
struct ExternalBrowserView: UIViewRepresentable {
    let url: URL
    let state: WebViewState

    @EnvironmentObject var router: AppRouter

    func makeCoordinator() -> Coordinator {
        Coordinator(router: router)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = webView
        state.webView = webView

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let router: AppRouter
        weak var webView: WKWebView?

        init(router: AppRouter) {
            self.router = router
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
            switch NavigationRouter.resolveForExternal(url) {
            case .internalWeb:
                router.path.removeLast()
                decisionHandler(.cancel)
            case .customTab(let ext):
                router.safariRoute = SafariRoute(url: ext)
                decisionHandler(.cancel)
            case .intent(let intentURL):
                UIApplication.shared.open(intentURL)
                decisionHandler(.cancel)
            case .externalWebview:
                decisionHandler(.allow)
            case .blocked:
                decisionHandler(.cancel)
            }
        }
    }
}
