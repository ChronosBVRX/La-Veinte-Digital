import SwiftUI
import LocalAuthentication

/// Pantalla de desbloqueo biométrico (port de `BiometricUnlockScreen.kt`).
struct BiometricUnlockView: View {
    var onUnlocked: () -> Void
    var onCancel: () -> Void

    @EnvironmentObject var appLock: AppLockManager
    @State private var canAuth = BiometricManager.canAuthenticateStrong()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [BrandColors.brandNavy, BrandColors.brandBlue],
                startPoint: .leading,
                endPoint: .trailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 64))
                    .foregroundColor(.white)
                Spacer().frame(height: 24)
                Text("La Veinte Digital")
                    .font(.title2.bold())
                    .foregroundColor(.white)
                    .kerning(1)
                Spacer().frame(height: 8)
                Text("Desbloquea tu cuenta para continuar")
                    .font(.body)
                    .foregroundColor(.white.opacity(0.7))
                Spacer().frame(height: 48)

                if canAuth {
                    Button {
                        authenticate()
                    } label: {
                        Label("Usar \(BiometricManager.biometryLabel)", systemImage: "faceid")
                            .font(.headline)
                            .foregroundColor(BrandColors.brandNavy)
                            .frame(maxWidth: .infinity)
                            .frame(height: LvdTokens.dims.buttonHeight)
                            .background(Color.white)
                            .cornerRadius(LvdTokens.radius.button)
                    }
                    .padding(.horizontal, 32)

                    Spacer().frame(height: 16)

                    Button(action: onCancel) {
                        Text("Iniciar sesión de nuevo")
                            .foregroundColor(.white.opacity(0.6))
                    }
                } else {
                    Text("Sensor biométrico no disponible.\nPuedes continuar normalmente.")
                        .font(.footnote)
                        .foregroundColor(.white.opacity(0.6))
                        .multilineTextAlignment(.center)
                    Spacer().frame(height: 24)
                    Button {
                        appLock.unlock()
                        onUnlocked()
                    } label: {
                        Text("Continuar")
                            .font(.headline)
                            .foregroundColor(BrandColors.brandNavy)
                            .padding(.horizontal, 28)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .cornerRadius(LvdTokens.radius.button)
                    }
                }
            }
        }
    }

    private func authenticate() {
        appLock.startUnlock()
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            appLock.unlock()
            onUnlocked()
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Desbloquea tu cuenta para continuar"
        ) { success, _ in
            DispatchQueue.main.async {
                if success {
                    _ = BiometricKeyStore.readAuthenticated(context: context)
                    appLock.unlock()
                    onUnlocked()
                } else {
                    appLock.lock()
                    onCancel()
                }
            }
        }
    }
}
