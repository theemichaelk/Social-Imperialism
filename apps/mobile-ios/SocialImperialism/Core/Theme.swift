import SwiftUI

enum SITheme {
    static let bg = Color(red: 2/255, green: 4/255, blue: 8/255)
    static let panel = Color(red: 10/255, green: 18/255, blue: 40/255)
    static let accent = Color(red: 0, green: 212/255, blue: 1)
    static let accent2 = Color(red: 180/255, green: 74/255, blue: 1)
    static let text = Color(red: 238/255, green: 246/255, blue: 1)
    static let muted = Color(red: 123/255, green: 148/255, blue: 184/255)
    static let success = Color(red: 0, green: 1, blue: 157/255)
    static let warn = Color(red: 1, green: 176/255, blue: 32/255)
}

struct SICard<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SITheme.panel)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(SITheme.accent.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct SIPrimaryButton: View {
    let title: String
    let action: () -> Void
    var disabled = false

    var body: some View {
        Button(action: action) {
            Text(title)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(disabled ? SITheme.muted.opacity(0.3) : SITheme.accent)
                .foregroundStyle(disabled ? SITheme.muted : SITheme.bg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(disabled)
    }
}

struct SITextField: View {
    let placeholder: String
    @Binding var text: String
    var secure = false

    var body: some View {
        Group {
            if secure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .padding(14)
        .background(SITheme.panel)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(SITheme.accent.opacity(0.2), lineWidth: 1)
        )
        .foregroundStyle(SITheme.text)
    }
}