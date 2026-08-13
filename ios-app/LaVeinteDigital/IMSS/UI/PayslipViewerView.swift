import PDFKit
import SwiftUI

/// Visor de PDF (port de `PayslipViewerScreen.kt`). PDFKit aporta zoom/pan
/// nativos, sustituyendo el motor de gestos manual de Android.
struct PayslipViewerView: View {
    let filePath: String
    let title: String

    @EnvironmentObject var router: AppRouter
    @State private var pageCount = 0
    @State private var currentPage = 0
    @State private var sharePresented = false

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
                Text(title)
                    .font(.headline)
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)
                Button {
                    sharePresented = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.navy)

            PDFViewRepresentable(
                filePath: filePath,
                pageCount: $pageCount,
                currentPage: $currentPage
            )
            .overlay(alignment: .bottom) {
                if pageCount > 0 {
                    Text("\(currentPage) / \(pageCount)")
                        .font(.footnote)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.5))
                        .clipShape(Capsule())
                        .padding(.bottom, 14)
                }
            }
        }
        .sheet(isPresented: $sharePresented) {
            ShareSheet(items: [URL(fileURLWithPath: filePath)])
        }
    }
}

private struct PDFViewRepresentable: UIViewRepresentable {
    let filePath: String
    @Binding var pageCount: Int
    @Binding var currentPage: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(pageCount: $pageCount, currentPage: $currentPage)
    }

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = .darkGray
        if let doc = PDFDocument(url: URL(fileURLWithPath: filePath)) {
            pdfView.document = doc
        }
        context.coordinator.pdfView = pdfView
        context.coordinator.startObserving()
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}

    final class Coordinator {
        weak var pdfView: PDFView?
        private var pageCount: Binding<Int>
        private var currentPage: Binding<Int>
        private var observers: [NSObjectProtocol] = []

        init(pageCount: Binding<Int>, currentPage: Binding<Int>) {
            self.pageCount = pageCount
            self.currentPage = currentPage
        }

        func startObserving() {
            let nc = NotificationCenter.default
            observers.append(nc.addObserver(
                forName: .PDFViewPageChanged, object: nil, queue: .main
            ) { [weak self] _ in
                self?.refresh()
            })
            observers.append(nc.addObserver(
                forName: .PDFViewDocumentChanged, object: nil, queue: .main
            ) { [weak self] _ in
                self?.refresh()
            })
            refresh()
        }

        private func refresh() {
            guard let doc = pdfView?.document else { return }
            pageCount.wrappedValue = doc.pageCount
            if let page = pdfView?.currentPage {
                currentPage.wrappedValue = doc.index(for: page) + 1
            }
        }

        deinit {
            observers.forEach(NotificationCenter.default.removeObserver)
        }
    }
}
