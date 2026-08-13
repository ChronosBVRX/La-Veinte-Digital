import Foundation
import WebKit

enum PortalLoginErrorKind {
    case fieldsRequired
    case badCredentials
    case accountLockedOrUnregistered
    case serviceUnavailable
    case unknown
    case timeout
}

enum TuPerfilFlowState: Equatable {
    case checkingSession
    case loginRequired
    case waitingForm
    case fillingForm
    case verifyingForm
    case submittingLogin
    case waitingAuthentication
    case authenticated
    case openingCardPage
    case preparingCardForm
    case ready(ooadOptions: [PortalOoad], selectedOoad: PortalOoad?, periodOptions: [ImssPeriodOption], selectedPeriod: ImssPeriodOption?)
    case generatingTarjeton
    case savingTarjeton
    case tarjetonSaved(documentId: String, localPath: String, wasDuplicate: Bool, ooadLabel: String, periodLabel: String)
    case completed(message: String)
    case loginError(kind: PortalLoginErrorKind, portalMessage: String?)
    case error(reason: String)
}

/// Controlador del flujo Tu Perfil IMSS (port de `TuPerfilFlowController.kt`).
@MainActor
final class TuPerfilFlowController: ObservableObject {

    @Published private(set) var state: TuPerfilFlowState = .checkingSession
    @Published private(set) var cardStage: String = ""

    weak var webView: WKWebView?

    @Published var ooadOptions: [PortalOoad] = []
    @Published var selectedOoad: PortalOoad?
    @Published var periodOptions: [ImssPeriodOption] = []
    @Published var selectedPeriod: ImssPeriodOption?
    var lastUsername: String?

    private var autoLoginAttempted = false
    private var loginTask: Task<Void, Never>?

    private static let loginURL = "https://tuperfil.imss.gob.mx/guitpei-web/login"
    private static let cardURL = "https://tuperfil.imss.gob.mx/guitpei-web/app/administration/card"
    private static let maxFillAttempts = 10
    private static let maxFieldsRequiredRetries = 3
    private static let errorPersistSamples = 3

    func attachWebView(_ wv: WKWebView) { webView = wv }

    func start() {
        state = .checkingSession
        runFlow()
    }

    func loginWithCredentials(username: String, password: String, remember: Bool) {
        if loginTask != nil { return }
        loginTask = Task {
            do {
                state = .waitingForm
                try await doLogin(username: username, password: password)
                if case .error = state {
                    state = .loginError(kind: .unknown, portalMessage: nil)
                } else if remember, isSuccessState {
                    _ = ImssVaultManager.saveCredentials(
                        portal: .tuPerfil,
                        payload: ImssCredentialPayload(username: username, password: password)
                    )
                }
            } catch {
                state = .loginError(kind: .unknown, portalMessage: nil)
            }
            loginTask = nil
        }
    }

    private var isSuccessState: Bool {
        switch state {
        case .authenticated, .ready, .tarjetonSaved, .completed: return true
        default: return false
        }
    }

    func reset() {
        autoLoginAttempted = false
        state = .checkingSession
    }

    func retryLogin() {
        if loginTask != nil { return }
        autoLoginAttempted = false
        state = .checkingSession
        runFlow()
    }

    func manualEntry() {
        autoLoginAttempted = true
        state = .loginRequired
    }

    func retryCardAutomation() {
        guard let wv = webView else { return }
        state = .preparingCardForm
        runAutomation(wv)
    }

    func markGenerating() { state = .generatingTarjeton }
    func markSaving() { state = .savingTarjeton }

    func markTarjetonSaved(documentId: String, localPath: String, wasDuplicate: Bool, ooadLabel: String, periodLabel: String) {
        state = .tarjetonSaved(
            documentId: documentId, localPath: localPath, wasDuplicate: wasDuplicate,
            ooadLabel: ooadLabel, periodLabel: periodLabel
        )
    }

    func markCaptureFailed() { state = .error(reason: "No pudimos guardar el tarjetón.") }

    // MARK: - Core flow

    private func runFlow() {
        guard let wv = webView else { return }
        Task {
            let path = (await PortalFlowSupport.evalJs(wv, "location.pathname")) ?? ""
            let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            if trimmed.hasPrefix("/guitpei-web/app") {
                await doNavigateToCard(wv)
                return
            }
            if !autoLoginAttempted {
                autoLoginAttempted = true
                if let payload = ImssVaultManager.decryptCredentials(portal: .tuPerfil) {
                    lastUsername = payload.username
                    state = .waitingForm
                    try? await doLogin(username: payload.username, password: payload.password)
                    return
                }
            }
            state = .loginRequired
        }
    }

    // MARK: - Login flow

