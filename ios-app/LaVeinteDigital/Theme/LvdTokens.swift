import SwiftUI

/// Tokens de diseño LVD (mirror de `ui/lvd/LvdTokens.kt`).
enum LvdTokens {
    enum radius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 18
        static let sheet: CGFloat = 28
        static let button: CGFloat = 14
        static let field: CGFloat = 14
        static let card: CGFloat = 16
    }

    enum spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    enum dims {
        static let buttonHeight: CGFloat = 52
        static let fieldHeight: CGFloat = 56
    }
}
