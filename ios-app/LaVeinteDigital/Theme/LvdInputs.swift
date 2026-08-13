import SwiftUI

/// Campo de texto LVD (port de `LvdTextField`).
struct LvdTextField: View {
    let placeholder: String
    @Binding var text: String
    var secure: Bool = false

    var body: some View {
        Group {
            if secure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: LvdTokens.dims.fieldHeight)
        .background(LvdColors.surfaceSoft)
        .overlay(
            RoundedRectangle(cornerRadius: LvdTokens.radius.field)
                .stroke(LvdColors.border, lineWidth: 1)
        )
        .cornerRadius(LvdTokens.radius.field)
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
    }
}
