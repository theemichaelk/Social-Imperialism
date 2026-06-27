import Foundation

struct DashboardStats: Decodable {
    let totalPosts: Int?
    let aiDrafts: Int?
    let totalEngagement: Int?
    let activeKeywords: Int?
    let leadsGenerated: Int?
    let linkedAccounts: Int?
    let scheduled: Int?
    let workerStatus: String?
    let autoRulesEnabled: Bool?
}

struct VaultResponse: Decodable {
    let prompts: [VaultPrompt]?
    let total: Int?
}

struct VaultPrompt: Decodable, Identifiable {
    let id: String
    let title: String?
    let body: String?
    let feature: String?
    let keywords: [String]?
    let tags: [String]?
}

struct LoadPromptResponse: Decodable {
    let success: Bool?
    let prompt: String?
    let item: VaultPrompt?
    let error: String?
}

struct LinkedAccount: Decodable, Identifiable {
    let id: String
    let platform: String?
    let name: String?
    let handle: String?
}

struct PublishResult: Decodable {
    let success: Bool?
    let error: String?
}

struct EngagementQueueItem: Decodable, Identifiable {
    let id: String
    let platform: String?
    let content: String?
    let action: String?
    let status: String?
    let createdAt: String?
}

struct BillingPlan: Decodable {
    let plan: String?
    let planName: String?
    let status: String?
    let priceLabel: String?
    let billingEmail: String?
    let catalog: PlanCatalogEntry?
    let allPlans: [String: PlanCatalogEntry]?
}

struct PlanCatalogEntry: Decodable {
    let id: String?
    let name: String?
    let price: Double?
    let priceLabel: String?
    let features: [String]?
}

struct CheckoutResult: Decodable {
    let success: Bool?
    let checkoutUrl: String?
    let error: String?
}