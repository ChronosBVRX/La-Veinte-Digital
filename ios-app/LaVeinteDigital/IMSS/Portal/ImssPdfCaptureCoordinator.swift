import CryptoKit
import Foundation
import WebKit

/// Captura de PDFs de los portales IMSS (port de `ImssPdfCaptureCoordinator.kt`).
/// Doble vía: monitor de blobs JS (`__LVD_PDFS__`) y descarga HTTP autenticada.
@MainActor
final class ImssPdfCaptureCoordinator {

    static let shared = ImssPdfCaptureCoordinator()

    enum PdfCaptureEvent {
        case pdfDetected(sequence: Int, size: Int)
        case tarjetonSaved(documentId: String, localPath: String, wasDuplicate: Bool)
        case conceptsSaved
        case captureError(String)
    }

    private(set) var activeSession: TarjetonCaptureSession?
    var onEvent: ((PdfCaptureEvent) -> Void)?

    private var documentsDir: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    @discardableResult
    func startCaptureSession(
        portal: ImssPortal, ooadCode: String, ooadLabel: String,
        periodCode: String, periodLabel: String
    ) -> TarjetonCaptureSession? {
        guard activeSession == nil else { return nil }
        let session = TarjetonCaptureSession(
            id: UUID().uuidString,
            portalId: portal.rawValue,
            ooadCode: ooadCode,
            ooadLabel: ooadLabel,
            periodCode: periodCode,
            periodLabel: periodLabel
        )
        activeSession = session
        return session
    }

    func finishSession() { activeSession = nil }

    // MARK: - HTTP (reporte Tarjetón Digital)

    func captureReport(url: URL, portal: ImssPortal, ooadCode: String, ooadLabel: String, periodCode: String, periodLabel: String) {
        guard let session = startCaptureSession(
            portal: portal, ooadCode: ooadCode, ooadLabel: ooadLabel,
            periodCode: periodCode, periodLabel: periodLabel
        ) else { return }
        Task {
            do {
                let data = try await download(url: url, portal: portal)
                guard data.count >= 5, String(data: data.prefix(5), encoding: .ascii) == "%PDF-" else {
                    onEvent?(.captureError("REPORT_NOT_PDF")); finishSession(); return
                }
                guard let file = atomicWrite(dir: sessionDir(portal: portal, session: session), prefix: "tarjeton", data: data) else {
                    onEvent?(.captureError("REPORT_WRITE_FAILED")); finishSession(); return
                }
                let event = savePdf(portal: portal, session: session, file: file, data: data)
                finishSession()
                onEvent?(event)
            } catch {
                onEvent?(.captureError("REPORT_DOWNLOAD_FAILED"))
                finishSession()
            }
        }
    }

    // MARK: - Blob monitor

    func pollPdfCandidates(webView: WKWebView, portal: ImssPortal) async {
        let raw = await PortalFlowSupport.evalJs(webView, PortalScripts.pdfPoll)
        guard let obj = TarjetonDigitalJson.parseObject(raw),
              let b64 = obj["b64"] as? String, b64.count >= 20,
              let data = Data(base64Encoded: b64),
              data.count >= 5, String(data: data.prefix(5), encoding: .ascii) == "%PDF-" else { return }

        if let session = activeSession {
            session.pdfSequence += 1
            let seq = session.pdfSequence
            guard !session.processedSequences.contains(seq) else { return }
            session.processedSequences.insert(seq)

            let dir = sessionDir(portal: portal, session: session)
            if seq == 1 {
                onEvent?(.pdfDetected(sequence: seq, size: data.count))
                if let file = atomicWrite(dir: dir, prefix: "tarjeton", data: data) {
                    onEvent?(savePdf(portal: portal, session: session, file: file, data: data))
                }
            } else if seq == 2 {
                if let file = atomicWrite(dir: dir, prefix: "conceptos", data: data) {
                    associateConcepts(session: session, conceptsPath: file.path)
                    finishSession()
                }
                onEvent?(.conceptsSaved)
            }
        } else {
            let dir = documentsDir.appendingPathComponent("Tarjetones/\(portal.rawValue)", isDirectory: true)
            if let file = atomicWrite(dir: dir, prefix: "blob", data: data) {
                _ = insertGeneric(portal: portal, file: file, data: data)
            }
        }
    }

