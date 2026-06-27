package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.socialimperialism.mobile.core.AuthStore
import com.socialimperialism.mobile.core.BillingGate
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SIScreenBg
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(auth: AuthStore, billing: BillingGate) {
    val plan by billing.plan.collectAsState()
    val projectId by auth.projectId.collectAsState()
    var showPaywall by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { billing.refresh() }

    if (showPaywall) {
        PaywallScreen(billing)
        TextButton(onClick = { showPaywall = false }, modifier = Modifier.padding(16.dp)) {
            Text("← Back to Settings", color = SITheme.Accent)
        }
        return
    }

    SIScreenBg {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Settings", color = SITheme.Text, fontWeight = FontWeight.Bold)
            Text("Billing", color = SITheme.Accent, fontWeight = FontWeight.SemiBold)
            plan?.let {
                Text("Plan: ${it.planName ?: it.plan}", color = SITheme.Text)
                Text("Status: ${it.status}", color = SITheme.Muted)
                it.priceLabel?.let { p -> Text("Price: $p", color = SITheme.Muted) }
            }
            OutlinedButton(onClick = { scope.launch { billing.refresh() } }) { Text("Refresh billing") }
            OutlinedButton(onClick = { showPaywall = true }) { Text("Manage subscription") }
            Spacer(Modifier.height(8.dp))
            Text("Account", color = SITheme.Accent, fontWeight = FontWeight.SemiBold)
            projectId?.let { Text("Project: $it", color = SITheme.Muted) }
            TextButton(onClick = { auth.clearSession() }) {
                Text("Sign out", color = SITheme.Warn)
            }
        }
    }
}