import SwiftUI

struct MainTabView: View {
    @StateObject private var billing = BillingGate()
    @State private var checkoutURL: URL?

    var body: some View {
        TabView {
            MissionControlView()
                .tabItem { Label("Mission", systemImage: "gauge.with.dots.needle.67percent") }

            CreateView(billing: billing)
                .tabItem { Label("Create", systemImage: "square.and.pencil") }

            VaultView(billing: billing)
                .tabItem { Label("Vault", systemImage: "lock.doc") }

            EngageView(billing: billing)
                .tabItem { Label("Engage", systemImage: "bubble.left.and.bubble.right") }

            SettingsView(billing: billing)
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .tint(SITheme.accent)
        .onReceive(NotificationCenter.default.publisher(for: .siOpenCheckout)) { note in
            if let url = note.object as? URL {
                checkoutURL = url
            } else if let str = note.object as? String, let url = URL(string: str) {
                checkoutURL = url
            }
        }
        .sheet(item: $checkoutURL) { url in
            SafariCheckoutView(url: url)
        }
        .task { await billing.refresh() }
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}