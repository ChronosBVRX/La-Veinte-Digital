import SwiftUI

/// Pantalla de sin conexión (equivalente a `OfflineErrorScreen.kt`).
struct OfflineErrorView: View {
    let onRetry: () -> Void

    var body: some View {
        ZStack {
            LvdColors.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 44))
                    .foregroundColor(LvdColors.textMuted)
                Text("Sin conexión")
                    .font(.title2.bold())
                    .foregroundColor(LvdColors.textPrimary)
                Text("Revisa tu conexión a internet e inténtalo de nuevo.")
                    .font(.subheadline)
                    .foregroundColor(LvdColors.textSecondary)
                    .multilineTextAlignment(.center)
                Button(action: onRetry) {
                    Text("Reintentar")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 14)
                        .background(LvdColors.blue)
                        .cornerRadius(LvdTokens.radius.button)
                }
            }
            .padding(24)
        }
    }
}
