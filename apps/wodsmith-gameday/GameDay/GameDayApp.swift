import SwiftUI
import UserNotifications

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping @Sendable (UNNotificationPresentationOptions) -> Void) {
        Task { @MainActor in completionHandler([.banner, .sound]) }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping @Sendable () -> Void) {
        let payload = response.notification.request.content.userInfo
        let announcement = AnnouncementLink(payload: payload)
        let competitionID = payload["competitionID"] as? String
        // UIKit's response completion performs state restoration and must run on main.
        Task { @MainActor in
            if let announcement { AnnouncementRouter.shared.pending = announcement }
            else if let competitionID { NotificationCenter.default.post(name: .openGameDayCompetition, object: competitionID) }
            completionHandler()
        }
    }
}
extension Notification.Name { static let openGameDayCompetition = Notification.Name("openGameDayCompetition") }

@main
struct GameDayApp: App {
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var appDelegate
    @State private var store: GameDayStore
    private let notificationDelegate = NotificationDelegate()
    init() {
        #if DEBUG
        _store = State(initialValue: GameDayStore(demo: ProcessInfo.processInfo.arguments.contains("--demo")))
        #else
        _store = State(initialValue: GameDayStore())
        #endif
        UNUserNotificationCenter.current().delegate = notificationDelegate
    }
    var body: some Scene {
        WindowGroup {
            AppShell().environment(store).tint(.gameDayOrange)
                .onAppear { appDelegate.manager = store.push }

                .onOpenURL { url in
                    if url.scheme == "wodsmith-gameday", url.host == "competition" {
                        store.selectedCompetitionID = url.lastPathComponent
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .openGameDayCompetition)) { notification in
                    store.selectedCompetitionID = notification.object as? String
                }
        }
    }
}