    // MARK: - Persistencia

    private func savePdf(portal: ImssPortal, session: TarjetonCaptureSession, file: URL, data: Data) -> PdfCaptureEvent {
        let sha = sha256(data)
        if let existing = PayslipStore.shared.findByHash(sha) {
            session.tarjetonDocumentId = existing.id
            let path = existing.localPath.isEmpty ? file.path : existing.localPath
            return .tarjetonSaved(documentId: existing.id, localPath: path, wasDuplicate: true)
        }
        let displayName = session.periodLabel.isEmpty ? "Tarjetón" : "Tarjetón — \(session.periodLabel)"
        let doc = PayslipDocument(
            source: portal.sourceValue,
            displayName: displayName,
            localPath: file.path,
            fileSize: Int64(data.count),
            sha256: sha,
            mimeType: "application/pdf",
            periodLabel: session.periodLabel.isEmpty ? nil : session.periodLabel,
            sourceHost: portal.host
        )
        PayslipStore.shared.insert(doc)
        session.tarjetonDocumentId = doc.id
        return .tarjetonSaved(documentId: doc.id, localPath: file.path, wasDuplicate: false)
    }

    private func insertGeneric(portal: ImssPortal, file: URL, data: Data) -> Bool {
        let doc = PayslipDocument(
            source: portal.sourceValue,
            displayName: file.lastPathComponent,
            localPath: file.path,
            fileSize: Int64(data.count),
            sha256: sha256(data),
            mimeType: "application/pdf",
            sourceHost: portal.host
        )
        return PayslipStore.shared.insert(doc)
    }

    private func associateConcepts(session: TarjetonCaptureSession, conceptsPath: String) {
        if let docId = session.tarjetonDocumentId {
            PayslipStore.shared.updateConceptsPath(id: docId, path: conceptsPath)
        } else if let latest = PayslipStore.shared.getAll().first {
            PayslipStore.shared.updateConceptsPath(id: latest.id, path: conceptsPath)
        }
    }

    // MARK: - Helpers

    private func download(url: URL, portal: ImssPortal) async throws -> Data {
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        request.setValue("LaVeinteDigitalIOS/\(AppInfo.version)", forHTTPHeaderField: "User-Agent")
        request.setValue("https://\(portal.host)/", forHTTPHeaderField: "Referer")
        if let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            request.setValue(HTTPCookie.requestHeaderFields(with: cookies)["Cookie"], forHTTPHeaderField: "Cookie")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private func sessionDir(portal: ImssPortal, session: TarjetonCaptureSession) -> URL {
        let dir = documentsDir.appendingPathComponent(
            "Tarjetones/\(portal.rawValue)/\(session.ooadCode)/\(session.periodCode)", isDirectory: true
        )
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func atomicWrite(dir: URL, prefix: String, data: Data) -> URL? {
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let sha = sha256(data)
        let final = dir.appendingPathComponent("\(prefix)_\(sha.prefix(8)).pdf")
        do {
            try data.write(to: final, options: .atomic)
            return final
        } catch {
            return nil
        }
    }

    private func sha256(_ data: Data) -> String {
        var hasher = SHA256()
        hasher.update(data: data)
        return hasher.finalize().map { String(format: "%02x", Int($0)) }.joined()
    }

    func cleanOrphans() {
        let dir = documentsDir.appendingPathComponent("Tarjetones", isDirectory: true)
        guard let enumerator = FileManager.default.enumerator(at: dir, includingPropertiesForKeys: nil) else { return }
        for case let file as URL in enumerator where file.pathExtension == "tmp" {
            try? FileManager.default.removeItem(at: file)
        }
    }
}
