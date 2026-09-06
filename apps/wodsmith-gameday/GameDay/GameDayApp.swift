import SwiftUI
import UserNotifications

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let id = response.notification.request.content.userInfo["competitionID"] as? String else { return }
        await MainActor.run { NotificationCenter.default.post(name: .openGameDayCompetition, object: id) }
    }
}
extension Notification.Name { static let openGameDayCompetition = Notification.Name("openGameDayCompetition") }

@main
struct GameDayApp: App {
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