    private func doLogin(username: String, password: String) async throws {
        guard let wv = webView else { return }
        lastUsername = username
        wv.load(URLRequest(url: URL(string: Self.loginURL)!))
        state = .waitingForm

        if !await awaitInputs(wv) { state = .error(reason: "LOGIN_INPUTS_TIMEOUT"); return }

        var fieldsRequiredRetries = 0
        while true {
            state = .fillingForm
            if !await fillAndVerify(wv, username, password) { state = .error(reason: "LOGIN_FILL_FAILED"); return }

            state = .verifyingForm
            if !await valuesStillPresent(wv, username, password) { state = .error(reason: "LOGIN_VALUE_RESET"); return }

            state = .submittingLogin
            let click = await clickLogin(wv)
            if !click.ok { state = .error(reason: click.reason); return }

            state = .waitingAuthentication
            let (result, errorInfo) = await awaitAuth(wv)
            switch result {
            case .success:
                state = .authenticated
                await doNavigateToCard(wv)
                return
            case .error:
                let kind = errorInfo?.kind ?? .unknown
                if kind == .fieldsRequired && fieldsRequiredRetries < Self.maxFieldsRequiredRetries {
                    fieldsRequiredRetries += 1
                    continue
                }
                state = .loginError(kind: kind, portalMessage: errorInfo?.message)
                return
            case .timeout:
                state = .error(reason: "LOGIN_AUTH_TIMEOUT")
                return
            }
        }
    }

