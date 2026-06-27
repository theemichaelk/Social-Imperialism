import SwiftUI

struct CreateView: View {
    @ObservedObject var billing: BillingGate
    @State private var content = ""
    @State private var accounts: [LinkedAccount] = []
    @State private var selectedAccountId = ""
    @State private var status = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Group {
                if billing.needsPaywall {
                    PaywallView(billing: billing)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if accounts.isEmpty {
                                Text("Link an account in web Settings → Account Hub first.")
                                    .foregroundStyle(SITheme.muted)
                                    .font(.footnote)
                            } else {
                                Picker("Account", selection: $selectedAccountId) {
                                    ForEach(accounts) { acc in
                                        Text("\(acc.platform ?? "?") — \(acc.name ?? acc.handle ?? acc.id)")
                                            .tag(acc.id)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(SITheme.accent)
                            }

                            TextEditor(text: $content)
                                .frame(minHeight: 160)
                                .padding(8)
                                .scrollContentBackground(.hidden)
                                .background(SITheme.panel)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(SITheme.accent.opacity(0.2)))
                                .foregroundStyle(SITheme.text)

                            HStack(spacing: 12) {
                                Button("AI Enhance") { Task { await enhance() } }
                                    .buttonStyle(.bordered)
                                    .tint(SITheme.accent2)
                                Button("Schedule +24h") { Task { await schedule() } }
                                    .buttonStyle(.bordered)
                                    .tint(SITheme.accent)
                            }

                            SIPrimaryButton(title: loading ? "Publishing…" : "Publish Now") {
                                Task { await publish() }
                            }
                            .disabled(loading || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                            if !status.isEmpty {
                                Text(status).font(.footnote).foregroundStyle(SITheme.muted)
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .background(SITheme.bg)
            .navigationTitle("Create")
            .task { await loadAccounts() }
        }
    }

    private func activeAccount() -> LinkedAccount? {
        accounts.first { $0.id == selectedAccountId } ?? accounts.first
    }

    private func loadAccounts() async {
        do {
            accounts = try await APIClient.shared.invoke("get-linked-accounts")
            if selectedAccountId.isEmpty { selectedAccountId = accounts.first?.id ?? "" }
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func enhance() async {
        guard !content.isEmpty else { return }
        loading = true
        status = "Enhancing…"
        defer { loading = false }
        do {
            let prompt = "Enhance this social post: \(content)"
            content = try await APIClient.shared.invoke("generate-ai", args: [prompt])
            status = "Enhanced"
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func publish() async {
        guard let acc = activeAccount() else { status = "No linked account"; return }
        loading = true
        status = "Publishing…"
        defer { loading = false }
        do {
            let res: PublishResult = try await APIClient.shared.invoke("publish-post", args: [[
                "accountId": acc.id,
                "platform": acc.platform ?? "LinkedIn",
                "content": content,
                "hasMedia": false,
                "humanLike": false,
            ]])
            status = res.success == false ? (res.error ?? "Publish failed") : "Published via \(acc.platform ?? "platform")"
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func schedule() async {
        guard let acc = activeAccount() else { return }
        loading = true
        defer { loading = false }
        do {
            let when = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400))
            try await APIClient.shared.invoke("schedule-post", args: [[
                "platform": acc.platform ?? "LinkedIn",
                "accountId": acc.id,
                "content": content,
                "scheduleTime": when,
            ]] as [Any])
            status = "Scheduled for +24h"
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}