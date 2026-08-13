import SwiftUI
import WebKit

/// Pantalla de portal IMSS (port de `ImssPortalScreen.kt`).
/// WebView con cookies compartidas + controlador de flujo + captura de PDF.
@MainActor
struct ImssPortalView: View {
    let portal: ImssPortal

    @EnvironmentObject var router: AppRouter
    @StateObject private var tuPerfil = TuPerfilFlowController()
    @StateObject private var tarjeton = TarjetonDigitalFlowController()

    @State private var showLogin = false
    @State private var showTarjetonOverlay = false
    @State private var savedInfo: SavedTarjetonSheet?

    // Login dialog state
    @State private var username = ""
    @State private var password = ""
    @State private var remember = true
    @State private var delegacion: TarjetonDigitalDelegaciones.Delegacion?

    // Tarjetón Digital tipo
    @State private var tipo: TarjetonDigitalFlowController.TarjetonTipo = .tarjeton

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
                    .lineLimit(1)
                Spacer()
                Text(portal.host)
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.6))
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(LvdColors.navy)

            PortalWebView(
                portal: portal,
                onReady: { wv in
                    wireFlow(to: wv)
                },
                onReport: { url in
                    captureReport(url)
                },
                onAlert: { msg in
                    tarjeton.onPortalAlert(msg)
                }
            )
            .overlay(alignment: .bottom) { loadingOverlay }
        }
        .sheet(isPresented: $showLogin, onDismiss: {}) {
            loginSheet
        }
        .sheet(isPresented: $showTarjetonOverlay, onDismiss: {}) {
            tarjetonSheet
        }
        .sheet(item: $savedInfo) { info in
            info
        }
        .onChange(of: tuPerfil.state) { _ in syncState() }
        .onChange(of: tarjeton.state) { _ in syncState() }
    }

    // MARK: - Wiring

    private func wireFlow(to wv: WKWebView) {
        ImssPdfCaptureCoordinator.shared.onEvent = { event in
            switch event {
            case .pdfDetected:
                if portal == .tuPerfil { tuPerfil.markGenerating() }
            case .tarjetonSaved(let id, let path, let dup):
                if portal == .tuPerfil {
                    tuPerfil.markTarjetonSaved(documentId: id, localPath: path, wasDuplicate: dup, ooadLabel: tuPerfil.selectedOoad?.displayLabel ?? "", periodLabel: tuPerfil.selectedPeriod?.displayLabel ?? "")
                } else {
                    tarjeton.markTarjetonSaved(documentId: id, localPath: path, wasDuplicate: dup, periodLabel: tarjeton.selectedPeriod?.displayLabel ?? "")
                }
                savedInfo = SavedTarjetonSheet(title: "Tarjetón guardado", localPath: path)
            case .conceptsSaved:
                break
            case .captureError:
                if portal == .tuPerfil { tuPerfil.markCaptureFailed() } else { tarjeton.markCaptureFailed() }
            }
        }

        if portal == .tuPerfil {
            tuPerfil.attachWebView(wv)
            tuPerfil.start()
        } else {
            tarjeton.attachWebView(wv)
            tarjeton.onReport = { url in captureReport(url) }
            tarjeton.start()
        }
        startPdfPolling(wv)
    }

    private func startPdfPolling(_ wv: WKWebView) {
        Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                await ImssPdfCaptureCoordinator.shared.pollPdfCandidates(webView: wv, portal: portal)
            }
        }
    }

    private func captureReport(_ url: String) {
        guard let u = URL(string: url) else { return }
        let period = tarjeton.selectedPeriod
        ImssPdfCaptureCoordinator.shared.captureReport(
            url: u, portal: .tarjetonDigital,
            ooadCode: tarjeton.lastDelegacion?.value ?? "",
            ooadLabel: tarjeton.lastDelegacion?.displayName ?? "",
            periodCode: period?.code ?? "",
            periodLabel: period?.displayLabel ?? ""
        )
    }

    // MARK: - State sync

    private func syncState() {
        if portal == .tuPerfil {
            switch tuPerfil.state {
            case .loginRequired: showLogin = true
            case .ready: showTarjetonOverlay = true
            case .loginError, .error: showTarjetonOverlay = false
            default: break
            }
        } else {
            switch tarjeton.state {
            case .loginRequired, .manualMode: showLogin = true
            case .tarjetonReady: showTarjetonOverlay = true
            case .loginError, .error, .tarjetonError: showTarjetonOverlay = false
            default: break
            }
        }
    }

    private var isBusy: Bool {
        if portal == .tuPerfil {
            switch tuPerfil.state {
            case .waitingForm, .fillingForm, .verifyingForm, .submittingLogin, .waitingAuthentication,
                 .openingCardPage, .preparingCardForm, .generatingTarjeton:
                return true
            default: return false
            }
        } else {
            switch tarjeton.state {
            case .loadingPage, .waitingIframe, .waitingDom, .fillingForm, .verifyingForm, .submitting,
                 .waitingAuthResult, .openingTarjetonPage, .generatingTarjeton:
                return true
            default: return false
            }
        }
    }

    @ViewBuilder
    private var loadingOverlay: some View {
        if isBusy {
            VStack(spacing: 12) {
                ProgressView().tint(LvdColors.blue)
                Text("Preparando acceso…")
                    .font(.footnote)
                    .foregroundColor(LvdColors.textPrimary)
            }
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(LvdColors.surface)
        }
    }

    // MARK: - Login sheet

    private var loginSheet: some View {
        VStack(spacing: 16) {
            Text("Iniciar sesión")
                .font(.headline)
            if portal == .tarjetonDigital {
                Picker("Delegación", selection: $delegacion) {
                    Text("Selecciona una delegación")
                        .tag(TarjetonDigitalDelegaciones.Delegacion?.none)
                    ForEach(tarjeton.delegaciones, id: \.value) { d in
                        Text(d.displayName).tag(TarjetonDigitalDelegaciones.Delegacion?.some(d))
                    }
                }
                .pickerStyle(.menu)
            }
            LvdTextField(placeholder: "Usuario / matrícula", text: $username)
            LvdTextField(placeholder: "Contraseña", text: $password, secure: true)
            Toggle("Recordar mis datos", isOn: $remember).font(.footnote)

            Button {
                submitLogin()
            } label: {
                Text("Entrar")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: LvdTokens.dims.buttonHeight)
                    .background(LvdColors.blue)
                    .cornerRadius(LvdTokens.radius.button)
            }
            .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)

            if let reason = BiometricManager.unavailableReason() {
                Text(reason).font(.footnote).foregroundColor(LvdColors.warning)
            }
        }
        .padding(20)
    }

    private func submitLogin() {
        let u = username.trimmingCharacters(in: .whitespaces)
        showLogin = false
        if portal == .tuPerfil {
            tuPerfil.loginWithCredentials(username: u, password: password, remember: remember)
        } else {
            let d = delegacion ?? TarjetonDigitalDelegaciones.fallback.first { $0.value == "17" }
            if let d {
                tarjeton.loginWithCredentials(delegacion: d, username: u, password: password, remember: remember)
            }
        }
    }

    // MARK: - Tarjetón sheet

    private var tarjetonSheet: some View {
        VStack(spacing: 16) {
            Text("Consultar tarjetón").font(.headline)
            if portal == .tuPerfil {
                Text("Tu Perfil IMSS")
                    .font(.footnote.weight(.medium))
                    .foregroundColor(LvdColors.blue)
                if let p = tuPerfil.selectedPeriod {
                    Text("Periodo: \(p.displayLabel)")
                        .font(.footnote)
                        .foregroundColor(LvdColors.textSecondary)
                }
                Button {
                    consultarTuPerfil()
                } label: {
                    Text("Consultar tarjetón")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: LvdTokens.dims.buttonHeight)
                        .background(LvdColors.blue)
                        .cornerRadius(LvdTokens.radius.button)
                }
            } else {
                Picker("Periodo", selection: $tarjeton.selectedPeriod) {
                    ForEach(tarjeton.periods, id: \.code) { p in
                        Text(p.displayLabel).tag(TarjetonPeriod?.some(p))
                    }
                }
                .pickerStyle(.menu)
                Picker("Tipo de comprobante", selection: $tipo) {
                    Text("Tarjetón de Pago").tag(TarjetonDigitalFlowController.TarjetonTipo.tarjeton)
                    Text("Listado de Conceptos").tag(TarjetonDigitalFlowController.TarjetonTipo.conceptos)
                    Text("XML").tag(TarjetonDigitalFlowController.TarjetonTipo.xml)
                }
                .pickerStyle(.menu)
                Button {
                    if let p = tarjeton.selectedPeriod {
                        tarjeton.consultarTarjeton(period: p, tipo: tipo)
                    }
                } label: {
                    Text("Consultar tarjetón")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: LvdTokens.dims.buttonHeight)
                        .background(LvdColors.blue)
                        .cornerRadius(LvdTokens.radius.button)
                }
            }
        }
        .padding(20)
    }

    private func consultarTuPerfil() {
        guard let period = tuPerfil.selectedPeriod, let wv = tuPerfil.webView else { return }
        let session = ImssPdfCaptureCoordinator.shared.startCaptureSession(
            portal: .tuPerfil,
            ooadCode: tuPerfil.selectedOoad?.code ?? "17",
            ooadLabel: tuPerfil.selectedOoad?.displayLabel ?? "Michoacán",
            periodCode: period.code,
            periodLabel: period.displayLabel
        )
        guard session != nil else { return }
        tuPerfil.markGenerating()
        Task {
            await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilSearch(code: period.code))
        }
        Task {
            try? await Task.sleep(nanoseconds: 45_000_000_000)
            if ImssPdfCaptureCoordinator.shared.activeSession?.tarjetonDocumentId == nil {
                ImssPdfCaptureCoordinator.shared.finishSession()
                tuPerfil.markCaptureFailed()
            }
        }
    }
}

// MARK: - Saved sheet

private struct SavedTarjetonSheet: View, Identifiable {
    let title: String
    let localPath: String

    var id: String { localPath }
    @EnvironmentObject var router: AppRouter
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44))
                .foregroundColor(LvdColors.success)
            Text(title)
                .font(.headline)
            Text("Guardado en este dispositivo y disponible sin conexión.")
                .font(.footnote)
                .foregroundColor(LvdColors.textSecondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                Button {
                    dismiss()
                    router.path.append(.payslipViewer(path: localPath, title: "Tarjetón"))
                } label: {
                    Text("Ver tarjetón")
                        .font(.headline)
                        .foregroundColor(LvdColors.blue)
                }
                Button("Histórico") {
                    dismiss()
                    router.path.append(.payslipHistory)
                }
                .foregroundColor(LvdColors.textSecondary)
            }
        }
        .padding(20)
    }
}
