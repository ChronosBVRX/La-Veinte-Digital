import Foundation

/// Parsing del resultado de `WKWebView.evaluateJavaScript`.
///
/// Acepta tanto un objeto/array directo como un string JSON con un nivel extra
/// (por si algún bridge intermedio lo re-serializa), centralizando el fix del
/// bug de doble serialización (`TarjetonDigitalJson.kt`).
enum TarjetonDigitalJson {

    static func parseObject(_ raw: String?) -> [String: Any]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        if let data = raw.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return obj
        }
        if let data = raw.data(using: .utf8),
           let str = try? JSONSerialization.jsonObject(with: data) as? String,
           let inner = str.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: inner) as? [String: Any] {
            return obj
        }
        return nil
    }

    static func parseArray(_ raw: String?) -> [[String: Any]]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        if let data = raw.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            return arr
        }
        if let data = raw.data(using: .utf8),
           let str = try? JSONSerialization.jsonObject(with: data) as? String,
           let inner = str.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: inner) as? [[String: Any]] {
            return arr
        }
        return nil
    }

    /// Decodifica un resultado `JSON.stringify("string")` (o una cadena ya JSON).
    static func parseString(_ raw: String?) -> String? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        if let data = raw.data(using: .utf8),
           let s = try? JSONSerialization.jsonObject(with: data) as? String {
            return s
        }
        return nil
    }
}
