package com.socialimperialism.mobile.core

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthStore(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "si_auth",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _token = MutableStateFlow(prefs.getString(KEY_TOKEN, null))
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _projectId = MutableStateFlow(loadProjectId())
    val projectId: StateFlow<String?> = _projectId.asStateFlow()

    private val _bootstrapped = MutableStateFlow(false)
    val bootstrapped: StateFlow<Boolean> = _bootstrapped.asStateFlow()

    val isAuthenticated: Boolean get() = _token.value != null

    fun setSession(session: SessionResponse) {
        prefs.edit().putString(KEY_TOKEN, session.token).apply()
        _token.value = session.token
        session.project?.id?.let { setProjectId(it) }
    }

    fun clearSession() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_PROJECT).apply()
        _token.value = null
        _projectId.value = null
    }

    fun setProjectId(id: String?) {
        if (id == null) {
            prefs.edit().remove(KEY_PROJECT).apply()
            _projectId.value = null
        } else {
            prefs.edit().putString(KEY_PROJECT, id).apply()
            _projectId.value = id
        }
    }

    suspend fun bootstrap(api: ApiClient) {
        try {
            if (_token.value != null) repairSession(api)
        } catch (_: Exception) {
            clearSession()
        } finally {
            _bootstrapped.value = true
        }
    }

    suspend fun repairSession(api: ApiClient) {
        val me = api.me()
        val active = me.project?.id
            ?: me.projects?.firstOrNull { it.isActive == true }?.id
            ?: me.projects?.firstOrNull()?.id
        setProjectId(active)
    }

    private fun loadProjectId(): String? {
        val raw = prefs.getString(KEY_PROJECT, null)
        return if (raw?.startsWith("camp_") == true) null else raw
    }

    companion object {
        private const val KEY_TOKEN = "si_token"
        private const val KEY_PROJECT = "si_project_id"
    }
}