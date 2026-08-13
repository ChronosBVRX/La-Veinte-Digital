import SwiftUI
import UIKit
import WebKit

/// WebView interno persistente (equivalente a `InternalWebScreen.kt`).
/// Carga siempre el Home web y aplica el bridge JS.
struct InternalWebView: UIViewRepresentable {
    static let defaultURL = URL(string: "https://la-veinte-digital.vercel.app")!

    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var appLock: AppLockManager

    func makeCoordinator() -> Coordinator {
        Coordinator(router: router, appLock: appLock)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = "LaVeinteDigitalIOS/\(AppInfo.version)"

        let userContent = configuration.userContentController
        userContent.addUserScript(LaVeinteBridge.userScript())
        userContent.add(context.coordinator, name: LaVeinteBridge.messageHandlerName)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = webView
        context.coordinator.wireBridge()
        router.internalWebView = webView

        webView.load(URLRequest(url: Self.defaultURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let router: AppRouter
        let appLock: AppLockManager
        weak var webView: WKWebView?

        init(router: AppRouter, appLock: AppLockManager) {
            self.router = router
            self.appLock = appLock
        }

        deinit {
            webView?.configuration.userContentController
                .removeScriptMessageHandler(forName: LaVeinteBridge.messageHandlerName)
        }

        func wireBridge() {
            BridgeHandler.shared.onOpenExternal = { [weak self] urlString in
                guard let url = URL(string: urlString) else { return }
                self?.router.route(NavigationRouter.resolveForExternal(url))
            }
            BridgeHandler.shared.onOpenOfficialPayslips = { [weak self] in
                self?.router.path.append(.officialPayslips)
            }
            BridgeHandler.shared.onCheckForUpdate = {
                // iOS no tiene OTA: no-op.
            }
            BridgeHandler.shared.onAuthenticated = { [weak self] in
                guard let self else { return }
                if !self.appLock.isBiometricEnabled && BiometricManager.canAuthenticateStrong() {
                    self.appLock.showEnrollmentInvite = true
                }
            }
            BridgeHandler.shared.onLoggedOut = { [weak self] in
                guard let self else { return }
                BiometricKeyStore.delete()
                BiometricPreferences.isEnabled = false
                self.appLock.isBiometricEnabled = false
                self.appLock.lock()
                self.appLock.showEnrollmentInvite = false
            }
        }

        // MARK: - WKScriptMessageHandler

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == LaVeinteBridge.messageHandlerName,
                  let dict = message.body as? [String: Any] else { return }
            BridgeHandler.shared.didReceive(dict)
        }

        // MARK: - WKNavigationDelegate

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            switch NavigationRouter.resolveForInternal(url) {
            case .internalWeb:
                decisionHandler(.allow)
            case .externalWebview(let ext):
                router.path.append(.external(ext))
                decisionHandler(.cancel)
            case .customTab(let ext):
                router.safariRoute = SafariRoute(url: ext)
                decisionHandler(.cancel)
            case .intent(let intentURL):
                UIApplication.shared.open(intentURL)
                decisionHandler(.cancel)
            case .blocked:
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            router.isOffline = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleLoadError(error as NSError)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            let ns = error as NSError
            if ns.code == NSURLErrorCancelled { return }
            handleLoadError(ns)
        }

        private func handleLoadError(_ error: NSError) {
            guard error.domain == NSURLErrorDomain else { return }
            let offline = [
                NSURLErrorNotConnectedToInternet,
                NSURLErrorNetworkConnectionLost,
                NSURLErrorCannotConnectToHost,
                NSURLErrorTimedOut,
                NSURLErrorDNSLookupFailed,
            ]
            if offline.contains(error.code) {
                router.isOffline = true
            }
        }
    }
}