    private func awaitInputs(_ wv: WKWebView) async -> Bool {
        await PortalFlowSupport.pollUntil(ms: 7500) {
            let raw = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilSnapshot)
            guard let s = TarjetonDigitalJson.parseObject(raw) else { return false }
            return (s["matriculaFound"] as? Bool ?? false) && (s["passwordFound"] as? Bool ?? false)
        }
    }

    private func fillAndVerify(_ wv: WKWebView, _ u: String, _ p: String) async -> Bool {
        for _ in 0..<Self.maxFillAttempts {
            let fr = await fillCredentials(wv, u, p)
            if !fr.ok { try? await Task.sleep(nanoseconds: 250_000_000); continue }
            try? await Task.sleep(nanoseconds: 300_000_000)
            let v1 = await verifyCredentials(wv, u, p)
            if v1.matriculaOk && v1.passwordOk && v1.canSubmit {
                try? await Task.sleep(nanoseconds: 200_000_000)
                let v2 = await verifyCredentials(wv, u, p)
                if v2.matriculaOk && v2.passwordOk && v2.canSubmit { return true }
            }
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        return false
    }

    private func valuesStillPresent(_ wv: WKWebView, _ u: String, _ p: String) async -> Bool {
        let v = await verifyCredentials(wv, u, p)
        return v.matriculaOk && v.passwordOk && v.canSubmit
    }

    private struct FillResult { let ok: Bool; let reason: String }
    private func fillCredentials(_ wv: WKWebView, _ u: String, _ p: String) async -> FillResult {
        let r = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilFill(u: u, p: p))
        guard let obj = TarjetonDigitalJson.parseObject(r), obj["ok"] as? Bool == true else {
            return FillResult(ok: false, reason: TarjetonDigitalJson.parseObject(r)?["reason"] as? String ?? "FILL_FAILED")
        }
        return FillResult(ok: true, reason: "")
    }

    private struct VerifyResult {
        let matriculaOk: Bool
        let passwordOk: Bool
        let canSubmit: Bool
    }
    private func verifyCredentials(_ wv: WKWebView, _ u: String, _ p: String) async -> VerifyResult {
        let r = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilVerify(u: u, p: p))
        guard let obj = TarjetonDigitalJson.parseObject(r) else { return VerifyResult(matriculaOk: false, passwordOk: false, canSubmit: false) }
        return VerifyResult(
            matriculaOk: obj["matriculaOk"] as? Bool ?? false,
            passwordOk: obj["passwordOk"] as? Bool ?? false,
            canSubmit: obj["canSubmit"] as? Bool ?? false
        )
    }

    private struct ClickResult { let ok: Bool; let reason: String }
    private func clickLogin(_ wv: WKWebView) async -> ClickResult {
        let r = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilClick)
        guard let obj = TarjetonDigitalJson.parseObject(r), obj["ok"] as? Bool == true else {
            return ClickResult(ok: false, reason: TarjetonDigitalJson.parseObject(r)?["reason"] as? String ?? "LOGIN_CLICK_FAILED")
        }
        return ClickResult(ok: true, reason: "")
    }

    private enum AuthResult { case success, error, timeout }
    private struct LoginErrorInfo { let kind: PortalLoginErrorKind; let message: String? }

    private func awaitAuth(_ wv: WKWebView) async -> (AuthResult, LoginErrorInfo?) {
        var result: (AuthResult, LoginErrorInfo?)? = nil
        var errorStreak = 0
        var lastErrorKind: PortalLoginErrorKind?
        var lastErrorMessage: String?

        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < 25_000 {
            try? await Task.sleep(nanoseconds: 500_000_000)
            let path = (await PortalFlowSupport.evalJs(wv, "location.pathname"))?
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"")) ?? ""
            if path.hasPrefix("/guitpei-web/app") {
                result = (.success, nil)
                break
            }
            let raw = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilLoginError)
            let message = TarjetonDigitalJson.parseString(raw)
            let kind = classifyPortalError(message)
            if let kind {
                if kind == lastErrorKind && message == lastErrorMessage {
                    errorStreak += 1
                } else {
                    lastErrorKind = kind
                    lastErrorMessage = message
                    errorStreak = 1
                }
                if errorStreak >= Self.errorPersistSamples {
                    result = (.error, LoginErrorInfo(kind: kind, message: message))
                    break
                }
            } else {
                errorStreak = 0
                lastErrorKind = nil
                lastErrorMessage = nil
            }
        }
        return result ?? (.timeout, nil)
    }

    private func classifyPortalError(_ message: String?) -> PortalLoginErrorKind? {
        guard let message, !message.isEmpty else { return nil }
        let m = normalizeMessage(message)
        func has(_ keys: String...) -> Bool { keys.contains { m.contains($0) } }
        if has("campo obligatorio", "campo requerido", "obligatorio", "requerido") { return .fieldsRequired }
        if has("contraseña incorrecta", "contrasena incorrecta", "usuario o contraseña incorrectos",
               "usuario o contraseña incorrecta", "credenciales incorrectas", "credenciales no validas",
               "no coinciden", "contraseña no valida", "datos incorrectos", "incorrecta. intente") { return .badCredentials }
        if has("bloqueada", "bloqueado", "no registrado", "usuario no existe", "cuenta desactivada",
               "intentos agotados", "cuenta suspendida") { return .accountLockedOrUnregistered }
        if has("servicio no disponible", "no disponible en este momento", "error interno",
               "intente mas tarde", "servicio temporalmente", "no pudimos") { return .serviceUnavailable }
        return nil
    }

    private func normalizeMessage(_ message: String) -> String {
        message.lowercased()
            .replacingOccurrences(of: "á", with: "a")
            .replacingOccurrences(of: "é", with: "e")
            .replacingOccurrences(of: "í", with: "i")
            .replacingOccurrences(of: "ó", with: "o")
            .replacingOccurrences(of: "ú", with: "u")
            .replacingOccurrences(of: "ü", with: "u")
            .replacingOccurrences(of: "ñ", with: "n")
    }

    // MARK: - Card automation

    private func doNavigateToCard(_ wv: WKWebView) async {
        state = .openingCardPage
        wv.load(URLRequest(url: URL(string: Self.cardURL)!))

        let navOk = await PortalFlowSupport.pollUntil(ms: 15_000) {
            let path = (await PortalFlowSupport.evalJs(wv, "location.pathname"))?
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"")) ?? ""
            return path.contains("/administration/card")
        }
        if !navOk { state = .error(reason: "CARD_NAV_TIMEOUT"); return }

        let domOk = await PortalFlowSupport.pollUntil(ms: 10_000) {
            let raw = await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilCardDom)
            return TarjetonDigitalJson.parseObject(raw)?["ready"] as? Bool ?? false
        }
        if !domOk { state = .error(reason: "CARD_DOM_TIMEOUT"); return }

        state = .preparingCardForm
        await runAutomation(wv)
    }

    private func runAutomation(_ wv: WKWebView) async {
        await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilCardAutomation)
        cardStage = "STARTING"

        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < 40_000 {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard let j = TarjetonDigitalJson.parseObject(
                await PortalFlowSupport.evalJs(wv, PortalScripts.tuPerfilCardSnapshot)
            ) else { continue }

            let stateObj = j["s"] as? [String: Any]
            let resultObj = j["r"] as? [String: Any]
            let errorObj = j["e"] as? [String: Any]

            if let stage = stateObj?["stage"] as? String {
                cardStage = stage
            }
            if let errorObj {
                let eStage = errorObj["stage"] as? String ?? cardStage
                let eMsg = errorObj["message"] as? String ?? ""
                failCardAutomation(stage: eStage, message: eMsg)
                return
            }
            if let resultObj, resultObj["ok"] as? Bool == true {
                applyCardResult(resultObj)
                return
            }
        }
        failCardAutomation(stage: cardStage, message: "TIMEOUT")
    }

    private func applyCardResult(_ result: [String: Any]) {
        func parseOoad(_ o: [String: Any]) -> PortalOoad {
            let label = o["label"] as? String ?? ""
            let pretty = label.replacingOccurrences(of: #"^\d{2}\s*-\s*"#, with: "", options: .regularExpression)
            return PortalOoad(code: o["code"] as? String ?? "", portalLabel: label, displayLabel: pretty)
        }

        if let arr = result["ooadOptions"] as? [[String: Any]] {
            ooadOptions = arr.map(parseOoad)
        }
        if let arr = result["periodOptions"] as? [[String: Any]] {
            periodOptions = arr.map { PeriodParser.parse($0["label"] as? String ?? "") }
        }
        if let sel = result["selectedOoad"] as? [String: Any] {
            selectedOoad = parseOoad(sel)
        }
        if let sel = result["selectedPeriod"] as? [String: Any] {
            selectedPeriod = PeriodParser.parse(sel["label"] as? String ?? "")
        }
        state = .ready(ooadOptions: ooadOptions, selectedOoad: selectedOoad, periodOptions: periodOptions, selectedPeriod: selectedPeriod)
    }

    private func failCardAutomation(stage: String, message: String) {
        cardStage = stage
        state = .error(reason: "No pudimos preparar tus tarjetones.")
    }
}
