import SwiftUI

struct RootView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var appLock: AppLockManager

    var body: some View {
        NavigationStack(path: $router.path) {
            InternalWebView()
                .navigationBarHidden(true)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .external(let url):
                        ExternalBrowserScreen(url: url)
                            .navigationBarHidden(true)
                    case .officialPayslips:
                        OfficialPayslipsView()
                            .navigationBarHidden(true)
                    case .payslipHistory:
                        PayslipHistoryView()
                            .navigationBarHidden(true)
                    case .payslipViewer(let path, let title):
                        PayslipViewerView(filePath: path, title: title)
                            .navigationBarHidden(true)
                    case .imssPortal(let portal):
                        ImssPortalView(portal: portal)
                            .navigationBarHidden(true)
                    case .saveImssCredentials(let portal):
                        SaveImssCredentialsView(portal: portal)
                            .navigationBarHidden(true)
                    case .manageImssCredentials:
                        ManageImssCredentialsView()
                            .navigationBarHidden(true)
                    }
                }
        }
        .sheet(item: $router.safariRoute) { route in
            SafariView(url: route.url)
                .ignoresSafeArea()
        }
        .overlay {
            if router.isOffline {
                OfflineErrorView { router.retryInternal() }
            }
        }
        .overlay {
            if appLock.state != .unlocked {
                BiometricUnlockView(
                    onUnlocked: {},
                    onCancel: { if !appLock.isBiometricEnabled { appLock.unlock() } }
                )
            }
        }
        .alert("Acceso más rápido", isPresented: $appLock.showEnrollmentInvite) {
            Button("Activar biometría") { enrollBiometrics() }
            Button("Ahora no", role: .cancel) {}
        } message: {
            Text("Usa tu rostro o huella para proteger y abrir La Veinte Digital. No guardamos tu contraseña.")
        }
        .preferredColorScheme(.light)
    }

    private func enrollBiometrics() {
        do {
            try BiometricKeyStore.enroll()
            BiometricPreferences.isEnabled = true
            appLock.isBiometricEnabled = true
        } catch {
            // Fallo silencioso: el usuario puede volver a intentarlo.
        }
    }
}
