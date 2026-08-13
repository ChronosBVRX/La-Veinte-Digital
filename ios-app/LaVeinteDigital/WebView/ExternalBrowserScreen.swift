import SwiftUI

/// Pantalla del navegador externo: barra superior navy + WKWebView.
struct ExternalBrowserScreen: View {
    let url: URL

    @EnvironmentObject var router: AppRouter
    @StateObject private var state = WebViewState()

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    state.goBack()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }
                .disabled(!state.canGoBack)
                .opacity(state.canGoBack ? 1 : 0.35)

                Text(state.title.isEmpty ? (url.host ?? "") : state.title)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)

                Button {
                    router.path.removeLast()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(LvdColors.navy)

            ExternalBrowserView(url: url, state: state)
        }
    }
}
