import Foundation

enum AppInfo {
    static let version =
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    static let build =
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    static let sdkVersion = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
    static let packageName = "com.laveintedigital.app"
}
