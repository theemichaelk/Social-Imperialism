package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.DashboardStats
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SICard
import com.socialimperialism.mobile.ui.SIScreenBg
import kotlinx.coroutines.launch

@Composable
fun MissionScreen(api: ApiClient) {
    var stats by remember { mutableStateOf<DashboardStats?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            loading = stats == null
            error = ""
            try {
                stats = api.invoke("get-dashboard-stats")
            } catch (e: Exception) {
                error = e.message ?: "Load failed"
            }
            loading = false
        }
    }

    LaunchedEffect(Unit) { load() }

    SIScreenBg {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text("Mission Control", color = SITheme.Text, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))
            when {
                loading -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SITheme.Accent)
                }
                error.isNotBlank() -> Text(error, color = SITheme.Warn)
                stats != null -> {
                    val s = stats!!
                    val cards = listOf(
                        "Posts" to (s.totalPosts ?: 0),
                        "AI Drafts" to (s.aiDrafts ?: 0),
                        "Engagement" to (s.totalEngagement ?: 0),
                        "Keywords" to (s.activeKeywords ?: 0),
                        "Accounts" to (s.linkedAccounts ?: 0),
                        "Scheduled" to (s.scheduled ?: 0),
                    )
                    LazyVerticalGrid(columns = GridCells.Fixed(2), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(cards) { (label, value) ->
                            SICard {
                                Text(label, color = SITheme.Muted, fontSize = 12.sp)
                                Text("$value", color = SITheme.Text, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    SICard {
                        Text("Worker", color = SITheme.Text, fontWeight = FontWeight.SemiBold)
                        Text(s.workerStatus ?: "Idle", color = SITheme.Accent)
                    }
                }
            }
        }
    }
}

