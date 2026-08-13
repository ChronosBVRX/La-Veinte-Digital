import SwiftUI

/// Guardar credenciales IMSS (port de `SaveImssCredentialsScreen.kt`).
struct SaveImssCredentialsView: View {
    let portal: ImssPortal

    @EnvironmentObject var router: AppRouter
    @State private var username = ""
    @State private var password = ""
    @State private var delegacion: TarjetonDigitalDelegaciones.Delegacion?
    @State private var saving = false

    private var canSave: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button { router.path.removeLast() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }
                Text(portal.displayName)
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.navy)

            ScrollView {
                VStack(spacing: 16) {
                    Text("Guarda tus credenciales para entrar más rápido. Se cifran en este dispositivo y nunca se suben a ningún servidor.")
                        .font(.footnote)
                        .foregroundColor(LvdColors.textSecondary)

                    if portal == .tarjetonDigital {
                        Picker("Delegación", selection: $delegacion) {
                            Text("Selecciona una delegación").tag(TarjetonDigitalDelegaciones.Delegacion?.none)
                            ForEach(TarjetonDigitalDelegaciones.fallback, id: \.value) { d in
                                Text(d.displayName).tag(TarjetonDigitalDelegaciones.Delegacion?.some(d))
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    LvdTextField(placeholder: "Usuario / matrícula", text: $username)
                    LvdTextField(placeholder: "Contraseña", text: $password, secure: true)

                    if !BiometricManager.canAuthenticateStrong() {
                        Text("Este dispositivo no tiene Face ID / Touch ID, por lo que no puedes guardar credenciales.")
                            .font(.footnote)
                            .foregroundColor(LvdColors.warning)
                    }

                    Button {
                        save()
                    } label: {
                        Text(saving ? "Guardando…" : "Guardar acceso")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: LvdTokens.dims.buttonHeight)
                            .background(LvdColors.blue)
                            .cornerRadius(LvdTokens.radius.button)
                    }
                    .disabled(!canSave || saving || !BiometricManager.canAuthenticateStrong())

                    Button("Saltar") {
                        router.path.append(.imssPortal(portal))
                    }
                    .foregroundColor(LvdColors.textSecondary)
                }
                .padding(16)
            }
            .background(LvdColors.background)
        }
    }

    private func save() {
        saving = true
        let d = delegacion
        let payload = ImssCredentialPayload(
            username: username.trimmingCharacters(in: .whitespaces),
            password: password,
            delegacionValue: d?.value,
            delegacionLabel: d?.label
        )
        let ok = ImssVaultManager.saveCredentials(portal: portal, payload: payload)
        saving = false
        if ok {
            router.path.append(.imssPortal(portal))
        }
    }
}
