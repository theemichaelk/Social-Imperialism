package com.socialimperialism.mobile.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BillingGate(private val api: ApiClient) {
    private val _plan = MutableStateFlow<BillingPlan?>(null)
    val plan: StateFlow<BillingPlan?> = _plan.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _message = MutableStateFlow("")
    val message: StateFlow<String> = _message.asStateFlow()

    val needsPaywall: Boolean get() = _plan.value?.status != "active"

    suspend fun refresh() {
        _loading.value = true
        try {
            _plan.value = api.invoke("get-billing-plan")
        } catch (e: Exception) {
            _message.value = e.message ?: "Billing error"
        } finally {
            _loading.value = false
        }
    }

    suspend fun checkout(planId: String, email: String, onOpenUrl: (String) -> Unit) {
        _loading.value = true
        _message.value = "Opening checkout…"
        try {
            val res: CheckoutResult = api.invoke(
                "create-subscription-checkout",
                listOf(mapOf("planId" to planId, "billingEmail" to email)),
                onCheckout = onOpenUrl,
            )
            when {
                res.success == false -> _message.value = res.error ?: "Checkout failed"
                !res.checkoutUrl.isNullOrBlank() -> {
                    _message.value = "Complete payment in browser, then return here."
                }
                else -> {
                    _message.value = "Plan updated"
                    refresh()
                }
            }
        } catch (e: Exception) {
            _message.value = e.message ?: "Checkout error"
        } finally {
            _loading.value = false
        }
    }
}