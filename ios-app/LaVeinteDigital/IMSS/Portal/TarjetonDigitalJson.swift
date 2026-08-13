import Foundation

/// Parsing del resultado de `WKWebView.evaluateJavaScript`.
///
/// Acepta tanto un objeto/array directo como un string JSON con un nivel extra
/// (por si algún bridge intermedio lo re-serializa), centralizando el fix del
/// bug de doble serialización (`TarjetonDigitalJson.kt`).
enum TarjetonDigitalJson {

    static func parseObject(_ raw: String?) -> [String: Any]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        if let obj = decode([String: Any].self, from: raw) { return obj }
        if let str = decode(String.self, from: raw),
           let obj = decode([String: Any].self, from: str) { return obj }
        return nil
    }

    static func parseArray(_ raw: String?) -> [[String: Any]]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        if let arr = decode([[String: Any]].self, from: raw) { return arr }
        if let str = decode(String.self, from: raw),
           let arr = decode([[String: Any]].self, from: str) { return arr }
        return nil
    }

    /// Decodifica un resultado `JSON.stringify("string")` (o una cadena ya JSON).
    static func parseString(_ raw: String?) -> String? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        return decode(String.self, from: raw)
    }

    private static func decode<T>(_ type: T.Type, from s: String) -> T? {
        guard let data = s.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? T
    }
}
