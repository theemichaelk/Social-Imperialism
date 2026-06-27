import SwiftUI
import SafariServices

@MainActor
final class BillingGate: ObservableObject {
    @Published var plan: BillingPlan?
    @Published var loading = false
    @Published var message = ""

    var needsPaywall: Bool {
        guard let plan else { return false }
        return plan.status != "active"
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            plan = try await APIClient.shared.invoke("get-billing-plan")
        } catch {
            message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func checkout(planId: String, email: String) async {
        loading = true
        message = "Opening checkout…"
        defer { loading = false }
        do {
            let res: CheckoutResult = try await APIClient.shared.invoke("create-subscription-checkout", args: [[
                "planId": planId,
                "billingEmail": email,
            ]])
            if res.success == false {
                message = res.error ?? "Checkout failed"
            } else if let url = res.checkoutUrl {
                CheckoutPresenter.open(url)
                message = "Complete payment in browser, then return here."
            } else {
                message = "Plan updated"
                await refresh()
            }
        } catch {
            message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

struct PaywallView: View {
    @ObservedObject var billing: BillingGate
    @State private var email = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Unlock Premium")
                    .font(.title.bold())
                    .foregroundStyle(SITheme.accent)
                Text("Subscribe to run AI creation, Prompt Vault, and engagement automation from mobile.")
                    .foregroundStyle(SITheme.muted)

                planCard(id: "starter", name: "Starter", price: "$49/mo", features: [
                    "3 Social Accounts", "500 AI Generations/mo", "Content Calendar",
                ])
                planCard(id: "growth", name: "Growth", price: "$149/mo", features: [
                    "15 Social Accounts", "Auto-Rules Engine", "Advanced Analytics",
                ])

                SITextField(placeholder: "Billing email", text: $email)

                if !billing.message.isEmpty {
                    Text(billing.message).font(.footnote).foregroundStyle(SITheme.muted)
                }
            }
            .padding(20)
        }
        .onAppear {
            email = billing.plan?.billingEmail ?? ""
        }
    }

    @ViewBuilder
    private func planCard(id: String, name: String, price: String, features: [String]) -> some View {
        SICard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(name).font(.headline).foregroundStyle(SITheme.text)
                    Spacer()
                    Text(price).foregroundStyle(SITheme.accent)
                }
                ForEach(features, id: \.self) { f in
                    Label(f, systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(SITheme.muted)
                }
                SIPrimaryButton(title: billing.loading ? "Please wait…" : "Subscribe — \(name)") {
                    Task { await billing.checkout(planId: id, email: email) }
                }
                .disabled(billing.loading)
            }
        }
    }
}

enum CheckoutPresenter {
    static func open(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        NotificationCenter.default.post(name: .siOpenCheckout, object: url)
    }
}

struct SafariCheckoutView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}