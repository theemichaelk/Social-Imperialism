import SwiftUI

struct MissionControlView: View {
    @State private var stats: DashboardStats?
    @State private var loading = true
    @State private var error = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if loading {
                        ProgressView().tint(SITheme.accent).padding(.top, 40)
                    } else if !error.isEmpty {
                        Text(error).foregroundStyle(SITheme.warn)
                    } else if let s = stats {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            StatCard(label: "Posts", value: "\(s.totalPosts ?? 0)")
                            StatCard(label: "AI Drafts", value: "\(s.aiDrafts ?? 0)")
                            StatCard(label: "Engagement", value: "\(s.totalEngagement ?? 0)")
                            StatCard(label: "Keywords", value: "\(s.activeKeywords ?? 0)")
                            StatCard(label: "Accounts", value: "\(s.linkedAccounts ?? 0)")
                            StatCard(label: "Scheduled", value: "\(s.scheduled ?? 0)")
                        }
                        SICard {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Worker").font(.headline).foregroundStyle(SITheme.text)
                                Text(s.workerStatus ?? "Idle").foregroundStyle(SITheme.accent)
                                if s.autoRulesEnabled == true {
                                    Label("Auto-rules active", systemImage: "bolt.fill")
                                        .foregroundStyle(SITheme.success)
                                        .font(.footnote)
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(SITheme.bg)
            .navigationTitle("Mission Control")
            .refreshable { await load() }
        }
        .task { await load() }
    }

    private func load() async {
        loading = stats == nil
        error = ""
        do {
            stats = try await APIClient.shared.invoke("get-dashboard-stats")
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}

private struct StatCard: View {
    let label: String
    let value: String
    var body: some View {
        SICard {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.caption).foregroundStyle(SITheme.muted)
                Text(value).font(.title2.bold()).foregroundStyle(SITheme.text)
            }
        }
    }
}