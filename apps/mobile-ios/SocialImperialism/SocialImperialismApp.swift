import SwiftUI

@main
struct SocialImperialismApp: App {
    @StateObject private var auth = AuthStore.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isBootstrapped {
                    if auth.isAuthenticated {
                        MainTabView()
                    } else {
                        LoginView()
                    }
                } else {
                    ProgressView("Loading…")
                        .tint(SITheme.accent)
                        .task { await auth.bootstrap() }
                }
            }
            .preferredColorScheme(.dark)
            .background(SITheme.bg)
        }
    }
}