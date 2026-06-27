import SwiftUI

struct SettingsView: View {
    @ObservedObject private var auth = AuthStore.shared
    @ObservedObject var billing: BillingGate
    @State private var showPaywall = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let plan = billing.plan {
                        LabeledContent("Plan", value: plan.planName ?? plan.plan ?? "—")
                        LabeledContent("Status", value: plan.status ?? "—")
                        if let price = plan.priceLabel {
                            LabeledContent("Price", value: price)
                        }
                    }
                    Button("Refresh billing") { Task { await billing.refresh() } }
                    Button("Manage subscription") { showPaywall = true }
                } header: {
                    Text("Billing").foregroundStyle(SITheme.accent)
                }
                .listRowBackground(SITheme.panel)

                Section {
                    if let pid = auth.projectId {
                        LabeledContent("Project", value: pid)
                    }
                    Button("Sign out", role: .destructive) {
                        auth.clearSession()
                    }
                } header: {
                    Text("Account").foregroundStyle(SITheme.accent)
                }
                .listRowBackground(SITheme.panel)
            }
            .scrollContentBackground(.hidden)
            .background(SITheme.bg)
            .navigationTitle("Settings")
            .sheet(isPresented: $showPaywall) {
                NavigationStack {
                    PaywallView(billing: billing)
                        .navigationTitle("Premium")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showPaywall = false }
                            }
                        }
                }
                .presentationDetents([.large])
            }
            .task { await billing.refresh() }
        }
    }
}