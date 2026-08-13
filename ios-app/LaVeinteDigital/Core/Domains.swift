import Foundation

/// Allowlists de hosts. MANTENER EN SINCRONÍA con
/// `android-app/.../routing/Domains.kt`.
enum Domains {

    /// Hosts de La Veinte Digital (se cargan en el WebView interno persistente).
    static let internalHosts: Set<String> = [
        "la-veinte-digital.vercel.app",
        "laveinte-digital.vercel.app",
        "la-veinte-digital.pages.dev",
        "la-veinte-digital.localhost",
    ]

    /// Sitios de gobierno/SNTSS que se muestran dentro del navegador integrado.
    static let externalWebviewHosts: Set<String> = [
        "imss.gob.mx",
        "www.imss.gob.mx",
        "sat.gob.mx",
        "www.sat.gob.mx",
        "sntss.org.mx",
        "www.sntss.org.mx",
        "gob.mx",
        "www.gob.mx",
        "stps.gob.mx",
        "www.stps.gob.mx",
        "condusef.gob.mx",
        "www.condusef.gob.mx",
        "infonavit.gob.mx",
        "www.infonavit.gob.mx",
        "prosperabit.gob.mx",
        "www.prosperabit.gob.mx",
    ]

    /// OAuth/bancos que deben abrirse en SFSafariViewController (Custom Tabs).
    static let customTabHosts: Set<String> = [
        "accounts.google.com",
        "accounts.youtube.com",
        "login.microsoftonline.com",
        "login.live.com",
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "fb.com",
        "www.fb.com",
        "auth.twitter.com",
        "twitter.com",
        "x.com",
        "www.x.com",
        "appleid.apple.com",
        "github.com",
        "oauth.telegram.org",
        "mercadopago.com.mx",
        "www.mercadopago.com.mx",
        "checkout.stripe.com",
        "pay.stripe.com",
        "api.telegram.org",
        "wa.me",
        "www.wa.me",
    ]

    /// Esquemas que se abren con una app externa.
    static let intentSchemes: Set<String> = [
        "tel", "mailto", "sms", "smsto", "geo", "whatsapp",
        "intent", "market", "vnd.youtube", "maps", "lyft", "uber", "waze",
    ]

    /// Esquemas que nunca se abren.
    static let blockedSchemes: Set<String> = [
        "javascript", "file", "content", "about",
    ]
}
