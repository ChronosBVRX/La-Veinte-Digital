import SwiftUI
import UIKit
import WebKit

enum Route: Hashable {
    case external(URL)
    case officialPayslips
    case payslipHistory
    case payslipViewer(path: String, title: String)
    case imssPortal(ImssPortal)
    case saveImssCredentials(ImssPortal)
    case manageImssCredentials
}

struct SafariRoute: Identifiable {
    let id = UUID()
    let url: URL
}

/// Estado global de navegación del shell (equivalente a la navegación Compose).
final class AppRouter: ObservableObject {
    @Published var path: [Route] = []
    @Published var safariRoute: SafariRoute?
    @Published var isOffline = false

    /// Referencia débil al WKWebView interno (para reintentos de conexión).
    weak var internalWebView: WKWebView?

    func retryInternal() {
        internalWebView?.reload()
    }

    func route(_ target: NavigationTarget) {
        switch target {
        case .internalWeb:
            break
        case .externalWebview(let url):
            path.append(.external(url))
        case .customTab(let url):
            safariRoute = SafariRoute(url: url)
        case .intent(let url):
            UIApplication.shared.open(url)
        case .blocked:
            break
        }
    }
}
