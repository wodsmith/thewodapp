import UserNotifications
import XCTest
@testable import GameDay

@MainActor
final class ReminderConcurrencyTests: XCTestCase {
    // @lat: [[gameday#Tests#Sign-out during reminder scheduling]]
    func testClearWaitsForInFlightAddsAndLeavesNoAthleteNotifications() async throws {
        let center = SuspendedNotificationCenter()
        let manager = makeManager(center)
        let old = Task { try await manager.reconcile(details: [DemoData.detail]) }
        await center.waitForSuspendedAdd()
        let clearing = Task { await manager.clear() }
        await Task.yield()
        center.resumeAdd()
        try await old.value
        await clearing.value
        XCTAssertTrue(center.requests.isEmpty)
        XCTAssertTrue(center.deliveredCleared)
    }

    // @lat: [[gameday#Tests#Overlapping reminder refreshes]]
    func testLaterScheduleReplacementWinsOverAnInFlightAdd() async throws {
        let center = SuspendedNotificationCenter()
        let manager = makeManager(center)
        let old = Task { try await manager.reconcile(details: [DemoData.detail]) }
        await center.waitForSuspendedAdd()
        let latest = Task { try await manager.reconcile(details: []) }
        await Task.yield()
        center.resumeAdd()
        try await old.value
        try await latest.value
        XCTAssertTrue(center.requests.isEmpty, "An empty refreshed assignment set must remove every old reminder")
    }

    // @lat: [[gameday#Tests#Reminder failure recovery]]
    func testFailedAddDoesNotPreventQueuedClear() async throws {
        let center = SuspendedNotificationCenter()
        center.failAdd = true
        let manager = makeManager(center)
        let old = Task { try await manager.reconcile(details: [DemoData.detail]) }
        await center.waitForSuspendedAdd()
        let clearing = Task { await manager.clear() }
        await Task.yield()
        center.resumeAdd()
        do { try await old.value; XCTFail("The notification-center failure must reach the caller") }
        catch { XCTAssertEqual(error as? URLError, URLError(.cannotConnectToHost)) }
        await clearing.value
        XCTAssertTrue(center.requests.isEmpty)
        XCTAssertTrue(center.deliveredCleared)
    }

    private func makeManager(_ center: SuspendedNotificationCenter) -> HeatReminderManager {
        let suite = "GameDayReminderTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        addTeardownBlock { defaults.removePersistentDomain(forName: suite) }
        let manager = HeatReminderManager(center: center, defaults: defaults)
        manager.enabled = true
        return manager
    }
}

@MainActor
private final class SuspendedNotificationCenter: HeatNotificationCenter {
    var requests: [String: UNNotificationRequest] = [:]
    var deliveredCleared = false
    var failAdd = false
    private var shouldSuspend = true
    private var resume: CheckedContinuation<Void, Never>?
    private var suspended: CheckedContinuation<Void, Never>?

    var authorizationStatus: UNAuthorizationStatus { get async { .authorized } }
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool { true }
    func pendingNotificationRequests() async -> [UNNotificationRequest] { Array(requests.values) }
    func add(_ request: UNNotificationRequest) async throws {
        if shouldSuspend {
            shouldSuspend = false
            await withCheckedContinuation { continuation in
                resume = continuation
                suspended?.resume()
                suspended = nil
            }
        }
        if failAdd { throw URLError(.cannotConnectToHost) }
        requests[request.identifier] = request
    }
    func waitForSuspendedAdd() async {
        if resume != nil { return }
        await withCheckedContinuation { suspended = $0 }
    }
    func resumeAdd() { resume?.resume(); resume = nil }
    func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
        for id in identifiers { requests.removeValue(forKey: id) }
    }
    func removeAllPendingNotificationRequests() { requests.removeAll() }
    func removeAllDeliveredNotifications() { deliveredCleared = true }
}
