import Foundation
import WebKit

enum TarjetonDigitalFlowState: Equatable {
    case checkingSession
    case loginRequired
    case loadingPage
    case waitingIframe
    case waitingDom
    case fillingForm
    case verifyingForm
    case submitting
    case waitingAuthResult
    case authenticated
    case manualMode
    case openingTarjetonPage
    case tarjetonReady(periods: [TarjetonPeriod], selectedPeriod: TarjetonPeriod?, delegaciones: [TarjetonDigitalDelegaciones.Delegacion])
    case generatingTarjeton
    case savingTarjeton
    case tarjetonSaved(documentId: String, localPath: String, wasDuplicate: Bool, periodLabel: String)
    case loginError(result: TarjetonDigitalLoginResult, portalMessage: String?)
    case error(reason: String)
    case tarjetonError(reason: String)
}

/// Controlador del flujo Tarjetón Digital IMSS (port de
/// `TarjetonDigitalFlowController.kt`).
@MainActor
final class TarjetonDigitalFlowController: ObservableObject {

    enum TarjetonTipo: String {
        case tarjeton = "rdoTarjeton"
        case conceptos = "rdoConceptos"
        case xml = "rdoXML"
    }

    @Published private(set) var state: TarjetonDigitalFlowState = .checkingSession

    weak var webView: WKWebView?

    var lastDelegacion: TarjetonDigitalDelegaciones.Delegacion?
    var lastUsername: String?
    @Published var delegaciones = TarjetonDigitalDelegaciones.fallback
    @Published var periods: [TarjetonPeriod] = []
    @Published var selectedPeriod: TarjetonPeriod?

    /// Callback que dispara la descarga del reporte PDF (lo fija la pantalla).
    var onReport: ((String) -> Void)?

    private var autoLoginAttempted = false
    private var loginTask: Task<Void, Never>?

    private static let loginURL = "https://rh.imss.gob.mx/Personal/TarjetonDigital/"
    private static let maxFillAttempts = 10
    private static let maxFieldsRequiredRetries = 3

    func attachWebView(_ wv: WKWebView) { webView = wv }

    func start() {
        state = .checkingSession
        runFlow()
    }

    func loginWithCredentials(
        delegacion: TarjetonDigitalDelegaciones.Delegacion,
        username: String,
        password: String,
        remember: Bool
    ) {
        if loginTask != nil { return }
        loginTask = Task {
            do {
                state = .loadingPage
                try await doLogin(delegacion: delegacion, username: username, password: password)
                if case .authenticated = state {
                    if remember {
                        _ = ImssVaultManager.saveCredentials(
                            portal: .tarjetonDigital,
                            payload: ImssCredentialPayload(
                                username: username, password: password,
                                delegacionValue: delegacion.value, delegacionLabel: delegacion.label
                            )
                        )
                    }
                } else if case .error = state {
                    state = .loginError(result: .unknownError(nil), portalMessage: nil)
                }
            } catch {
                state = .loginError(result: .unknownError(nil), portalMessage: nil)
            }
            loginTask = nil
        }
    }

    func reset() { autoLoginAttempted = false; state = .checkingSession }
    func retryLogin() {
        if loginTask != nil { return }
        autoLoginAttempted = false
        state = .checkingSession
        runFlow()
    }
    func manualEntry() { autoLoginAttempted = true; state = .manualMode }
    func reviewData() { autoLoginAttempted = true; state = .loginRequired }

    func retryTarjetonAutomation() {
        guard let wv = webView else { return }
        state = .openingTarjetonPage
        Task { await doOpenTarjetonPage(wv) }
    }

    func markGenerating() { state = .generatingTarjeton }
    func markSaving() { state = .savingTarjeton }
    func markTarjetonSaved(documentId: String, localPath: String, wasDuplicate: Bool, periodLabel: String) {
        state = .tarjetonSaved(documentId: documentId, localPath: localPath, wasDuplicate: wasDuplicate, periodLabel: periodLabel)
    }
    func markCaptureFailed() { state = .error(reason: "No pudimos guardar el tarjetón.") }

    func onPortalAlert(_ message: String?) {
        guard let message else { return }
        let result = TarjetonDigitalLoginErrorParser.classify(message)
        if result == .sessionExpired {
            state = .loginError(result: .sessionExpired, portalMessage: message)
        } else if message.hasPrefix("ERROR") || result == .serviceUnavailable {
            state = .loginError(result: .serviceUnavailable, portalMessage: message)
        }
    }

