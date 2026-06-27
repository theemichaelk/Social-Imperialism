import SwiftUI

struct VaultView: View {
    @ObservedObject var billing: BillingGate
    @State private var query = ""
    @State private var prompts: [VaultPrompt] = []
    @State private var selected: VaultPrompt?
    @State private var loadedText = ""
    @State private var status = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Group {
                if billing.needsPaywall {
                    PaywallView(billing: billing)
                } else {
                    VStack(spacing: 12) {
                        SITextField(placeholder: "Search prompts…", text: $query)
                            .padding(.horizontal, 16)
                            .onSubmit { Task { await search() } }

                        List(prompts) { p in
                            Button {
                                selected = p
                                Task { await loadItem(p) }
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(p.title ?? "Untitled").foregroundStyle(SITheme.text)
                                    if let f = p.feature {
                                        Text(f).font(.caption).foregroundStyle(SITheme.muted)
                                    }
                                }
                            }
                            .listRowBackground(SITheme.panel)
                        }
                        .scrollContentBackground(.hidden)

                        if let loadedText = loadedText.isEmpty ? nil : loadedText {
                            SICard {
                                Text(loadedText)
                                    .font(.footnote)
                                    .foregroundStyle(SITheme.text)
                            }
                            .padding(.horizontal, 16)
                        }

                        if !status.isEmpty {
                            Text(status).font(.caption).foregroundStyle(SITheme.muted).padding(.horizontal, 16)
                        }
                    }
                }
            }
            .background(SITheme.bg)
            .navigationTitle("Prompt Vault")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Refresh") { Task { await search() } }
                }
            }
            .task { await search() }
        }
    }

    private func search() async {
        loading = true
        defer { loading = false }
        do {
            let res: VaultResponse = try await APIClient.shared.invoke("search-prompt-vault", args: [[
                "query": query,
                "keyword": query,
            ]])
            prompts = res.prompts ?? []
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadItem(_ item: VaultPrompt) async {
        do {
            let res: LoadPromptResponse = try await APIClient.shared.invoke("load-prompt-vault-item", args: [[
                "id": item.id,
            ]])
            loadedText = res.prompt ?? res.item?.body ?? ""
            status = "Loaded \(item.title ?? item.id)"
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}