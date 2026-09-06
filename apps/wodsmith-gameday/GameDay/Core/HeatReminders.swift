import ActivityKit
import Foundation
import Observation
import UserNotifications

struct PlannedReminder: Equatable {
    let id: String
    let competitionID: String
    let title: String
    let body: String
    let fireAt: Date
}

enum ReminderPlanner {
    static func plan(details: [CompetitionDetail], minutes: Int, now: Date = .now) -> [PlannedReminder] {
        details.flatMap { detail in
            detail.myHeats.compactMap { heat -> PlannedReminder? in
                guard let start = heat.startsAt else { return nil }
                let fire = start.addingTimeInterval(-Double(minutes * 60))
                guard fire > now else { return nil }
                let lane = detail.lane(for: heat).map { " · Lane \($0)" } ?? ""
                return PlannedReminder(id: "heat.\(heat.id)", competitionID: detail.competition.id,
                    title: "\(heat.eventName) in \(minutes) minutes",
                    body: "Heat \(heat.heatNumber)\(lane) · \(heat.venue ?? detail.competition.name). Check the latest schedule before warming up.", fireAt: fire)
            }
        }.sorted { $0.fireAt < $1.fireAt }.prefix(60).map { $0 }
    }
}

@MainActor
protocol HeatNotificationCenter: AnyObject {
    var authorizationStatus: UNAuthorizationStatus { get async }
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool
    func pendingNotificationRequests() async -> [UNNotificationRequest]
    func add(_ request: UNNotificationRequest) async throws
    func removePendingNotificationRequests(withIdentifiers identifiers: [String])
    func removeAllPendingNotificationRequests()
    func removeAllDeliveredNotifications()
}

extension UNUserNotificationCenter: HeatNotificationCenter {
    var authorizationStatus: UNAuthorizationStatus {
        get async { await notificationSettings().authorizationStatus }
    }
}

@Observable @MainActor
final class HeatReminderManager {
    var enabled: Bool { didSet { defaults.set(enabled, forKey: "heatRemindersEnabled") } }
    var minutes: Int { didSet { defaults.set(minutes, forKey: "heatReminderMinutes") } }
    var permissionDenied = false
    private let center: any HeatNotificationCenter
    private let defaults: UserDefaults
    private let updates = HeatUpdateQueue()

    init(center: any HeatNotificationCenter = UNUserNotificationCenter.current(), defaults: UserDefaults = .standard) {
        self.center = center
        self.defaults = defaults
        enabled = defaults.bool(forKey: "heatRemindersEnabled")
        let saved = defaults.integer(forKey: "heatReminderMinutes")
        minutes = [5, 10, 15, 20, 30, 45, 60].contains(saved) ? saved : 15
    }
    func requestPermission() async throws -> Bool {
        let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        permissionDenied = !granted
        enabled = granted
        return granted
    }
    func reconcile(details: [CompetitionDetail]) async throws {
        try await updates.run { try await self.replaceReminders(details: details) }
    }
    private func replaceReminders(details: [CompetitionDetail]) async throws {
        let authorization = await center.authorizationStatus
        permissionDenied = authorization == .denied
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix("heat.") }.map(\.identifier))
        guard enabled, authorization == .authorized || authorization == .provisional else { return }
        for reminder in ReminderPlanner.plan(details: details, minutes: minutes) {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            content.threadIdentifier = reminder.competitionID
            content.userInfo = ["competitionID": reminder.competitionID]
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, reminder.fireAt.timeIntervalSinceNow), repeats: false)
            try await center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger))
        }
    }
    func clear() async {
        try? await updates.run {
            self.center.removeAllPendingNotificationRequests()
            self.center.removeAllDeliveredNotifications()
        }
    }
}

@MainActor
private final class HeatUpdateQueue {
    private var updateTail: Task<Void, Error>?
    private var updateID = UUID()

    func run(_ action: @escaping @MainActor () async throws -> Void) async throws {
        let previous = updateTail
        let id = UUID()
        updateID = id
        let task = Task { @MainActor in
            // Keep sign-out cleanup behind in-flight system calls, even if one fails.
            _ = try? await previous?.value
            try await action()
        }
        updateTail = task
        defer { if updateID == id { updateTail = nil } }
        try await task.value
    }
}

@Observable @MainActor
final class HeatActivityManager {
    private(set) var activeHeatID: String? = Activity<HeatActivityAttributes>.activities.first?.attributes.heatID
    private let updates = HeatUpdateQueue()
    func start(heat: Heat, detail: CompetitionDetail) async throws {
        try await updates.run { try await self.startActivity(heat: heat, detail: detail) }
    }
    private func startActivity(heat: Heat, detail: CompetitionDetail) async throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw APIError(status: 0, message: "Enable Live Activities for Game Day in iPhone Settings.")
        }
        guard let start = heat.startsAt, let end = heat.endsAt, end > .now,
              start.timeIntervalSinceNow < 8 * 3600 else {
            throw APIError(status: 0, message: "Start a Live Activity within eight hours of your heat.")
        }
        await endActivities()
        let attributes = HeatActivityAttributes(competitionID: detail.competition.id, competitionName: detail.competition.name, heatID: heat.id)
        _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state(heat, detail), staleDate: end), pushType: nil)
        activeHeatID = heat.id
    }
    func reconcile(details: [CompetitionDetail]) async {
        try? await updates.run { await self.updateActivities(details: details) }
    }
    private func updateActivities(details: [CompetitionDetail]) async {
        for activity in Activity<HeatActivityAttributes>.activities {
            guard let detail = details.first(where: { $0.competition.id == activity.attributes.competitionID }),
                  let heat = detail.myHeats.first(where: { $0.id == activity.attributes.heatID }),
                  let end = heat.endsAt, end > .now else {
                await activity.end(nil, dismissalPolicy: .immediate)
                activeHeatID = nil
                continue
            }
            await activity.update(ActivityContent(state: state(heat, detail), staleDate: end))
        }
    }
    func end() async {
        try? await updates.run { await self.endActivities() }
    }
    private func endActivities() async {
        activeHeatID = nil
        for activity in Activity<HeatActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    }
    private func state(_ heat: Heat, _ detail: CompetitionDetail) -> HeatActivityAttributes.ContentState {
        .init(eventName: heat.eventName, startsAt: heat.startsAt ?? .now, endsAt: heat.endsAt ?? .now,
              heatNumber: heat.heatNumber, lane: detail.lane(for: heat), venue: heat.venue ?? "Venue TBA")
    }
}
