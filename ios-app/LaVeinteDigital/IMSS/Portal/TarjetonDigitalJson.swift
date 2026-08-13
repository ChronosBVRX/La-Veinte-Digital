import Foundation

/// Parsing del resultado de `WKWebView.evaluateJavaScript`.
///
/// En iOS, WKWebView devuelve el resultado de `JSON.stringify(...)` como un
/// `String` directamente (a diferencia de Android, que doble-serializa). Estas
/// funciones parsean ese string JSON.
enum TarjetonDigitalJson {

    static func parseObject(_ raw: String?) -> [String: Any]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        return asDict(raw)
    }

    static func parseArray(_ raw: String?) -> [[String: Any]]? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        return asArray(raw)
    }

    /// Decodifica un resultado `JSON.stringify("string")` (o una cadena ya JSON).
    static func parseString(_ raw: String?) -> String? {
        guard let raw, raw != "null", raw != "undefined" else { return nil }
        return asString(raw)
    }

    // MARK: - Helpers

    private static func jsonValue(_ s: String) -> Any? {
        guard let data = s.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
    }

    private static func asDict(_ s: String) -> [String: Any]? {
        guard let value = jsonValue(s) else { return nil }
        return value as? [String: Any]
    }

    private static func asArray(_ s: String) -> [[String: Any]]? {
        guard let value = jsonValue(s) else { return nil }
        if let arr = value as? [[String: Any]] { return arr }
        if let arr = value as? [Any] {
            return arr.compactMap { $0 as? [String: Any] }
        }
        return nil
    }

    private static func asString(_ s: String) -> String? {
        guard let value = jsonValue(s) else { return nil }
        return value as? String
    }
}
