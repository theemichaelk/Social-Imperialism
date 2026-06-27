package com.socialimperialism.mobile.core

data class SessionResponse(val token: String, val project: ProjectRef? = null)
data class MeResponse(val project: ProjectRef? = null, val projects: List<ProjectRef>? = null)
data class ProjectRef(val id: String, val name: String? = null, val isActive: Boolean? = null)

data class DashboardStats(
    val totalPosts: Int? = null,
    val aiDrafts: Int? = null,
    val totalEngagement: Int? = null,
    val activeKeywords: Int? = null,
    val linkedAccounts: Int? = null,
    val scheduled: Int? = null,
    val workerStatus: String? = null,
    val autoRulesEnabled: Boolean? = null,
)

data class VaultPrompt(
    val id: String,
    val title: String? = null,
    val body: String? = null,
    val feature: String? = null,
)

data class VaultResponse(val prompts: List<VaultPrompt>? = null, val total: Int? = null)
data class LoadPromptResponse(val success: Boolean? = null, val prompt: String? = null, val item: VaultPrompt? = null)

data class LinkedAccount(
    val id: String,
    val platform: String? = null,
    val name: String? = null,
    val handle: String? = null,
)

data class PublishResult(val success: Boolean? = null, val error: String? = null)

data class EngagementQueueItem(
    val id: String,
    val platform: String? = null,
    val content: String? = null,
    val action: String? = null,
    val status: String? = null,
)

data class PlanCatalogEntry(
    val id: String? = null,
    val name: String? = null,
    val priceLabel: String? = null,
    val features: List<String>? = null,
)

data class BillingPlan(
    val plan: String? = null,
    val planName: String? = null,
    val status: String? = null,
    val priceLabel: String? = null,
    val billingEmail: String? = null,
)

data class CheckoutResult(val success: Boolean? = null, val checkoutUrl: String? = null, val error: String? = null)