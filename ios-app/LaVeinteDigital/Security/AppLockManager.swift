import Foundation
import SwiftUI

enum LockState {
    case locked
    case unlocking
    case unlocked
}

/// Máquina de estados de bloqueo + auto-rebloqueo (port de `AppLockManager.kt`).
final class AppLockManager: ObservableObject {
    @Published private(set) var state: LockState = .unlocked

    @Published var isBiometricEnabled: Bool {
        didSet { BiometricPreferences.isEnabled = isBiometricEnabled }
    }

    @Published var showEnrollmentInvite = false

    /// Deep link pendiente mientras la app está bloqueada.
    var pendingDeepLink: URL?

    private var lastUnlockTime = Date()
    private static let autoLockTimeout: TimeInterval = 5 * 60 // 5 minutos

    init() {
        isBiometricEnabled = BiometricPreferences.isEnabled
    }

    func lock() { state = .locked }
    func startUnlock() { state = .unlocking }

    func unlock() {
        lastUnlockTime = Date()
        state = .unlocked
    }

    /// Llamado periódicamente en foreground. Re-bloquea si pasó el timeout.
    func tickForeground() {
        guard isBiometricEnabled, state == .unlocked else { return }
        if Date().timeIntervalSince(lastUnlockTime) >= Self.autoLockTimeout {
            lock()
        }
    }

    /// Llamado al volver de background. Devuelve true si hay que bloquear.
    func shouldLockOnReturn() -> Bool {
        guard isBiometricEnabled, state == .unlocked else { return false }
        return Date().timeIntervalSince(lastUnlockTime) >= Self.autoLockTimeout
    }

    var isLocked: Bool { state == .locked }
}
