package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.BillingGate
import com.socialimperialism.mobile.core.LinkedAccount
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SIPrimaryButton
import com.socialimperialism.mobile.ui.SIScreenBg
import kotlinx.coroutines.launch
import java.time.Instant

@Composable
fun CreateScreen(api: ApiClient, billing: BillingGate) {
    if (billing.needsPaywall) {
        PaywallScreen(billing)
        return
    }

    var content by remember { mutableStateOf("") }
    var accounts by remember { mutableStateOf<List<LinkedAccount>>(emptyList()) }
    var selectedId by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            accounts = api.invokeLinkedAccounts()
            selectedId = accounts.firstOrNull()?.id ?: ""
        } catch (e: Exception) {
            status = e.message ?: "Failed to load accounts"
        }
    }

    SIScreenBg {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Create", color = SITheme.Text, fontWeight = FontWeight.Bold)
            if (accounts.isEmpty()) {
                Text("Link an account in web Settings → Account Hub first.", color = SITheme.Muted, fontSize = 12.sp)
            } else {
                var expanded by remember { mutableStateOf(false) }
                val selected = accounts.find { it.id == selectedId } ?: accounts.first()
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                    OutlinedTextField(
                        readOnly = true,
                        value = "${selected.platform ?: "?"} — ${selected.name ?: selected.handle ?: selected.id}",
                        onValueChange = {},
                        modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = SITheme.Text, unfocusedTextColor = SITheme.Text),
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        accounts.forEach { acc ->
                            DropdownMenuItem(
                                text = { Text("${acc.platform} — ${acc.name ?: acc.id}") },
                                onClick = { selectedId = acc.id; expanded = false },
                            )
                        }
                    }
                }
            }
            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                modifier = Modifier.fillMaxWidth().height(160.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = SITheme.Text, unfocusedTextColor = SITheme.Text, focusedContainerColor = SITheme.Panel, unfocusedContainerColor = SITheme.Panel),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    scope.launch {
                        loading = true
                        try {
                            content = api.invoke<String>("generate-ai", listOf("Enhance this social post: $content"))
                            status = "Enhanced"
                        } catch (e: Exception) { status = e.message ?: "Error" }
                        loading = false
                    }
                }) { Text("AI Enhance") }
                OutlinedButton(onClick = {
                    val acc = accounts.find { it.id == selectedId } ?: return@OutlinedButton
                    scope.launch {
                        loading = true
                        try {
                            api.invokeRaw("schedule-post", listOf(mapOf(
                                "platform" to (acc.platform ?: "LinkedIn"),
                                "accountId" to acc.id,
                                "content" to content,
                                "scheduleTime" to Instant.now().plusSeconds(86400).toString(),
                            )))
                            status = "Scheduled for +24h"
                        } catch (e: Exception) { status = e.message ?: "Error" }
                        loading = false
                    }
                }) { Text("Schedule +24h") }
            }
            SIPrimaryButton(if (loading) "Publishing…" else "Publish Now", !loading && content.isNotBlank()) {
                val acc = accounts.find { it.id == selectedId } ?: return@SIPrimaryButton
                scope.launch {
                    loading = true
                    status = "Publishing…"
                    try {
                        val res = api.invoke<com.socialimperialism.mobile.core.PublishResult>("publish-post", listOf(mapOf(
                            "accountId" to acc.id,
                            "platform" to (acc.platform ?: "LinkedIn"),
                            "content" to content,
                            "hasMedia" to false,
                            "humanLike" to false,
                        )))
                        status = if (res.success == false) res.error ?: "Failed" else "Published"
                    } catch (e: Exception) { status = e.message ?: "Error" }
                    loading = false
                }
            }
            if (status.isNotBlank()) Text(status, color = SITheme.Muted, fontSize = 12.sp)
        }
    }
}