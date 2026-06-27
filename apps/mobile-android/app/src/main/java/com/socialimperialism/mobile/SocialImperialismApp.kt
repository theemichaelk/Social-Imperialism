package com.socialimperialism.mobile

import android.app.Application
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.AuthStore
import com.socialimperialism.mobile.core.BillingGate

class SocialImperialismApp : Application() {
    lateinit var authStore: AuthStore
    lateinit var apiClient: ApiClient
    lateinit var billingGate: BillingGate

    override fun onCreate() {
        super.onCreate()
        authStore = AuthStore(this)
        apiClient = ApiClient(authStore)
        billingGate = BillingGate(apiClient)
    }
}