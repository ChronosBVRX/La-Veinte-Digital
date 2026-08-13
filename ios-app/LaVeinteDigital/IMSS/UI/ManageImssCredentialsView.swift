import SwiftUI

/// Administrar accesos IMSS (port de `ManageImssCredentialsScreen.kt`).
struct ManageImssCredentialsView: View {
    @EnvironmentObject var router: AppRouter
    @State private var refresh = UUID()
    @State private var confirmDelete: ImssPortal?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button { router.path.removeLast() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }
                Text("Administrar accesos")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.navy)

            List {
                ForEach(ImssPortal.allCases, id: \.self) { portal in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(portal.displayName)
                                .font(.subheadline.weight(.semibold))
                            Text(ImssVaultManager.hasCredentials(portal: portal) ? "Acceso guardado" : "Sin acceso guardado")
                                .font(.caption)
                                .foregroundColor(LvdColors.textSecondary)
                        }
                        Spacer()
                        if ImssVaultManager.hasCredentials(portal: portal) {
                            Button(role: .destructive) { confirmDelete = portal } label: {
                                Text("Olvidar")
                                    .font(.footnote)
                            }
                            .buttonStyle(.borderless)
                        } else {
                            Button { router.path.append(.saveImssCredentials(portal)) } label: {
                                Text("Guardar")
                                    .font(.footnote)
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                    .id("\(portal.rawValue)-\(refresh)")
                }
            }
            .listStyle(.insetGrouped)
        }
        .alert("Olvidar acceso", isPresented: Binding(
            get: { confirmDelete != nil },
            set: { if !$0 { confirmDelete = nil } }
        ), presenting: confirmDelete) { portal in
            Button("Olvidar", role: .destructive) {
                ImssVaultManager.deleteCredentials(portal: portal)
                refresh = UUID()
                confirmDelete = nil
            }
            Button("Cancelar", role: .cancel) { confirmDelete = nil }
        } message: { portal in
            Text("Se eliminará el acceso guardado de \(portal.displayName) en este dispositivo.")
        }
    }
}
