import SwiftUI

struct LoginView: View {
    @ObservedObject private var auth = AuthStore.shared
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isRegister = false
    @State private var loading = false
    @State private var error = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Social Imperialism")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(SITheme.accent)
                    Text(isRegister ? "Create your command center account" : "Sign in to Mission Control")
                        .foregroundStyle(SITheme.muted)
                }

                if isRegister {
                    SITextField(placeholder: "Name (optional)", text: $name)
                }
                SITextField(placeholder: "Email", text: $email)
                SITextField(placeholder: "Password", text: $password, secure: true)

                if !error.isEmpty {
                    Text(error).foregroundStyle(SITheme.warn).font(.footnote)
                }

                SIPrimaryButton(title: loading ? "Please wait…" : (isRegister ? "Create Account" : "Sign In")) {
                    Task { await submit() }
                }
                .disabled(loading || email.isEmpty || password.isEmpty)

                Button(isRegister ? "Already have an account? Sign in" : "Need an account? Register") {
                    isRegister.toggle()
                    error = ""
                }
                .foregroundStyle(SITheme.accent2)
                .font(.footnote)
            }
            .padding(24)
        }
        .background(SITheme.bg.ignoresSafeArea())
    }

    private func submit() async {
        loading = true
        error = ""
        defer { loading = false }
        do {
            let session: SessionResponse
            if isRegister {
                session = try await APIClient.shared.register(email: email, password: password, name: name)
            } else {
                session = try await APIClient.shared.login(email: email, password: password)
            }
            auth.setSession(session)
            try? await auth.repairSession()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}