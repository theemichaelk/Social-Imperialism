import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case server(String)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Session expired. Please sign in again."
        case .server(let msg): return msg
        case .network(let err): return err.localizedDescription
        }
    }
}

final class APIClient {
    static let shared = APIClient()
    static let productionBase = "https://api.socialimperialism.com"

    var baseURL: String {
        ProcessInfo.processInfo.environment["SI_API_URL"] ?? Self.productionBase
    }

    private let session: URLSession
    private let decoder = JSONDecoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> SessionResponse {
        try await postJSON("/api/auth/login", body: ["email": email, "password": password], auth: false)
    }

    func register(email: String, password: String, name: String?) async throws -> SessionResponse {
        var body: [String: String] = ["email": email, "password": password]
        if let name, !name.isEmpty { body["name"] = name }
        return try await postJSON("/api/auth/register", body: body, auth: false)
    }

    func me() async throws -> MeResponse {
        try await getJSON("/api/auth/me")
    }

    // MARK: - Invoke

    func invoke<T: Decodable>(_ channel: String, args: [Any] = []) async throws -> T {
        let envelope: InvokeEnvelope<T> = try await postJSON(
            "/api/invoke/\(channel)",
            body: ["args": args],
            auth: true
        )
        guard let data = envelope.data else {
            throw APIError.server("Empty response from \(channel)")
        }
        return data
    }

    func invokeRaw(_ channel: String, args: [Any] = []) async throws -> [String: Any] {
        let data = try await request(
            path: "/api/invoke/\(channel)",
            method: "POST",
            body: ["args": args],
            auth: true
        )
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.server("Invalid JSON")
        }
        if let checkout = json["checkoutUrl"] as? String {
            await MainActor.run {
                NotificationCenter.default.post(name: .siOpenCheckout, object: checkout)
            }
        }
        return json
    }

    // MARK: - HTTP

    private func getJSON<T: Decodable>(_ path: String) async throws -> T {
        let data = try await request(path: path, method: "GET", body: nil, auth: true)
        return try decode(T.self, from: data)
    }

    private func postJSON<T: Decodable>(_ path: String, body: [String: Any], auth: Bool) async throws -> T {
        let data = try await request(path: path, method: "POST", body: body, auth: auth)
        return try decode(T.self, from: data)
    }

    private func request(path: String, method: String, body: [String: Any]?, auth: Bool) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.server("Invalid URL")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if auth {
            guard let token = AuthStore.shared.token else { throw APIError.unauthorized }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            if let projectId = AuthStore.shared.projectId {
                req.setValue(projectId, forHTTPHeaderField: "x-project-id")
            }
        }

        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.server("No response")
            }
            if http.statusCode == 401 {
                await MainActor.run { AuthStore.shared.clearSession() }
                throw APIError.unauthorized
            }
            if http.statusCode >= 400 {
                let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                let msg = (json?["error"] as? String) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
                if auth, msg.lowercased().contains("project not found") {
                    AuthStore.shared.projectId = nil
                    _ = try? await AuthStore.shared.repairSession()
                    return try await request(path: path, method: method, body: body, auth: auth)
                }
                throw APIError.server(msg)
            }
            return data
        } catch let err as APIError {
            throw err
        } catch {
            throw APIError.network(error)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        if let wrapper = try? decoder.decode(APIWrapper<T>.self, from: data), let inner = wrapper.data {
            return inner
        }
        return try decoder.decode(T.self, from: data)
    }
}

extension Notification.Name {
    static let siOpenCheckout = Notification.Name("siOpenCheckout")
}

struct APIWrapper<T: Decodable>: Decodable {
    let data: T?
    let error: String?
}

struct InvokeEnvelope<T: Decodable>: Decodable {
    let data: T?
    let checkoutUrl: String?
    let pendingOAuthUrl: String?
}

struct SessionResponse: Decodable {
    let token: String
    let project: ProjectRef?
}

struct MeResponse: Decodable {
    let project: ProjectRef?
    let projects: [ProjectRef]?
}

struct ProjectRef: Decodable, Identifiable {
    let id: String
    let name: String?
    let isActive: Bool?
}