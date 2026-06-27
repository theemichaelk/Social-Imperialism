package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.BillingGate
import com.socialimperialism.mobile.core.EngagementQueueItem
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SICard
import com.socialimperialism.mobile.ui.SIScreenBg
import kotlinx.coroutines.launch

@Composable
fun EngageScreen(api: ApiClient, billing: BillingGate) {
    if (billing.needsPaywall) {
        PaywallScreen(billing)
        return
    }

    var queue by remember { mutableStateOf<List<EngagementQueueItem>>(emptyList()) }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            try {
                queue = api.invokeEngagementQueue()
            } catch (e: Exception) {
                status = e.message ?: "Load failed"
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    SIScreenBg {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Engage", color = SITheme.Text, fontWeight = FontWeight.Bold)
                TextButton(onClick = {
                    scope.launch {
                        status = "Processing…"
                        try {
                            api.invokeRaw("retry-engagement-queue")
                            status = "Retry dispatched"
                            load()
                        } catch (e: Exception) { status = e.message ?: "Error" }
                    }
                }) { Text("Retry", color = SITheme.Accent) }
            }
            if (queue.isEmpty()) {
                Text("Engagement queue is empty", color = SITheme.Muted, modifier = Modifier.padding(top = 24.dp))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(queue) { item ->
                        SICard {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(item.platform ?: "Platform", color = SITheme.Accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(item.status ?: "queued", color = SITheme.Muted, fontSize = 10.sp)
                            }
                            Text(item.content ?: "(no content)", color = SITheme.Text, fontSize = 12.sp, maxLines = 4)
                            item.action?.let { Text(it.uppercase(), color = SITheme.Accent2, fontSize = 10.sp) }
                        }
                    }
                }
            }
            if (status.isNotBlank()) Text(status, color = SITheme.Muted, fontSize = 12.sp)
        }
    }
}