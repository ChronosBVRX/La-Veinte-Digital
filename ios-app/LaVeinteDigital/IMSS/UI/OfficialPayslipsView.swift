import SwiftUI

/// Hub "Tarjetones oficiales" (port de `OfficialPayslipsScreen.kt`).
@MainActor
struct OfficialPayslipsView: View {
    @EnvironmentObject var router: AppRouter
    @ObservedObject private var store = PayslipStore.shared

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    router.path.removeLast()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(LvdColors.textPrimary)
                }
                Text("Tarjetones oficiales")
                    .font(.headline)
                    .foregroundColor(LvdColors.textPrimary)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.surface)

            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ServiceCard(
                        title: "Tu Perfil IMSS",
                        subtitle: "Descarga tu tarjetón desde tu perfil",
                        icon: "person.crop.circle",
                        accent: BrandColors.brandBlue
                    ) {
                        router.path.append(.imssPortal(.tuPerfil))
                    }
                    ServiceCard(
                        title: "Tarjetón Digital",
                        subtitle: "Comprobante digital del IMSS",
                        icon: "doc.badge.gearshape",
                        accent: BrandColors.brandCyan
                    ) {
                        router.path.append(.imssPortal(.tarjetonDigital))
                    }
                    ServiceCard(
                        title: "Mis tarjetones",
                        subtitle: store.count == 1 ? "1 documento guardado" : "\(store.count) documentos guardados",
                        icon: "folder.fill",
                        accent: BrandColors.primary
                    ) {
                        router.path.append(.payslipHistory)
                    }
                    ServiceCard(
                        title: "Administrar accesos",
                        subtitle: credentialsSubtitle,
                        icon: "key.fill",
                        accent: LvdColors.info
                    ) {
                        router.path.append(.manageImssCredentials)
                    }
                }
                .padding(16)
            }
            .background(LvdColors.background)
        }
        .onAppear { ImssPdfCaptureCoordinator.shared.cleanOrphans() }
    }

    private var credentialsSubtitle: String {
        let saved = ImssPortal.allCases.filter { ImssVaultManager.hasCredentials(portal: $0) }
        return saved.isEmpty ? "Guardar credenciales IMSS" : "\(saved.count) acceso(s) guardado(s)"
    }
}

private struct ServiceCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(accent)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(LvdColors.textPrimary)
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(LvdColors.textSecondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                Spacer(minLength: 0)
                HStack {
                    Text("Abrir")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(accent)
                    Image(systemName: "arrow.right")
                        .font(.caption2)
                        .foregroundColor(accent)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
            .background(LvdColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: LvdTokens.radius.card)
                    .stroke(LvdColors.border, lineWidth: 1)
            )
            .cornerRadius(LvdTokens.radius.card)
        }
        .buttonStyle(.plain)
    }
}
