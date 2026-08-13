import Foundation
import WebKit

/// Estado observable del navegador externo (back/forward/título).
final class WebViewState: ObservableObject {
    @Published var canGoBack = false
    @Published var title = ""

    weak var webView: WKWebView? {
        didSet { observe() }
    }

    private var observers: [NSKeyValueObservation] = []

    private func observe() {
        observers.removeAll()
        guard let webView else { return }
        observers.append(webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.canGoBack = wv.canGoBack }
        })
        observers.append(webView.observe(\.title, options: [.initial, .new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.title = wv.title ?? "" }
        })
    }

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
}
