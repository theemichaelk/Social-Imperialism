package com.socialimperialism.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.socialimperialism.mobile.core.SITheme

@Composable
fun SICard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(SITheme.Panel, RoundedCornerShape(14.dp))
            .border(1.dp, SITheme.Accent.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(16.dp),
        content = content,
    )
}

@Composable
fun SIPrimaryButton(title: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(
            containerColor = SITheme.Accent,
            contentColor = SITheme.Bg,
            disabledContainerColor = SITheme.Muted.copy(alpha = 0.3f),
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(title)
    }
}

@Composable
fun SITextField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = SITheme.Muted) },
        modifier = modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = SITheme.Text,
            unfocusedTextColor = SITheme.Text,
            focusedBorderColor = SITheme.Accent.copy(alpha = 0.4f),
            unfocusedBorderColor = SITheme.Accent.copy(alpha = 0.2f),
            cursorColor = SITheme.Accent,
            focusedContainerColor = SITheme.Panel,
            unfocusedContainerColor = SITheme.Panel,
        ),
        shape = RoundedCornerShape(10.dp),
        singleLine = true,
    )
}

@Composable
fun SIScreenBg(content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SITheme.Bg),
        content = content,
    )
}