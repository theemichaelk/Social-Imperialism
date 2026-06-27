package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.BillingGate
import com.socialimperialism.mobile.core.VaultPrompt
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SICard
import com.socialimperialism.mobile.ui.SIScreenBg
import com.socialimperialism.mobile.ui.SITextField
import kotlinx.coroutines.launch

@Composable
fun VaultScreen(api: ApiClient, billing: BillingGate) {
    if (billing.needsPaywall) {
        PaywallScreen(billing)
        return
    }

    var query by remember { mutableStateOf("") }
    var prompts by remember { mutableStateOf<List<VaultPrompt>>(emptyList()) }
    var loaded by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun search() {
        scope.launch {
            try {
                val res = api.invoke<com.socialimperialism.mobile.core.VaultResponse>("search-prompt-vault", listOf(mapOf("query" to query, "keyword" to query)))
                prompts = res.prompts ?: emptyList()
            } catch (e: Exception) {
                status = e.message ?: "Search failed"
            }
        }
    }

    LaunchedEffect(Unit) { search() }

    SIScreenBg {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text("Prompt Vault", color = SITheme.Text, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
            SITextField(query, { query = it; search() }, "Search prompts…")
            Spacer(Modifier.height(8.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                items(prompts) { p ->
                    SICard(Modifier.clickable {
                        scope.launch {
                            try {
                                val res = api.invoke<com.socialimperialism.mobile.core.LoadPromptResponse>("load-prompt-vault-item", listOf(mapOf("id" to p.id)))
                                loaded = res.prompt ?: p.body ?: ""
                                status = "Loaded ${p.title ?: p.id}"
                            } catch (e: Exception) {
                                status = e.message ?: "Load failed"
                            }
                        }
                    }) {
                        Text(p.title ?: "Untitled", color = SITheme.Text)
                        p.feature?.let { Text(it, color = SITheme.Muted, fontSize = 12.sp) }
                    }
                }
            }
            if (loaded.isNotBlank()) {
                SICard { Text(loaded, color = SITheme.Text, fontSize = 12.sp) }
            }
            if (status.isNotBlank()) Text(status, color = SITheme.Muted, fontSize = 12.sp)
        }
    }
}