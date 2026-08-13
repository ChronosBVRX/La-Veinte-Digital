import SwiftUI

@main
struct LaVeinteDigitalApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var router = AppRouter()
    @StateObject private var appLock = AppLockManager()

    private let tickTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(router)
                .environmentObject(appLock)
                .onReceive(tickTimer) { _ in appLock.tickForeground() }
                .onChange(of: scenePhase) { phase in
                    if phase == .active && appLock.shouldLockOnReturn() {
                        appLock.lock()
                    }
                }
        }
    }
}
