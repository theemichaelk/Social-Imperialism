import SwiftUI

struct EngageView: View {
    @ObservedObject var billing: BillingGate
    @State private var queue: [EngagementQueueItem] = []
    @State private var status = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Group {
                if billing.needsPaywall {
                    PaywallView(billing: billing)
                } else {
                    List(queue) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.platform ?? "Platform").font(.caption.bold())
                                    .foregroundStyle(SITheme.accent)
                                Spacer()
                                Text(item.status ?? "queued")
                                    .font(.caption2)
                                    .foregroundStyle(SITheme.muted)
                            }
                            Text(item.content ?? "(no content)")
                                .font(.footnote)
                                .foregroundStyle(SITheme.text)
                                .lineLimit(4)
                            if let action = item.action {
                                Text(action.uppercased())
                                    .font(.caption2)
                                    .foregroundStyle(SITheme.accent2)
                            }
                        }
                        .padding(.vertical, 4)
                        .listRowBackground(SITheme.panel)
                    }
                    .scrollContentBackground(.hidden)
                    .overlay {
                        if queue.isEmpty && !loading {
                            Text("Engagement queue is empty").foregroundStyle(SITheme.muted)
                        }
                    }
                }
            }
            .background(SITheme.bg)
            .navigationTitle("Engage")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Retry") { Task { await retry() } }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            queue = try await APIClient.shared.invoke("get-engagement-queue")
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func retry() async {
        status = "Processing queue…"
        do {
            _ = try await APIClient.shared.invokeRaw("retry-engagement-queue")
            status = "Retry dispatched"
            await load()
        } catch {
            status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}