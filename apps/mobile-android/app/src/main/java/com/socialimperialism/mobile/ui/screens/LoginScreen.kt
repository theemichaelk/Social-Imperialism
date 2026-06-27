package com.socialimperialism.mobile.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.socialimperialism.mobile.core.ApiClient
import com.socialimperialism.mobile.core.AuthStore
import com.socialimperialism.mobile.core.SITheme
import com.socialimperialism.mobile.ui.SIPrimaryButton
import com.socialimperialism.mobile.ui.SIScreenBg
import com.socialimperialism.mobile.ui.SITextField
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(auth: AuthStore, api: ApiClient) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var isRegister by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    SIScreenBg {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Social Imperialism", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = SITheme.Accent)
            Text(
                if (isRegister) "Create your command center account" else "Sign in to Mission Control",
                color = SITheme.Muted,
            )
            if (isRegister) SITextField(name, { name = it }, "Name (optional)")
            SITextField(email, { email = it }, "Email")
            SITextField(password, { password = it }, "Password")
            if (error.isNotBlank()) Text(error, color = SITheme.Warn, fontSize = 12.sp)
            SIPrimaryButton(if (loading) "Please wait…" else if (isRegister) "Create Account" else "Sign In", !loading && email.isNotBlank() && password.isNotBlank()) {
                scope.launch {
                    loading = true
                    error = ""
                    try {
                        val session = if (isRegister) api.register(email, password, name) else api.login(email, password)
                        auth.setSession(session)
                        auth.repairSession(api)
                    } catch (e: Exception) {
                        error = e.message ?: "Auth failed"
                    } finally {
                        loading = false
                    }
                }
            }
            TextButton(onClick = { isRegister = !isRegister; error = "" }) {
                Text(
                    if (isRegister) "Already have an account? Sign in" else "Need an account? Register",
                    color = SITheme.Accent2,
                )
            }
        }
    }
}