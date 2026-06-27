import Foundation
import Security

@MainActor
final class AuthStore: ObservableObject {
    static let shared = AuthStore()

    @Published private(set) var token: String?
    @Published private(set) var projectId: String?
    @Published private(set) var isBootstrapped = false

    var isAuthenticated: Bool { token != nil }

    private let tokenKey = "si_token"
    private let projectKey = "si_project_id"

    init() {
        token = KeychainHelper.load(key: tokenKey)
        projectId = KeychainHelper.load(key: projectKey)
        if projectId?.hasPrefix("camp_") == true {
            projectId = nil
            KeychainHelper.delete(key: projectKey)
        }
    }

    func setSession(_ session: SessionResponse) {
        token = session.token
        KeychainHelper.save(key: tokenKey, value: session.token)
        if let id = session.project?.id {
            projectId = id
            KeychainHelper.save(key: projectKey, value: id)
        }
    }

    func clearSession() {
        token = nil
        projectId = nil
        KeychainHelper.delete(key: tokenKey)
        KeychainHelper.delete(key: projectKey)
    }

    func bootstrap() async {
        defer { isBootstrapped = true }
        guard token != nil else { return }
        do {
            try await repairSession()
        } catch {
            clearSession()
        }
    }

    func repairSession() async throws {
        let me = try await APIClient.shared.me()
        let active = me.project?.id
            ?? me.projects?.first(where: { $0.isActive == true })?.id
            ?? me.projects?.first?.id
        if let active {
            projectId = active
            KeychainHelper.save(key: projectKey, value: active)
        } else {
            projectId = nil
            KeychainHelper.delete(key: projectKey)
        }
    }
}

enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let str = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}