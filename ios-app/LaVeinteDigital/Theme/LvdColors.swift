import SwiftUI

/// Identidad visual LVD (mirror de `android-app/.../ui/lvd/LvdColors.kt`).
/// Ningún composable usa hex suelto; todo pasa por estos tokens.
enum LvdColors {
    static let navy = Color(hex: 0x161F32)
    static let blue = Color(hex: 0x2462EA)
    static let background = Color(hex: 0xF7F9FA)
    static let surface = Color(hex: 0xFFFFFF)
    static let surfaceSoft = Color(hex: 0xF3F6F9)
    static let textPrimary = Color(hex: 0x161F32)
    static let textSecondary = Color(hex: 0x5E728C)
    static let textMuted = Color(hex: 0x9DA2AA)
    static let border = Color(hex: 0xD9E1EA)
    static let borderStrong = Color(hex: 0xB9CADF)
    static let info = Color(hex: 0x5F92F1)
    static let success = Color(hex: 0x5FCA8A)
    static let warning = Color(hex: 0xF0C65B)
    static let error = Color(hex: 0xEEAFAA)
    static let scrim = Color.black.opacity(0.45)
}

/// Colores de marca heredados (mirror de `ui/theme/Color.kt`).
enum BrandColors {
    static let bg = Color(hex: 0xF8FAFC)
    static let fg = Color(hex: 0x0F172A)
    static let primary = Color(hex: 0x2563EB)
    static let border = Color(hex: 0xE2E8F0)
    static let muted = Color(hex: 0x64748B)
    static let card = Color(hex: 0xFFFFFF)
    static let accent = Color(hex: 0xF1F5F9)
    static let brandNavy = Color(hex: 0x17324D)
    static let brandBlue = Color(hex: 0x2E4F77)
    static let brandCyan = Color(hex: 0x4DA1A8)
}