    func consultarTarjeton(period: TarjetonPeriod, tipo: TarjetonTipo) {
        guard let wv = webView else { return }
        selectedPeriod = period
        state = .generatingTarjeton
        Task {
            let r = await PortalFlowSupport.evalJs(wv, PortalScripts.tdGenerate(code: period.code, tipoId: tipo.rawValue))
            _ = TarjetonDigitalJson.parseObject(r)

            let saved = await PortalFlowSupport.pollUntil(ms: 45_000) {
                if case .tarjetonSaved = self.state { return true }
                return false
            }
            if !saved {
                ImssPdfCaptureCoordinator.shared.finishSession()
                markCaptureFailed()
            }
        }
    }

    // MARK: - Core flow

    private func runFlow() {
        guard let wv = webView else { return }
        Task {
            let snap = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdAuth))
            if snap?["page"] as? String == "tarjeton" {
                await doOpenTarjetonPage(wv)
                return
            }
            if !autoLoginAttempted {
                autoLoginAttempted = true
                if let payload = ImssVaultManager.decryptCredentials(portal: .tarjetonDigital),
                   !payload.username.isEmpty, !payload.password.isEmpty,
                   let deleg = resolveDelegacion(value: payload.delegacionValue, label: payload.delegacionLabel) {
                    lastUsername = payload.username
                    lastDelegacion = deleg
                    state = .loadingPage
                    try? await doLogin(delegacion: deleg, username: payload.username, password: payload.password)
                    return
                }
            }
            state = .loginRequired
        }
    }

    private func resolveDelegacion(value: String?, label: String?) -> TarjetonDigitalDelegaciones.Delegacion? {
        if let value, let found = delegaciones.first(where: { $0.value == value }) { return found }
        if let label, let found = delegaciones.first(where: { $0.label == label }) { return found }
        if let value { return TarjetonDigitalDelegaciones.Delegacion(value: value, label: label ?? value) }
        return nil
    }

    // MARK: - Login

    private func doLogin(delegacion: TarjetonDigitalDelegaciones.Delegacion, username: String, password: String) async throws {
        guard let wv = webView else { return }
        lastUsername = username
        lastDelegacion = delegacion
        wv.load(URLRequest(url: URL(string: Self.loginURL)!))
        state = .loadingPage

        state = .waitingIframe
        if !(await awaitIframe(wv)) { state = .error(reason: "IFRAME_TIMEOUT"); return }

        state = .waitingDom
        if !(await awaitDom(wv)) { state = .error(reason: "LOGIN_DOM_TIMEOUT"); return }

        await refreshDelegaciones(wv)

        var fieldsRequiredRetries = 0
        while true {
            state = .fillingForm
            if !(await fillAndVerify(wv, delegacion.value, username, password)) { state = .error(reason: "LOGIN_FILL_FAILED"); return }

            state = .verifyingForm
            if !(await valuesStillPresent(wv, delegacion.value, username, password)) { state = .error(reason: "LOGIN_VALUE_RESET"); return }

            state = .submitting
            let click = await clickIngresar(wv)
            if !click.ok { state = .error(reason: click.reason); return }

            state = .waitingAuthResult
            let (result, errorInfo) = await awaitAuth(wv)
            switch result {
            case .success:
                state = .authenticated
                await doOpenTarjetonPage(wv)
                return
            case .error:
                let parsed = errorInfo?.result ?? .unknownError(nil)
                if parsed == .missingFields && fieldsRequiredRetries < Self.maxFieldsRequiredRetries {
                    fieldsRequiredRetries += 1
                    continue
                }
                state = .loginError(result: parsed, portalMessage: errorInfo?.message)
                return
            case .timeout:
                state = .error(reason: "LOGIN_AUTH_TIMEOUT")
                return
            }
        }
    }

    private func awaitIframe(_ wv: WKWebView) async -> Bool {
        let ok = await PortalFlowSupport.pollUntil(ms: 10_000) {
            let s = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdSnapshot))
            return (s?["iframeFound"] as? Bool ?? false) && (s?["loginInputs"] as? Bool ?? false)
        }
        if ok { await PortalFlowSupport.evalJs(wv, PortalScripts.tdReportIntercept) }
        return ok
    }

    private func awaitDom(_ wv: WKWebView) async -> Bool {
        await PortalFlowSupport.pollUntil(ms: 10_000) {
            let s = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdSnapshot))
            return (s?["delegacionesReady"] as? Bool ?? false) && (s?["loginInputs"] as? Bool ?? false)
        }
    }

    private func refreshDelegaciones(_ wv: WKWebView) async {
        let raw = await PortalFlowSupport.evalJs(wv, PortalScripts.tdDelegaciones)
        guard let arr = TarjetonDigitalJson.parseArray(raw) else { return }
        var list: [TarjetonDigitalDelegaciones.Delegacion] = []
        for o in arr {
            let value = o["value"] as? String ?? ""
            let text = o["text"] as? String ?? ""
            if !value.isEmpty && value != "0" && !text.isEmpty {
                list.append(TarjetonDigitalDelegaciones.Delegacion(value: value, label: text))
            }
        }
        if !list.isEmpty { delegaciones = list }
    }

    private func fillAndVerify(_ wv: WKWebView, _ dv: String, _ u: String, _ p: String) async -> Bool {
        for _ in 0..<Self.maxFillAttempts {
            let r = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdFill(dv: dv, u: u, p: p)))
            if r?["ok"] as? Bool != true { try? await Task.sleep(nanoseconds: 250_000_000); continue }
            try? await Task.sleep(nanoseconds: 300_000_000)
            let v1 = await verify(wv, dv, u, p)
            if v1.ok && v1.canSubmit {
                try? await Task.sleep(nanoseconds: 200_000_000)
                let v2 = await verify(wv, dv, u, p)
                if v2.ok && v2.canSubmit { return true }
            }
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        return false
    }

    private func valuesStillPresent(_ wv: WKWebView, _ dv: String, _ u: String, _ p: String) async -> Bool {
        let v = await verify(wv, dv, u, p)
        return v.ok && v.canSubmit
    }

    private func verify(_ wv: WKWebView, _ dv: String, _ u: String, _ p: String) async -> (ok: Bool, canSubmit: Bool) {
        let r = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdVerify(dv: dv, u: u, p: p)))
        return (r?["ok"] as? Bool ?? false, r?["canSubmit"] as? Bool ?? false)
    }

    private func clickIngresar(_ wv: WKWebView) async -> (ok: Bool, reason: String) {
        let r = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdClick))
        if r?["ok"] as? Bool == true { return (true, "") }
        return (false, r?["reason"] as? String ?? "LOGIN_CLICK_FAILED")
    }

    private enum AuthResult { case success, error, timeout }
    private struct LoginErrorInfo { let result: TarjetonDigitalLoginResult; let message: String? }

    private func awaitAuth(_ wv: WKWebView) async -> (AuthResult, LoginErrorInfo?) {
        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < 30_000 {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard let j = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdAuth)) else { continue }
            if j["page"] as? String == "tarjeton" { return (.success, nil) }
            let message = (j["message"] as? String)?.trimmingCharacters(in: .whitespaces)
            if let parsed = TarjetonDigitalLoginErrorParser.classify(message) {
                return (.error, LoginErrorInfo(result: parsed, message: message))
            }
        }
        return (.timeout, nil)
    }

    // MARK: - Post-login

    private func doOpenTarjetonPage(_ wv: WKWebView) async {
        state = .openingTarjetonPage
        let pageOk = await PortalFlowSupport.pollUntil(ms: 20_000) {
            let j = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdAuth))
            return j?["page"] as? String == "tarjeton"
        }
        if !pageOk { state = .tarjetonError(reason: "TARJETON_NAV_TIMEOUT"); return }

        await PortalFlowSupport.evalJs(wv, PortalScripts.tdReportIntercept)

        let domOk = await PortalFlowSupport.pollUntil(ms: 15_000) {
            let j = TarjetonDigitalJson.parseObject(await PortalFlowSupport.evalJs(wv, PortalScripts.tdGenerarDom))
            return j?["ready"] as? Bool ?? false
        }
        if !domOk { state = .tarjetonError(reason: "TARJETON_DOM_TIMEOUT"); return }

        var periodsRaw = await awaitPeriods(wv, ms: 8_000)
        if periodsRaw.isEmpty {
            await PortalFlowSupport.evalJs(wv, PortalScripts.tdManualConsulta(u: lastUsername ?? ""))
            periodsRaw = await awaitPeriods(wv, ms: 20_000)
        }
        if periodsRaw.isEmpty {
            state = .tarjetonError(reason: "No encontramos tarjetones disponibles para tu cuenta.")
            return
        }
        periods = periodsRaw
        selectedPeriod = periods.first
        state = .tarjetonReady(periods: periods, selectedPeriod: selectedPeriod, delegaciones: delegaciones)
    }

    private func awaitPeriods(_ wv: WKWebView, ms: Int) async -> [TarjetonPeriod] {
        var last: [TarjetonPeriod] = []
        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < Double(ms) {
            try? await Task.sleep(nanoseconds: 500_000_000)
            last = await readPeriods(wv)
            if !last.isEmpty { return last }
        }
        return last
    }

    private func readPeriods(_ wv: WKWebView) async -> [TarjetonPeriod] {
        let raw = await PortalFlowSupport.evalJs(wv, PortalScripts.tdPeriods)
        guard let arr = TarjetonDigitalJson.parseArray(raw) else { return [] }
        var list: [TarjetonPeriod] = []
        for o in arr {
            list.append(TarjetonPeriod(
                code: o["code"] as? String ?? "",
                fechas: o["fechas"] as? String ?? "",
                observaciones: o["observaciones"] as? String ?? ""
            ))
        }
        return list
    }
}
