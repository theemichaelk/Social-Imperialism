package com.socialimperialism.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.screens.*
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as SocialImperialismApp

        lifecycleScope.launch {
            app.apiClient // ensure init
            app.authStore.bootstrap(app.apiClient)
        }

        setContent {
            val bootstrapped by app.authStore.bootstrapped.collectAsState()
            val authed by app.authStore.token.collectAsState()
            val billing = remember { app.billingGate }

            MaterialTheme(colorScheme = darkColorScheme(
                background = SITheme.Bg,
                surface = SITheme.Panel,
                primary = SITheme.Accent,
                onPrimary = SITheme.Bg,
                onBackground = SITheme.Text,
                onSurface = SITheme.Text,
            )) {
                when {
                    !bootstrapped -> BoxContent("Loading…")
                    authed == null -> LoginScreen(app.authStore, app.apiClient)
                    else -> MainTabs(app)
                }
            }
        }
    }
}

@Composable
private fun BoxContent(msg: String) {
    Surface(color = SITheme.Bg) {
        Text(msg, color = SITheme.Accent, modifier = Modifier.padding(24.dp))
    }
}

@Composable
private fun MainTabs(app: SocialImperialismApp) {
    var tab by remember { mutableIntStateOf(0) }
    val billing = app.billingGate

    LaunchedEffect(Unit) { billing.refresh() }

    Scaffold(
        containerColor = SITheme.Bg,
        bottomBar = {
            NavigationBar(containerColor = SITheme.Panel) {
                NavigationBarItem(selected = tab == 0, onClick = { tab = 0 }, icon = { Icon(Icons.Default.Dashboard, null) }, label = { Text("Mission") })
                NavigationBarItem(selected = tab == 1, onClick = { tab = 1 }, icon = { Icon(Icons.Default.Edit, null) }, label = { Text("Create") })
                NavigationBarItem(selected = tab == 2, onClick = { tab = 2 }, icon = { Icon(Icons.Default.Lock, null) }, label = { Text("Vault") })
                NavigationBarItem(selected = tab == 3, onClick = { tab = 3 }, icon = { Icon(Icons.Default.Forum, null) }, label = { Text("Engage") })
                NavigationBarItem(selected = tab == 4, onClick = { tab = 4 }, icon = { Icon(Icons.Default.Settings, null) }, label = { Text("Settings") })
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                0 -> MissionScreen(app.apiClient)
                1 -> CreateScreen(app.apiClient, billing)
                2 -> VaultScreen(app.apiClient, billing)
                3 -> EngageScreen(app.apiClient, billing)
                4 -> SettingsScreen(app.authStore, billing)
            }
        }
    }
}