package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import com.socialimperialism.mobile.core.BillingGate
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SICard
import com.socialimperialism.mobile.ui.SIPrimaryButton
import com.socialimperialism.mobile.ui.SIScreenBg
import com.socialimperialism.mobile.ui.SITextField
import kotlinx.coroutines.launch

@Composable
fun PaywallScreen(billing: BillingGate) {
    val plan by billing.plan.collectAsState()
    val loading by billing.loading.collectAsState()
    val message by billing.message.collectAsState()
    var email by remember(plan) { mutableStateOf(plan?.billingEmail ?: "") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    SIScreenBg {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Unlock Premium", color = SITheme.Accent, fontWeight = FontWeight.Bold, fontSize = 24.sp)
            Text("Subscribe to run AI creation, Prompt Vault, and engagement automation from mobile.", color = SITheme.Muted)
            planOption(billing, "starter", "Starter", "$49/mo", listOf("3 Social Accounts", "500 AI Generations/mo"), email, loading, scope, context)
            planOption(billing, "growth", "Growth", "$149/mo", listOf("15 Social Accounts", "Auto-Rules Engine"), email, loading, scope, context)
            SITextField(email, { email = it }, "Billing email")
            if (message.isNotBlank()) Text(message, color = SITheme.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun planOption(
    billing: BillingGate,
    id: String,
    name: String,
    price: String,
    features: List<String>,
    email: String,
    loading: Boolean,
    scope: kotlinx.coroutines.CoroutineScope,
    context: android.content.Context,
) {
    SICard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(name, color = SITheme.Text, fontWeight = FontWeight.SemiBold)
            Text(price, color = SITheme.Accent)
        }
        features.forEach { Text("✓ $it", color = SITheme.Muted, fontSize = 12.sp) }
        Spacer(Modifier.height(8.dp))
        SIPrimaryButton(if (loading) "Please wait…" else "Subscribe — $name", !loading) {
            scope.launch {
                billing.checkout(id, email) { url ->
                    CustomTabsIntent.Builder().build().launchUrl(context, url.toUri())
                }
            }
        }
    }
}