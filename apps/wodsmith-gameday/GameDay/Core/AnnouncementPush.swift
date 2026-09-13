import Foundation
import Observation
import Security
import UIKit
import UserNotifications

struct AnnouncementLink: Identifiable, Equatable {
    let competitionID: String
    let announcementID: String
    var id: String { "\(competitionID):\(announcementID)" }
    init?(payload: [AnyHashable: Any]) {
        guard let competition = payload["competitionID"] as? String,
              let announcement = payload["announcementID"] as? String,
              !competition.isEmpty, !announcement.isEmpty,
              competition.count < 256, announcement.count < 256,
              !competition.contains("/"), !announcement.contains("/") else { return nil }
        competitionID = competition
        announcementID = announcement
    }
}

@Observable @MainActor
final class AnnouncementRouter {
    static let shared = AnnouncementRouter()
    // Retained before SwiftUI mounts so a notification tap survives a cold launch.
    var pending: AnnouncementLink?
}

struct PushSubscription: Codable, Equatable {
    let credential: String
    let token: String
    let environment: String
    let subscriptionId: String
    var body: [String: String] { ["token": token, "environment": environment, "subscriptionId": subscriptionId] }
}

// Separate Keychain item keeps an offline sign-out revocation available without restoring sign-in.
enum PushSubscriptionKeychain {
    static var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.wodsmith.gameday.push", kSecAttrAccount as String: "subscription"] }
    static func read() -> PushSubscription? {
        var result: CFTypeRef?
        var readQuery = query
        readQuery[kSecReturnData as String] = true
        readQuery[kSecMatchLimit as String] = kSecMatchLimitOne
        guard SecItemCopyMatching(readQuery as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(PushSubscription.self, from: data)
    }
    static func save(_ value: PushSubscription?) throws {
        guard let value else { SecItemDelete(query as CFDictionary); return }
        let attributes: [String: Any] = [kSecValueData as String: try JSONEncoder().encode(value),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) }
        guard status == errSecSuccess else { throw APIError(status: Int(status), message: "Couldn’t securely save notification settings.") }
    }
}

@Observable @MainActor
final class AnnouncementPushManager {
    var enabled = UserDefaults.standard.bool(forKey: "announcementPushEnabled") {
        didSet { UserDefaults.standard.set(enabled, forKey: "announcementPushEnabled") }
    }
    private(set) var status = "Enable alerts for announcements sent to you."
    private var revision = UUID()
    private var permissionAllowed = false
    private var credential: String?
    private var deviceToken: String?
    private var subscription: PushSubscription?
    private var tail: Task<Void, Never>?
    private let api: GameDayAPI
    private let save: (PushSubscription?) throws -> Void
    private let environment: String

    init(api: GameDayAPI = GameDayAPI(), subscription: PushSubscription? = PushSubscriptionKeychain.read(),
         environment: String = AnnouncementPushManager.apnsEnvironment,
         save: @escaping (PushSubscription?) throws -> Void = PushSubscriptionKeychain.save) {
        self.api = api; self.subscription = subscription; self.save = save; self.environment = environment
    }
    static var apnsEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
    func updateSession(_ value: String?) {
        if credential != value { revision = UUID() }
        credential = value
        if value == nil { UIApplication.shared.unregisterForRemoteNotifications() }
    }
    func receivedToken(_ data: Data) async {
        deviceToken = data.map { String(format: "%02x", $0) }.joined()
        await synchronize()
    }
    func registrationFailed() { status = "Couldn’t register with Apple. Open Game Day to try again." }
    func setEnabled(_ value: Bool) async {
        revision = UUID()
        let current = revision
        if value {
            guard credential != nil else { status = "Sign in to enable announcement alerts."; return }
            do {
                let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                guard current == revision else { return }
                enabled = granted
            } catch { status = "Couldn’t request notification permission."; return }
        } else { enabled = false }
        await refreshPermission()
    }
    func refreshPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        if enabled && credential != nil && allowed {
            UIApplication.shared.registerForRemoteNotifications()
        } else {
            UIApplication.shared.unregisterForRemoteNotifications()
        }
        await synchronize(allowed: allowed)
    }
    func signOut() async {
        updateSession(nil)
        enabled = false
        await synchronize(allowed: false)
    }
    func synchronize(allowed: Bool? = nil) async {
        if let allowed { permissionAllowed = allowed }
        let previous = tail
        let task = Task { @MainActor in
            await previous?.value
            await self.reconcile(allowed: self.permissionAllowed)
        }
        tail = task
        await task.value
    }
    private func reconcile(allowed: Bool) async {
        struct Result: Decodable { let registered: Bool }
        let desiredCredential = enabled && allowed ? credential : nil
        do {
            if let old = subscription,
               old.credential != desiredCredential || (deviceToken != nil && old.token != deviceToken) {
                do {
                    let _: Result = try await api.request("api/gameday/v1/devices", token: old.credential, method: "DELETE", body: old.body)
                } catch let error as APIError where error.status == 401 {
                    // Expired/revoked sessions are rejected by the delivery worker too.
                }
                try save(nil)
                subscription = nil
            }
            guard let current = desiredCredential, current == credential, enabled, allowed,
                  let deviceToken else {
                if enabled && credential != nil {
                    status = allowed ? "Waiting for Apple notification registration." : "Allow notifications in iPhone Settings to receive announcement alerts."
                } else { status = "Announcement alerts are off." }
                return
            }
            let value = subscription ?? PushSubscription(credential: current, token: deviceToken,
                environment: environment, subscriptionId: UUID().uuidString)
            // Persist before PUT: even a response lost after server commit must be revocable.
            try save(value)
            subscription = value
            let _: Result = try await api.request("api/gameday/v1/devices", token: current, method: "PUT", body: value.body)
            status = "Announcement alerts are enabled on this iPhone."
        } catch {
            status = "Notification settings haven’t synced. Open Game Day online to retry."
        }
    }
}

@MainActor
final class PushAppDelegate: NSObject, UIApplicationDelegate {
    var manager: AnnouncementPushManager?
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await manager?.receivedToken(deviceToken) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        manager?.registrationFailed()
    }
}
