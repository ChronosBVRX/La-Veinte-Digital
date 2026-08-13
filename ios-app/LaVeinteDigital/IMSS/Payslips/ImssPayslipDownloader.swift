import CryptoKit
import Foundation

/// Descarga autenticada de PDFs desde portales IMSS (port de
/// `ImssPayslipDownloader.kt`). Se ejecuta desde el hilo principal vía async/await.
@MainActor
enum ImssPayslipDownloader {

    enum DownloadError: Error, LocalizedError {
        case httpError(Int)
        case invalidPdf
        case empty

        var errorDescription: String? {
            switch self {
            case .httpError: return "No se pudo descargar el PDF"
            case .invalidPdf: return "El archivo no es un PDF válido"
            case .empty: return "El PDF está vacío"
            }
        }
    }

    /// Devuelve el documento guardado; `wasDuplicate` indica si ya existía.
    static func download(url: URL, portal: ImssPortal) async throws -> (document: PayslipDocument, wasDuplicate: Bool) {
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue("LaVeinteDigitalIOS/\(AppInfo.version)", forHTTPHeaderField: "User-Agent")
        request.setValue("https://\(portal.host)/", forHTTPHeaderField: "Referer")

        if let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            request.setValue(
                HTTPCookie.requestHeaderFields(with: cookies)["Cookie"],
                forHTTPHeaderField: "Cookie"
            )
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw DownloadError.httpError(0) }
        guard http.statusCode == 200 else { throw DownloadError.httpError(http.statusCode) }

        guard data.count >= 5, String(data: data.prefix(5), encoding: .ascii) == "%PDF-" else {
            throw DownloadError.invalidPdf
        }
        guard !data.isEmpty else { throw DownloadError.empty }

        let sha = Self.sha256(data)

        // Dedupe por SHA-256.
        if PayslipStore.shared.findByHash(sha) != nil {
            return (PayslipDocument(source: portal.sourceValue, displayName: "", localPath: ""), true)
        }

        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Tarjetones", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let filename = "tarjeton_\(Int(Date().timeIntervalSince1970 * 1000)).pdf"
        let fileURL = dir.appendingPathComponent(filename)
        try data.write(to: fileURL, options: .atomic)

        let doc = PayslipDocument(
            source: portal.sourceValue,
            displayName: Self.displayName(from: url),
            localPath: fileURL.path,
            downloadedAt: Date(),
            fileSize: Int64(data.count),
            sha256: sha,
            mimeType: "application/pdf",
            sourceHost: portal.host
        )
        PayslipStore.shared.insert(doc)
        return (doc, false)
    }

    private static func displayName(from url: URL) -> String {
        let last = url.lastPathComponent
        return last.isEmpty ? "Tarjetón" : last
    }

    private static func sha256(_ data: Data) -> String {
        var hasher = SHA256()
        hasher.update(data: data)
        return hasher.finalize().map { String(format: "%02x", Int($0)) }.joined()
    }
}
