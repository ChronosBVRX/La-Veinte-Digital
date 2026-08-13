import SwiftUI

/// Historial de tarjetones (port de `PayslipHistoryScreen.kt`).
struct PayslipHistoryView: View {
    @EnvironmentObject var router: AppRouter
    @ObservedObject private var store = PayslipStore.shared

    @State private var deleteTarget: PayslipDocument?
    @State private var shareTarget: PayslipDocument?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    router.path.removeLast()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }
                Text("Mis tarjetones")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.navy)

            if store.documents.isEmpty {
                VStack(spacing: 8) {
                    Text("Sin tarjetones guardados")
                        .font(.body.weight(.medium))
                        .foregroundColor(LvdColors.textPrimary)
                    Text("Los PDF que descargues desde los portales IMSS aparecerán aquí.")
                        .font(.footnote)
                        .foregroundColor(LvdColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(LvdColors.background)
            } else {
                List {
                    ForEach(store.getAll()) { doc in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(doc.displayName)
                                    .font(.subheadline.weight(.medium))
                                    .lineLimit(1)
                                Text(subtitle(for: doc))
                                    .font(.footnote)
                                    .foregroundColor(LvdColors.textSecondary)
                            }
                            Spacer()
                            Button {
                                router.path.append(.payslipViewer(path: doc.localPath, title: doc.displayName))
                            } label: {
                                Image(systemName: "eye")
                                    .foregroundColor(LvdColors.blue)
                            }
                            .buttonStyle(.borderless)
                            Menu {
                                Button { shareTarget = doc } label: {
                                    Label("Compartir", systemImage: "square.and.arrow.up")
                                }
                                Button(role: .destructive) { deleteTarget = doc } label: {
                                    Label("Eliminar", systemImage: "trash")
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .foregroundColor(LvdColors.textMuted)
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .alert(
            "Eliminar tarjetón",
            isPresented: Binding(
                get: { deleteTarget != nil },
                set: { if !$0 { deleteTarget = nil } }
            ),
            presenting: deleteTarget
        ) { doc in
            Button("Eliminar", role: .destructive) {
                store.delete(doc)
                try? FileManager.default.removeItem(atPath: doc.localPath)
                deleteTarget = nil
            }
            Button("Cancelar", role: .cancel) { deleteTarget = nil }
        } message: { _ in
            Text("Se eliminará únicamente de este dispositivo.")
        }
        .sheet(item: $shareTarget) { doc in
            ShareSheet(items: [URL(fileURLWithPath: doc.localPath)])
        }
    }

    private func subtitle(for doc: PayslipDocument) -> String {
        let source = doc.source == "TU_PERFIL" ? "Tu Perfil IMSS" : "Tarjetón Digital"
        let formatter = DateFormatter()
        formatter.dateFormat = "dd MMM yyyy"
        formatter.locale = Locale(identifier: "es_MX")
        let sizeKB = max(1, Int(doc.fileSize / 1024))
        return "\(source) · \(formatter.string(from: doc.downloadedAt)) · \(sizeKB) KB"
    }
}
