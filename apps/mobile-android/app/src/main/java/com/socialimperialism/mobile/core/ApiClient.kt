package com.socialimperialism.mobile.core

import com.socialimperialism.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiException(message: String) : Exception(message)

class ApiClient(private val auth: AuthStore) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json".toMediaType()

    suspend fun login(email: String, password: String): SessionResponse = withContext(Dispatchers.IO) {
        val body = JSONObject().put("email", email).put("password", password)
        decodeSession(post("/api/auth/login", body, auth = false))
    }

    suspend fun register(email: String, password: String, name: String?): SessionResponse = withContext(Dispatchers.IO) {
        val body = JSONObject().put("email", email).put("password", password)
        if (!name.isNullOrBlank()) body.put("name", name)
        decodeSession(post("/api/auth/register", body, auth = false))
    }

    suspend fun me(): MeResponse = withContext(Dispatchers.IO) {
        val json = JSONObject(get("/api/auth/me", auth = true))
        MeResponse(
            project = json.optJSONObject("project")?.let { decodeProject(it) },
            projects = json.optJSONArray("projects")?.let { arr ->
                (0 until arr.length()).map { decodeProject(arr.getJSONObject(it)) }
            },
        )
    }

    suspend inline fun <reified T> invoke(channel: String, args: List<Any> = emptyList(), noinline onCheckout: ((String) -> Unit)? = null): T = withContext(Dispatchers.IO) {
        val argsJson = JSONArray()
        args.forEach { arg ->
            when (arg) {
                is Map<*, *> -> argsJson.put(mapToJson(arg))
                else -> argsJson.put(arg)
            }
        }
        val body = JSONObject().put("args", argsJson)
        val json = JSONObject(post("/api/invoke/$channel", body, auth = true))
        val data = json.opt("data")
        if (data is JSONObject) {
            data.optString("checkoutUrl").takeIf { it.isNotBlank() }?.let { onCheckout?.invoke(it) }
        }
        when (T::class) {
            String::class -> (when (data) {
                is String -> data
                else -> data?.toString() ?: ""
            }) as T
            DashboardStats::class -> decodeDashboard(data) as T
            VaultResponse::class -> decodeVault(data) as T
            LoadPromptResponse::class -> decodeLoadPrompt(data) as T
            String::class -> (data?.toString() ?: "") as T
            BillingPlan::class -> decodeBilling(data) as T
            CheckoutResult::class -> decodeCheckout(data) as T
            PublishResult::class -> decodePublish(data) as T
            else -> {
                when (data) {
                    is JSONArray -> {
                        when (T::class) {
                            List::class -> decodeEngagementList(data) as T
                            else -> throw ApiException("Unsupported list type")
                        }
                    }
                    else -> throw ApiException("Unsupported invoke decode: ${T::class}")
                }
            }
        }
    }

    suspend fun invokeLinkedAccounts(): List<LinkedAccount> = withContext(Dispatchers.IO) {
        val json = JSONObject(post("/api/invoke/get-linked-accounts", JSONObject().put("args", JSONArray()), auth = true))
        val data = json.optJSONArray("data") ?: JSONArray()
        (0 until data.length()).map { i ->
            val o = data.getJSONObject(i)
            LinkedAccount(o.getString("id"), o.optString("platform"), o.optString("name"), o.optString("handle"))
        }
    }

    suspend fun invokeEngagementQueue(): List<EngagementQueueItem> = withContext(Dispatchers.IO) {
        val json = JSONObject(post("/api/invoke/get-engagement-queue", JSONObject().put("args", JSONArray()), auth = true))
        val data = json.optJSONArray("data") ?: JSONArray()
        decodeEngagementList(data)
    }

    suspend fun invokeRaw(channel: String, args: List<Any> = emptyList()): JSONObject = withContext(Dispatchers.IO) {
        val argsJson = JSONArray()
        args.forEach { if (it is Map<*, *>) argsJson.put(mapToJson(it)) else argsJson.put(it) }
        JSONObject(post("/api/invoke/$channel", JSONObject().put("args", argsJson), auth = true))
    }

    private fun get(path: String, auth: Boolean): String {
        val req = baseRequest(path, auth).get().build()
        return execute(req, auth, path, null)
    }

    private fun post(path: String, body: JSONObject, auth: Boolean): String {
        val req = baseRequest(path, auth)
            .post(body.toString().toRequestBody(jsonType))
            .build()
        return execute(req, auth, path, body)
    }

    private fun baseRequest(path: String, auth: Boolean): Request.Builder {
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE + path)
            .header("Content-Type", "application/json")
        if (auth) {
            val token = auth.token.value ?: throw ApiException("Not authenticated")
            builder.header("Authorization", "Bearer $token")
            auth.projectId.value?.let { builder.header("x-project-id", it) }
        }
        return builder
    }

    private fun execute(req: Request, auth: Boolean, path: String, retryBody: JSONObject?): String {
        val res = client.newCall(req).execute()
        val text = res.body?.string() ?: "{}"
        if (res.code == 401) {
            auth.clearSession()
            throw ApiException("Session expired")
        }
        if (!res.isSuccessful) {
            val err = try { JSONObject(text).optString("error", res.message) } catch (_: Exception) { res.message }
            if (auth && err.contains("project not found", ignoreCase = true)) {
                auth.setProjectId(null)
                return post(path, retryBody ?: JSONObject(), auth = true)
            }
            throw ApiException(err)
        }
        return text
    }

    private fun decodeSession(text: String): SessionResponse {
        val json = JSONObject(text)
        val token = json.optString("token").ifBlank { json.optJSONObject("data")?.optString("token") ?: "" }
        val project = json.optJSONObject("project") ?: json.optJSONObject("data")?.optJSONObject("project")
        return SessionResponse(token, project?.let { decodeProject(it) })
    }

    private fun decodeProject(o: JSONObject) = ProjectRef(o.getString("id"), o.optString("name"), o.optBoolean("isActive"))

    private fun decodeDashboard(data: Any?): DashboardStats {
        val o = data as? JSONObject ?: JSONObject()
        return DashboardStats(
            totalPosts = o.optInt("totalPosts"),
            aiDrafts = o.optInt("aiDrafts"),
            totalEngagement = o.optInt("totalEngagement"),
            activeKeywords = o.optInt("activeKeywords"),
            linkedAccounts = o.optInt("linkedAccounts"),
            scheduled = o.optInt("scheduled"),
            workerStatus = o.optString("workerStatus"),
            autoRulesEnabled = o.optBoolean("autoRulesEnabled"),
        )
    }

    private fun decodeVault(data: Any?): VaultResponse {
        val o = data as? JSONObject ?: JSONObject()
        val arr = o.optJSONArray("prompts") ?: JSONArray()
        val prompts = (0 until arr.length()).map { i ->
            val p = arr.getJSONObject(i)
            VaultPrompt(p.getString("id"), p.optString("title"), p.optString("body"), p.optString("feature"))
        }
        return VaultResponse(prompts, o.optInt("total"))
    }

    private fun decodeLoadPrompt(data: Any?) = LoadPromptResponse(
        success = (data as? JSONObject)?.optBoolean("success"),
        prompt = (data as? JSONObject)?.optString("prompt"),
        item = null,
    )

    private fun decodeBilling(data: Any?): BillingPlan {
        val o = data as? JSONObject ?: JSONObject()
        return BillingPlan(o.optString("plan"), o.optString("planName"), o.optString("status"), o.optString("priceLabel"), o.optString("billingEmail"))
    }

    private fun decodeCheckout(data: Any?) = CheckoutResult(
        success = (data as? JSONObject)?.optBoolean("success"),
        checkoutUrl = (data as? JSONObject)?.optString("checkoutUrl"),
        error = (data as? JSONObject)?.optString("error"),
    )

    private fun decodePublish(data: Any?) = PublishResult(
        success = (data as? JSONObject)?.optBoolean("success"),
        error = (data as? JSONObject)?.optString("error"),
    )

    private fun decodeEngagementList(arr: JSONArray): List<EngagementQueueItem> =
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            EngagementQueueItem(o.optString("id", "q$i"), o.optString("platform"), o.optString("content"), o.optString("action"), o.optString("status"))
        }

    private fun mapToJson(map: Map<*, *>): JSONObject {
        val o = JSONObject()
        map.forEach { (k, v) -> o.put(k.toString(), v) }
        return o
    }
}