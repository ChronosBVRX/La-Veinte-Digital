import Foundation

/// Store de documentos (sustituye a Room `PayslipDatabase`).
/// Almacena la lista como JSON en Documents. Usado solo desde el hilo principal.
final class PayslipStore: ObservableObject {
    @Published private(set) var documents: [PayslipDocument] = []

    static let shared = PayslipStore()

    private let fileURL: URL

    private init() {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = dir.appendingPathComponent("payslips.json")
        load()
    }

    var count: Int { documents.count }

    func getAll() -> [PayslipDocument] {
        documents.sorted { $0.downloadedAt > $1.downloadedAt }
    }

    func findByHash(_ hash: String) -> PayslipDocument? {
        guard !hash.isEmpty else { return nil }
        return documents.first { $0.sha256 == hash }
    }

    @discardableResult
    func insert(_ doc: PayslipDocument) -> Bool {
        if findByHash(doc.sha256) != nil { return false }
        documents.append(doc)
        persist()
        return true
    }

    func delete(_ doc: PayslipDocument) {
        documents.removeAll { $0.id == doc.id }
        persist()
    }

    func updateConceptsPath(id: String, path: String?) {
        guard let idx = documents.firstIndex(where: { $0.id == id }) else { return }
        documents[idx].conceptsPath = path
        persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let docs = try? JSONDecoder().decode([PayslipDocument].self, from: data) else { return }
        documents = docs
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(documents) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
