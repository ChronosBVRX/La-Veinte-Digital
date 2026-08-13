import Foundation

enum NavigationTarget {
    case internalWeb
    case externalWebview(URL)
    case customTab(URL)
    case intent(URL)
    case blocked
}

/// Filtro puro de ruteo de URLs.
///
/// La lógica replica `LaVeinteInternalWebViewClient` (Android):
/// 1) bridge (laveinte://) → bloqueado (se maneja por message handler)
/// 2) esquemas bloqueados → bloqueado
/// 3) esquemas de intent → intent
/// 4) hosts custom-tab → custom tab
/// 5) hosts external-webview → navegador integrado
/// 6) todo lo demás http(s) → se carga en el MISMO WebView (internal)
enum NavigationRouter {

    static func resolveForInternal(_ url: URL) -> NavigationTarget {
        guard let scheme = url.scheme?.lowercased() else { return .blocked }
        if scheme == LaVeinteBridge.scheme { return .blocked }
        if Domains.blockedSchemes.contains(scheme) { return .blocked }
        if Domains.intentSchemes.contains(scheme) { return .intent(url) }
        guard scheme == "http" || scheme == "https" else { return .blocked }
        guard let host = url.host?.lowercased() else { return .internalWeb }
        if Domains.customTabHosts.contains(host) { return .customTab(url) }
        if Domains.externalWebviewHosts.contains(host) { return .externalWebview(url) }
        return .internalWeb
    }

    /// Usado por el navegador externo integrado (Android: `NavigationRouter.resolve`).
    static func resolveForExternal(_ url: URL) -> NavigationTarget {
        guard let scheme = url.scheme?.lowercased() else { return .blocked }
        if Domains.blockedSchemes.contains(scheme) { return .blocked }
        if Domains.intentSchemes.contains(scheme) { return .intent(url) }
        guard scheme == "http" || scheme == "https" else { return .blocked }
        guard let host = url.host?.lowercased() else { return .externalWebview(url) }
        if Domains.internalHosts.contains(host) { return .internalWeb }
        if Domains.customTabHosts.contains(host) { return .customTab(url) }
        return .externalWebview(url)
    }
}
